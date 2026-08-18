// Probe sublist with real typeid to get movie ids
const { gcmEncrypt, gcmDecrypt, KEY_TEXT } = require('./crypto.js');
const BASE = 'http://yznb.4y3d.cc';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function api(path, bodyObj, headers = {}) {
  const body = await gcmEncrypt(JSON.stringify(bodyObj), KEY_TEXT);
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': UA, 'Referer': BASE + '/', 'Accept': '*/*', ...headers }, body });
  const raw = await r.text();
  try { const plain = await gcmDecrypt(raw, KEY_TEXT); return { status: r.status, json: JSON.parse(plain) }; }
  catch (e) { return { status: r.status, raw }; }
}

(async () => {
  for (const typeid of [1, 4, 3]) {
    const r = await api('/api/movie/sublist/v2', { typeid, page_size: 3 });
    console.log(`\n===== typeid=${typeid} status=${r.status} =====`);
    if (r.json) {
      const d = r.json.data;
      console.log('keys:', Object.keys(d || {}));
      console.log('json:', JSON.stringify(r.json).slice(0, 1200));
    } else console.log('raw:', r.raw.slice(0, 200));
  }
})();
