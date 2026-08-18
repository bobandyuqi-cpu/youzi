const { gcmEncrypt, gcmDecrypt, KEY_TEXT } = require('./crypto.js');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = 'http://yznb.4y3d.cc';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const OUTDIR = __dirname + '/outputs';
fs.mkdirSync(OUTDIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Decrypt if possible; if response is already plaintext JSON, parse it directly.
async function api(p, bodyObj, tries = 4) {
  const body = await gcmEncrypt(JSON.stringify(bodyObj), KEY_TEXT);
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': UA, 'Referer': BASE + '/', 'Accept': '*/*' }, body });
      const raw = await r.text();
      console.log(`[api ${p}] try#${i} status=${r.status} len=${raw.length}`);
      // try decrypt (expected path)
      try {
        const plain = await gcmDecrypt(raw, KEY_TEXT);
        return JSON.parse(plain);
      } catch {
        // not encrypted -> plaintext JSON (rate-limit style error)
        return JSON.parse(raw);
      }
    } catch (e) {
      console.log(`[api ${p}] try#${i} error: ${e.message}`);
      if (i < tries) await sleep(2000);
    }
  }
  throw new Error('all api tries failed for ' + p);
}

(async () => {
  const id = Number(process.argv[2] || '426');
  const duration = process.argv[3] || '';
  const play = await api('/api/movie/play', { id });
  const pu = play.data && play.data.play_url;
  if (!pu) {
    console.error('no play_url; resp:', JSON.stringify(play).slice(0, 400));
    return;
  }
  console.log('PLAY_URL:', pu.slice(0, 90) + '...');

  const out = path.join(OUTDIR, `movie_${id}.mp4`);
  const durArg = duration ? ` -t ${duration}` : '';
  const cmd = `ffmpeg -y -headers "User-Agent: ${UA}" -i "${pu}"${durArg} -c copy -bsf:a aac_adtstoasc "${out}"`;
  console.log('RUN:', cmd.substr(0, 120) + '...');
  execSync(cmd, { stdio: 'inherit', timeout: 300000 });
  const stat = fs.statSync(out);
  console.log('DONE ->', out, stat.size, 'bytes');
})();
