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
async function grab(url, name) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': BASE + '/' } });
    const t = await r.text();
    console.log(`\n===== M3U8 ${name} status=${r.status} ====`);
    console.log(t.split('\n').filter(l => l.trim() && !l.startsWith('#') ? '[ts] '+l : '  '+l).slice(0, 25).join('\n'));
  } catch (e) { console.log(`m3u8 ${name} fail: ${e.message}`); }
}
(async () => {
  // free movie 426
  const free = await api('/api/movie/play', { id: 426 });
  if (free.json) {
    const pu = free.json.data.play_url;
    console.log('FREE play_url:', pu);
    await grab(pu, 'free-426');
  }
  // find a PAID movie (price>0) from a list
  const sub = await api('/api/movie/sublist/v2', { typeid: 3, page_size: 10 });
  if (sub.json) {
    const paid = sub.json.data.list.find(x => Number(x.price) > 0);
    console.log('\nPAID example:', paid ? paid.id + ' price=' + paid.price + ' ' + paid.title : '(none in first 10)');
    if (paid) {
      const p = await api('/api/movie/play', { id: paid.id });
      console.log('PAID movie/play resp:', p.json ? JSON.stringify(p.json).slice(0, 400) : p.raw.slice(0,200));
      if (p.json && p.json.data && p.json.data.play_url) await grab(p.json.data.play_url, 'paid-'+paid.id);
    }
  }
})();
