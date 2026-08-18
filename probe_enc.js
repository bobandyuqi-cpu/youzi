// Probe target API with AES-GCM encrypted body
const { gcmEncrypt, gcmDecrypt, KEY_TEXT } = require('./crypto.js');

const BASE = 'http://' + ['yznb', '4y3d', 'cc'].join('.');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function api(path, bodyObj, headers = {}) {
  const body = await gcmEncrypt(JSON.stringify(bodyObj), KEY_TEXT);
  const h = {
    'Content-Type': 'text/plain;charset=UTF-8',
    'User-Agent': UA,
    'Referer': BASE + '/',
    'Accept': '*/*',
    ...headers,
  };
  const r = await fetch(BASE + path, { method: 'POST', headers: h, body });
  const raw = await r.text();
  console.log(`[${path}] status=${r.status} len=${raw.length}`);
  if (!raw) { console.log('  (empty body)'); return null; }
  try {
    const plain = await gcmDecrypt(raw, KEY_TEXT);
    console.log('  >>', plain.slice(0, 1000));
    return JSON.parse(plain);
  } catch (e) {
    console.log('  [raw not encrypted]', raw.slice(0, 300));
    return null;
  }
}

(async () => {
  console.log('=== movie/play id=1 (no token) ===');
  await api('/api/movie/play', { id: '1' });

  console.log('\n=== movie/detail/v2 id=1 ===');
  await api('/api/movie/detail/v2', { id: '1' });

  console.log('\n=== system/menus ===');
  await api('/api/system/menus', {});

  console.log('\n=== system/startup/v2 ===');
  await api('/api/system/startup/v2', {});
})();
