/**
 * Full invite-chain through Hiddify proxy (127.0.0.1:12334).
 * Each request opens a fresh ProxyAgent connection so the Hiddify pool
 * rotates egress IP, which distributes the per-IP daily registration cap.
 * Steps:
 *   main: register inviter -> read invite_link (user/info)
 *   subs: register N accounts with invite_code from main
 *   verify: main invite/list + wallet
 */
const { gcmEncrypt, gcmDecrypt, KEY_TEXT } = require('./crypto.js');
const crypto = require('crypto');
const { fetch, ProxyAgent } = require('undici');
const fs = require('fs');

const BASE = 'http://' + ['yznb', '4y3d', 'cc'].join('.');
const PROXY = process.env.PROXY || 'http://127.0.0.1:12334';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fresh connection each call so Hiddify rotates egress IP
async function viaProxy(url, opts) {
  const agent = new ProxyAgent(PROXY);
  try {
    return await fetch(url, { ...opts, dispatcher: agent });
  } finally {
    // let the agent's socket close so next call hits a new node/IP
    agent.close();
  }
}

async function api(path, bodyObj, token, deviceId) {
  const body = await gcmEncrypt(JSON.stringify(bodyObj), KEY_TEXT);
  const h = {
    'Content-Type': 'text/plain;charset=UTF-8',
    'User-Agent': UA,
    'Referer': BASE + '/',
    'Accept': '*/*',
    'X-Device-Id': deviceId,
  };
  if (token) h['x-token'] = token;
  // retry through fresh connections (IP rotate) on rate-limit/failure
  for (let i = 1; i <= 6; i++) {
    const r = await viaProxy(BASE + path, { method: 'POST', headers: h, body });
    const raw = await r.text();
    let out;
    try { out = JSON.parse(await gcmDecrypt(raw, KEY_TEXT)); }
    catch { try { out = JSON.parse(raw); } catch { out = { _raw: raw.slice(0, 120) }; } }
    const msg = out && out.msg ? out.msg : '';
    // retry if rate-limited or transient
    if (msg && /(已达上限|请求参数错误|频繁|失败|稍后)/.test(msg) && i < 6) {
      console.log(`  [retry ${i}] ${path} -> ${msg}`);
      await sleep(1500);
      continue;
    }
    return out;
  }
}

const randAccount = (p) => p + Date.now().toString().slice(-8) + crypto.randomBytes(2).toString('hex');
const randPwd = () => 'Ab' + crypto.randomBytes(5).toString('hex');

// login with account+password; for main accounts when token is stale
async function loginAs(account, password, deviceId, deviceType) {
  const login = await api('/api/auth/login', { account, password, login_device_type: deviceType || 'H' }, null, deviceId);
  return login && login.data && (login.data.token || (typeof login.data === 'string' ? login.data : ''));
}

// if main token is stale, re-login using saved credentials
async function ensureMain(main) {
  const probe = await api('/api/user/info', {}, main.token, main.deviceId);
  const stale = probe && probe.code === 1 && probe.data && probe.data.reason === 'token_invalid';
  if (!stale) return main;
  console.log('  main token stale -> re-login...');
  const t = await loginAs(main.account, main.password, main.deviceId, 'H');
  if (!t) { console.log('  re-login FAILED for main'); return null; }
  main.token = t;
  fs.writeFileSync('invite_main.json', JSON.stringify(main, null, 2));
  console.log('  re-login ok, refreshed token_len=', t.length);
  return main;
}

async function register(prefix, invite_code, deviceType) {
  const deviceId = 'dev-' + crypto.randomBytes(8).toString('hex');
  const account = randAccount(prefix);
  const password = randPwd();
  const reg = await api('/api/auth/reg', {
    account, password, verify_password: password, ch: '',
    invite_code: invite_code || '', device_type: deviceType || 'H', version: '0.0.0',
  }, null, deviceId);
  let token = reg && reg.data && (reg.data.token || (typeof reg.data === 'string' ? reg.data : ''));
  if (!token && reg && reg.code === 0 && reg.data && typeof reg.data === 'string') token = reg.data;
  // fallback: login
  if (!token) {
    const login = await api('/api/auth/login', { account, password, login_device_type: deviceType || 'H' }, null, deviceId);
    token = login && login.data && (login.data.token || (typeof login.data === 'string' ? login.data : ''));
  }
  return { deviceId, account, password, token, reg };
}

(async () => {
  // ---- 1) register MAIN inviter (reuse saved main if present) ----
  let main;
  const savedPath = 'invite_main.json';
  if (fs.existsSync(savedPath)) {
    try { main = JSON.parse(fs.readFileSync(savedPath, 'utf8')); } catch (e) {}
  }
  if (main && main.token) {
    console.log('=== [1/4] reuse saved MAIN', main.account, 'token_len=', main.token.length, '===');
  } else {
    console.log('=== [1/4] register MAIN inviter ===');
    main = await register('hdm', '', 'H');
    if (!main.token) { console.log('MAIN FAILED:', JSON.stringify(main.reg)); return; }
    console.log('MAIN ok account=', main.account, 'token_len=', main.token.length);
    fs.writeFileSync(savedPath, JSON.stringify(main, null, 2));
  }

  // ---- 2) refresh token if stale, then read user/info -> invite_link ----
  console.log('=== [2/4] ensure main token, read user/info ===');
  main = await ensureMain(main);
  if (!main) { console.log('MAIN unrecoverable'); return; }
  const ui = await api('/api/user/info', {}, main.token, main.deviceId);
  console.log('user/info:', JSON.stringify(ui).slice(0, 600));
  const link = (ui.data && (ui.data.invite_link || ui.data.inviteLink)) || (ui.systemInfo && ui.systemInfo.invite_link) || '';
  console.log('INVITE_LINK:', link);

  // ---- 3) register SUBS with invite_code ----
  const N = Number(process.argv[2] || '2');
  console.log(`=== [3/4] register ${N} sub account(s) ===`);
  const code = ui.data && (ui.data.invite_code || '');
  const subs = [];
  for (let i = 0; i < N; i++) {
    const s = await register('hds', code, 'H');
    console.log(`  sub${i + 1}: account=${s.account} success=${!!s.token} invite_code="${code}"`);
    if (s.token) { s.invite_code = code; subs.push(s); }
    await sleep(2200);
  }
  fs.writeFileSync('invite_subs.json', JSON.stringify(subs, null, 2));

  // ---- 4) verify main invite/list + wallet ----
  console.log('=== [4/4] verify main invite/list + wallet ===');
  const il = await api('/api/user/invite/list', { page: 1, page_size: 20 }, main.token, main.deviceId);
  console.log('invite/list:', JSON.stringify(il).slice(0, 600));
  const w = await api('/api/user/walletinfo', {}, main.token, main.deviceId);
  console.log('wallet:', JSON.stringify(w).slice(0, 500));
})();
