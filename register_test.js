const { gcmEncrypt, gcmDecrypt, KEY_TEXT } = require('./crypto.js');
const crypto = require('crypto');
const BASE = 'http://yznb.4y3d.cc';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function api(path, bodyObj, token, deviceId) {
  const body = await gcmEncrypt(JSON.stringify(bodyObj), KEY_TEXT);
  const h = { 'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': UA, 'Referer': BASE + '/', 'Accept': '*/*', 'X-Device-Id': deviceId };
  if (token) h['x-token'] = token;
  const r = await fetch(BASE + path, { method: 'POST', headers: h, body });
  const raw = await r.text();
  try { return { status: r.status, j: JSON.parse(await gcmDecrypt(raw, KEY_TEXT)) }; } catch { return { status: r.status, raw }; }
}

(async () => {
  const deviceId = 'dev-' + crypto.randomBytes(8).toString('hex');
  const account = 'zx' + Date.now().toString().slice(-10); // 6-16 alnum
  const password = 'Abcd' + crypto.randomBytes(4).toString('hex'); // alnum only
  console.log('device:', deviceId, '| account:', account);

  const reg = await api('/api/auth/reg', { account, password, verify_password: password, ch: '', invite_code: '', device_type: 'H', version: '0.0.0' }, null, deviceId);
  console.log('\n[reg]', reg.j ? JSON.stringify(reg.j).slice(0, 300) : reg.raw.slice(0,200));
  let token = reg.j && reg.j.data && (reg.j.data.token || (typeof reg.j.data === 'string' ? reg.j.data : ''));
  if (!token) {
    const login = await api('/api/auth/login', { account, password, login_device_type: 'H' }, null, deviceId);
    console.log('[login]', login.j ? JSON.stringify(login.j).slice(0, 400) : login.raw.slice(0,200));
    token = login.j && login.j.data && (login.j.data.token || (typeof login.j.data === 'string' ? login.j.data : ''));
  }
  if (token) {
    console.log('\nTOKEN:', token);
    const ui = await api('/api/user/info', {}, token, deviceId);
    console.log('[user/info]', ui.j ? JSON.stringify(ui.j).slice(0, 600) : ui.raw.slice(0,200));
    const wi = await api('/api/user/walletinfo', {}, token, deviceId);
    console.log('[walletinfo]', wi.j ? JSON.stringify(wi.j).slice(0, 600) : wi.raw.slice(0,200));
    const pc = await api('/api/pay/config', {}, token, deviceId);
    console.log('[pay/config]', pc.j ? JSON.stringify(pc.j).slice(0, 800) : pc.raw.slice(0,200));
    const ar = await api('/api/system/activity/rewards', {}, token, deviceId);
    console.log('[activity/rewards]', ar.j ? JSON.stringify(ar.j).slice(0, 800) : ar.raw.slice(0,200));
    const bl = await api('/api/coins/bought/list', { page: 1, module: 1 }, token, deviceId);
    console.log('[bought/list]', bl.j ? JSON.stringify(bl.j).slice(0, 300) : bl.raw.slice(0,200));
  } else {
    console.log('NO TOKEN obtained.');
  }
})();
