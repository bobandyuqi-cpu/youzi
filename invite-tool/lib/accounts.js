/**
 * accounts.js — the business logic: register a fresh main (inviter) account,
 * read its invite_code, register N sub (invitee) accounts that each bind to
 * the main's code, and verify the main's invite count + coins + VIP.
 */
const crypto = require('crypto');
const { api, freshDeviceId } = require('./api.js');

const randAccount = (prefix) => prefix + Date.now().toString().slice(-8) + crypto.randomBytes(2).toString('hex');
const randPwd = () => 'Ab' + crypto.randomBytes(5).toString('hex');

/**
 * Register a brand-new account.
 * @returns {object|null} { account, password, deviceId, token, reg } or null
 */
async function createAccount(prefix, inviteCode, onLog) {
  const deviceId = freshDeviceId();
  const account = randAccount(prefix);
  const password = randPwd();

  const reg = await api('/api/auth/reg', {
    account, password, verify_password: password, ch: '',
    invite_code: inviteCode || '', device_type: 'H', version: '0.0.0',
  }, { deviceId, retries: 7, paceMs: 2200, onLog });

  let token = reg && reg.data && (reg.data.token || (typeof reg.data === 'string' ? reg.data : ''));
  // some responses put an id string instead of a token — login as fallback
  if (!token) {
    const login = await api('/api/auth/login', { account, password, login_device_type: 'H' }, { deviceId, retries: 5, paceMs: 1600, onLog });
    token = login && login.data && (login.data.token || (typeof login.data === 'string' ? login.data : ''));
  }
  if (!token) return null;
  return { account, password, deviceId, token, reg };
}

/**
 * Run the full invite run.
 * @param {number} n    number of subs to invite (3 or 7)
 * @param {object} opts { onLog }
 * @returns {object} result summary
 */
async function runInvite(n, opts = {}) {
  const onLog = opts.onLog || (() => {});
  const steps = {};

  // ---- 1) register MAIN ----
  onLog(`创建主账号...`);
  const main = await createAccount('mst', '', onLog);
  if (!main) {
    onLog('✗ 主账号创建失败（代理可能未开，或 IP 今日注册已满）');
    return { ok: false, reason: 'main_register_failed', main: null, subs: [] };
  }
  steps.main = main;
  onLog(`✓ 主账号: ${main.account}  (device ${main.deviceId.slice(0, 14)}…)`);

  // ---- 2) read invite code ----
  const ui = await api('/api/user/info', {}, { token: main.token, deviceId: main.deviceId, retries: 5, paceMs: 1800, onLog });
  const inviteCode = ui && ui.data && ui.data.invite_code;
  if (!inviteCode) {
    onLog(`✗ 读取主账号邀请码失败: ${JSON.stringify(ui).slice(0, 150)}`);
    return { ok: false, reason: 'invite_code_read_failed', main, subs: [] };
  }
  main.inviteCode = inviteCode;
  onLog(`✓ 主账号邀请码: ${inviteCode}`);
  onLog(`✓ 邀请链接: ${ui.data.invite_link || '(已生成)'}`);

  // ---- 3) register SUBS, each bound to the main's code ----
  const subs = [];
  onLog(`开始邀请 ${n} 人...`);
  for (let i = 0; i < n; i++) {
    onLog(`  第 ${i + 1}/${n} 人…`);
    const sub = await createAccount('inv', inviteCode, onLog);
    if (!sub) {
      onLog(`      ✗ 第 ${i + 1} 人注册失败，跳过`);
      continue;
    }
    sub.inviteCode = inviteCode;
    subs.push(sub);
    onLog(`      ✓ ${sub.account} 已受邀绑定`);
    // randomized pacing between subs
    if (i < n - 1) await new Promise((r) => setTimeout(r, 1500 + Math.floor(Math.random() * 1500)));
  }

  // ---- 4) verify main state ----
  onLog(`校验结果...`);
  const final = await api('/api/user/info', {}, { token: main.token, deviceId: main.deviceId, retries: 5, paceMs: 1800, onLog });
  const fdata = final && final.data;
  const verified = fdata ? {
    invite: fdata.invite ?? 0,
    coins: fdata.coins ?? 0,
    vip_level: fdata.vip_level ?? 0,
    vip_end: fdata.vip_end_time ? new Date(fdata.vip_end_time * 1000).toISOString() : 0,
    invite_code: fdata.invite_code,
  } : null;

  const summary = {
    ok: verified && verified.invite >= n,
    main,
    subs,
    verified,
    invitedOk: subs.length,
  };
  onLog(`完成：主账号已邀 ${verified ? verified.invite : '?'} 人，金币 ${verified ? verified.coins : '?'}，VIP Lv.${verified ? verified.vip_level : '?'}`);
  return summary;
}

module.exports = { runInvite, createAccount };
