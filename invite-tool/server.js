/**
 * server.js — local web UI for the auto-invite tool.
 * Run:  node server.js   then open http://127.0.0.1:5888
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { detectProxy } = require('./lib/ip.js');
const { setProxy } = require('./lib/api.js');
const { runInvite } = require('./lib/accounts.js');

const PORT = Number(process.env.PORT || 5888);
const ROOT = __dirname;
const accountsDir = path.join(ROOT, 'accounts');

// ---- state ----
let status = { proxy: null, running: false, log: [], last: null };

function pushLog(line) {
  const t = new Date().toISOString().slice(11, 19);
  status.log.push(`[${t}] ${line}`);
  if (status.log.length > 2000) status.log = status.log.slice(-2000);
}

function saveAccounts(result) {
  if (!status.last) return;
  fs.mkdirSync(accountsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(accountsDir, `run-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({ main: result.main, subs: result.subs.slice(0, 20) }, null, 2));
  pushLog(`凭证已保存: ${path.basename(file)}`);
}

// read all saved runs from accounts/ into a plain summary list (newest first)
function listHistory() {
  const runs = [];
  let files = [];
  try { files = fs.readdirSync(accountsDir).filter((f) => f.endsWith('.json')); } catch (e) { return runs; }
  for (const f of files) {
    const full = path.join(accountsDir, f);
    try {
      const raw = JSON.parse(fs.readFileSync(full, 'utf8'));
      const main = raw.main || {};
      const subs = Array.isArray(raw.subs) ? raw.subs : [];
      runs.push({
        file: f,
        fsTime: (() => { try { return fs.statSync(full).mtime.toISOString(); } catch { return null; } })(),
        main: main.account || (main.deviceId ? 'device' : ''),
        mainPwd: main.password || '',
        inviteCode: main.inviteCode || '',
        subCount: subs.length,
        subs: subs.map((s) => ({ account: s.account, password: s.password })),
      });
    } catch (e) { /* skip unreadable */ }
  }
  runs.sort((a, b) => (b.fsTime || '').localeCompare(a.fsTime || ''));
  return runs;
}

// ---- routing ----
function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.join(ROOT, 'public', urlPath);
  if (!file.startsWith(path.join(ROOT, 'public'))) return notFound(res);
  fs.readFile(file, (err, data) => {
    if (err) return notFound(res);
    const ext = path.extname(file);
    const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

function notFound(res) {
  res.writeHead(404); res.end('not found');
}
function json(res, obj, code = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function handleApi(req, res) {
  const url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/api/status') {
    return json(res, { proxy: status.proxy, running: status.running, log: status.log.slice(-400), last: status.last });
  }

  if (req.method === 'GET' && url === '/api/history') {
    return json(res, { runs: listHistory() });
  }

  if (req.method === 'POST' && url === '/api/proxy-check') {
    return (async () => {
      const det = await detectProxy();
      status.proxy = det;
      if (det.ok) setProxy(det.proxyUrl);
      pushLog(`代理检测: ${det.ok ? '✓ 已连接 ' + (det.ip ? det.ip.country + '/' + det.ip.city + ' ' + det.ip.query : '') : '✗ 未开启 Hiddify'}`);
      json(res, det);
    })();
  }

  if (req.method === 'POST' && url === '/api/invite') {
    if (status.running) return json(res, { ok: false, error: '已有任务在运行' });
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let n;
      try { n = Number(JSON.parse(body).n); } catch { n = null; }
      if (n !== 3 && n !== 7) return json(res, { ok: false, error: 'n 必须是 3 或 7' }, 400);
      kickOff(n, res);
    });
    return;
  }

  notFound(res);
}

function kickOff(n, res) {
  status.running = true;
  status.log = [];
  pushLog(`开始：邀请 ${n} 人`);
  json(res, { ok: true, started: true });

  (async () => {
    try {
      // require working proxy for a fresh registration each run
      const det = await detectProxy();
      status.proxy = det;
      if (!det.ok) {
        pushLog('✗ Hiddify 代理未开启，任务中止。请先打开 Hiddify 再重试。');
        status.running = false;
        return;
      }
      setProxy(det.proxyUrl);
      pushLog(`✓ 代理就绪 (${det.ip.country}/${det.ip.city} ${det.ip.query})`);

      const result = await runInvite(n, { onLog: pushLog });
      status.last = { n, time: new Date().toISOString(), resultOk: result.ok, summary: {
        invited: result.invitedOk,
        verified: result.verified,
        main: result.main ? result.main.account : null,
      } };
      if (result.main) saveAccounts(result);
      pushLog(result.ok ? `✅ 邀请 ${n} 人完成` : `⚠️ 进度 ${result.invitedOk}/${n}（部分成功）`);
    } catch (e) {
      pushLog('❌ 异常: ' + e.message);
    } finally {
      status.running = false;
    }
  })();
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return handleApi(req, res);
  serveStatic(req, res);
});

function startServer({ onReady } = {}) {
  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`\n  Auto-Invite Tool 已启动`);
      console.log(`  用浏览器打开:  http://127.0.0.1:${PORT}`);
      console.log(`  按 Ctrl+C 退出\n`);
      detectProxy().then((det) => {
        status.proxy = det;
        if (det.ok) setProxy(det.proxyUrl);
      });
      resolve();
      if (onReady) onReady(PORT);
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { server, startServer, pushLog };
