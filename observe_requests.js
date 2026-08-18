// observe_requests.js
// Launches system Chrome (headless) via puppeteer-core, loads the SPA, and
// records every network request's URL / method / POST body / response status.
// Deliberately does NOT touch downstream responses (no video consuming),
// and does not navigate into play pages or category menus.
const puppeteer = require('puppeteer-core');

const TARGET = process.env.TARGET || 'http://yznb.4y3d.cc/';
const CHROME = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const OUT = __dirname + '\\captured_requests.jsonl';

const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
  );

  const interesting = (u) => u.includes('/api/') || u.includes('.m3u8') || u.includes('.mp4');

  page.on('request', (req) => {
    const u = req.url();
    if (!interesting(u)) return;
    let body = null;
    try {
      const pd = req.postData();
      if (pd) {
        // try JSON, else keep raw (usually urlencoded)
        try { body = { json: JSON.parse(pd) }; }
        catch { body = { raw: pd }; }
      }
    } catch {}
    const rec = {
      t: new Date().toISOString(),
      method: req.method(),
      url: u,
      body,
      resourceType: req.resourceType(),
    };
    fs.appendFileSync(OUT, JSON.stringify(rec) + '\n');
  });

  // Record response status for interesting requests
  page.on('response', (res) => {
    const u = res.url();
    if (!interesting(u)) return;
    fs.appendFileSync(OUT, JSON.stringify({ t: new Date().toISOString(), type: 'response', status: res.status(), url: u, contentType: res.headers()['content-type'] || '' }) + '\n');
  });

  console.log('loading', TARGET);
  try {
    await page.goto(TARGET, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch (e) {
    console.error('goto warn:', e.message);
  }
  // give the SPA a few extra seconds to fire its startup/ads/menus requests
  await new Promise((r) => setTimeout(r, 6000));

  // Grab the final document location in case the SPA rebased itself
  const loc = await page.evaluate(() => ({ href: location.href, origin: location.origin }));
  fs.appendFileSync(OUT, JSON.stringify({ t: new Date().toISOString(), type: 'final_location', loc }) + '\n');
  console.log('captured ->', OUT);
  console.log('final loc:', JSON.stringify(loc));

  await browser.close();
})();
