const { gcmEncrypt, gcmDecrypt, KEY_TEXT } = require('./crypto.js');
const BASE = 'http://' + ['yznb', '4y3d', 'cc'].join('.');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
async function api(path, bodyObj, headers = {}) {
  const body = await gcmEncrypt(JSON.stringify(bodyObj), KEY_TEXT);
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': UA, 'Referer': BASE + '/', 'Accept': '*/*', ...headers }, body });
  const raw = await r.text();
  try { const plain = await gcmDecrypt(raw, KEY_TEXT); return { status: r.status, json: JSON.parse(plain) }; }
  catch (e) { return { status: r.status, raw }; }
}
(async () => {
  // movie id 426, vid_meida_id 1285
  const combos = [
    ['play-movieid426', '/api/movie/play', { id: 426 }],
    ['play-vid1285',  '/api/movie/play', { id: '1285' }],
    ['play-vid-media', '/api/movie/play', { vid: '1285' }],
    ['play-mediaid',  '/api/movie/play', { media_id: '1285' }],
    ['detail426',     '/api/movie/detail/v2', { id: 426 }],
  ];
  for (const [name, p, b] of combos) {
    const r = await api(p, b);
    console.log(`\n===== ${name} (${p}) status=${r.status} =====`);
    if (r.json) console.log(JSON.stringify(r.json).slice(0, 900));
    else console.log('raw:', r.raw.slice(0, 200));
  }
})();
