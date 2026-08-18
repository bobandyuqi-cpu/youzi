const { gcmEncrypt, gcmDecrypt, KEY_TEXT } = require('./crypto.js');
const BASE = 'http://' + ['yznb', '4y3d', 'cc'].join('.');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TOKEN = process.env.TOKEN;
const DEV = 'dev-6dd3d285c77b554d';
async function api(path, bodyObj) {
  const body = await gcmEncrypt(JSON.stringify(bodyObj), KEY_TEXT);
  const h = { 'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': UA, 'Referer': BASE + '/', 'Accept': '*/*', 'X-Device-Id': DEV };
  if (TOKEN) h['x-token'] = TOKEN;
  const r = await fetch(BASE + path, { method: 'POST', headers: h, body });
  const raw = await r.text();
  try { return { status: r.status, j: JSON.parse(await gcmDecrypt(raw, KEY_TEXT)) }; } catch { return { status: r.status, raw }; }
}
(async () => {
  console.log('=== wallet before ===');
  let w = await api('/api/user/walletinfo', {});
  console.log(w.j ? JSON.stringify(w.j) : w.raw.slice(0,150));

  console.log('\n=== checkin /api/user/signup ===');
  let s = await api('/api/user/signup', {});
  console.log(s.j ? JSON.stringify(s.j).slice(0,300) : s.raw.slice(0,150));

  console.log('\n=== wallet after checkin ===');
  w = await api('/api/user/walletinfo', {});
  console.log(w.j ? JSON.stringify(w.j) : w.raw.slice(0,150));

  console.log('\n=== detail paid movie 373 ===');
  let d = await api('/api/movie/detail/v2', { id: 373 });
  console.log(d.j ? `has_play_permission=${d.j.data.has_play_permission} is_preview=${d.j.data.is_preview} price=${d.j.data.price}` : d.raw.slice(0,150));

  console.log('\n=== buy /api/movie/do/buy 373 ===');
  let b = await api('/api/movie/do/buy', { id: 373 });
  console.log(b.j ? JSON.stringify(b.j).slice(0,400) : b.raw.slice(0,150));

  console.log('\n=== wallet after buy ===');
  w = await api('/api/user/walletinfo', {});
  console.log(w.j ? JSON.stringify(w.j) : w.raw.slice(0,150));

  console.log('\n=== play 373 after buy ===');
  let p = await api('/api/movie/play', { id: 373 });
  console.log(p.j ? JSON.stringify(p.j).slice(0,600) : p.raw.slice(0,150));
})();
