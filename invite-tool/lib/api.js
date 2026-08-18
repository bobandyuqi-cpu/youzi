/**
 * api.js — encrypted JSON-RPC-style requests to the target platform, routed
 * through the Hiddify proxy with per-request egress-IP rotation, randomized
 * pacing, and retry/backoff. Each call opens a fresh ProxyAgent connection so
 * the Hiddify node pool hands us a fresh egress IP — this spreads out the
 * per-IP daily registration cap and lowers fingerprint correlation risk.
 */
const { fetch, ProxyAgent } = require('undici');
const crypto = require('crypto');
const path = require('path');
const { gcmEncrypt, gcmDecrypt, KEY_TEXT } = require(path.resolve(__dirname, '..', '..', 'crypto.js'));

const BASE = 'http://' + ['yznb', '4y3d', 'cc'].join('.');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (base, spread = 800) => base + Math.floor(Math.random() * spread);

function freshDeviceId() {
  return 'dev-' + crypto.randomBytes(8).toString('hex');
}

let activeProxyUrl = null;

function setProxy(url) {
  activeProxyUrl = url;
}

async function viaProxy(url, opts) {
  if (!activeProxyUrl) throw new Error('proxy not configured (call setProxy first)');
  const agent = new ProxyAgent(activeProxyUrl);
  try {
    return await fetch(url, { ...opts, dispatcher: agent });
  } finally {
    // aggressively forget the socket so the next call gets a fresh node/IP
    try { agent.close(); } catch (e) {}
  }
}

/**
 * Perform an encrypted request.
 * @param {string} path      API path, e.g. '/api/auth/reg'
 * @param {object} bodyObj   plaintext request body
 * @param {object} opts      { token, deviceId, retries, paceMs, onLog }
 */
async function api(path, bodyObj, opts = {}) {
  const {
    token,
    deviceId = freshDeviceId(),
    retries = 6,
    paceMs = 0,
    onLog = () => {},
  } = opts;

  const body = await gcmEncrypt(JSON.stringify(bodyObj), KEY_TEXT);
  const headers = {
    'Content-Type': 'text/plain;charset=UTF-8',
    'User-Agent': UA,
    'Referer': BASE + '/',
    'Accept': '*/*',
    'X-Device-Id': deviceId,
  };
  if (token) headers['x-token'] = token;

  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    if (paceMs > 0 && attempt > 1) await sleep(jitter(paceMs));
    try {
      const r = await viaProxy(BASE + path, { method: 'POST', headers, body });
      const raw = await r.text();
      let data;
      try { data = JSON.parse(await gcmDecrypt(raw, KEY_TEXT)); }
      catch { try { data = JSON.parse(raw); } catch { lastErr = 'undecodable body'; continue; } }

      const msg = data && data.msg ? data.msg : '';
      // transient / rate-limit style messages -> retry on a fresh IP
      if (msg && /(已达上限|请求参数错误|频繁|失败|稍后|限流)/.test(msg) && attempt < retries) {
        onLog(`    ↻ ${path} retry ${attempt}/${retries}: ${msg}`);
        await sleep(jitter(2000, 1500));
        continue;
      }
      return data;
    } catch (e) {
      lastErr = e.message;
      if (attempt < retries) await sleep(jitter(1800, 1400));
    }
  }
  return { _error: lastErr || 'all retries exhausted' };
}

/**
 * Resolve a token for an account, re-logging in with password if stale.
 */
async function ensureToken(account) {
  // account: { account, password, deviceId, token }
  let ui = await api('/api/user/info', {}, { token: account.token, deviceId: account.deviceId });
  const stale = ui && ui.code === 1 && ui.data && ui.data.reason === 'token_invalid';
  if (!stale) return account.token;
  const lg = await api('/api/auth/login', { account: account.account, password: account.password, login_device_type: 'H' }, { deviceId: account.deviceId });
  const tk = lg && lg.data && lg.data.token;
  if (tk) account.token = tk;
  return tk;
}

module.exports = { api, setProxy, freshDeviceId, ensureToken, BASE, UA };
