/**
 * start.js — one-click entry: start the server, then auto-open the browser.
 * Run:  node start.js
 * All logic lives here in one node process (no fragile cmd start/timeout).
 */
const { exec, spawn } = require('child_process');
const path = require('path');

(async () => {
  // 1) start the server (and wait until it's really listening)
  const { startServer } = require('./server.js');

  let opened = false;
  const openBrowser = (url) => {
    if (opened) return; // only open once
    opened = true;
    try {
      if (process.platform === 'win32') {
        exec(`start "" "${url}"`, { windowsHide: true });
        // second way: try powershell as a fallback
        try { spawn('powershell', ['-NoProfile', '-Command', `Start-Process '${url}'`], { stdio: 'ignore', detached: true, windowsHide: true }).unref(); } catch (e) {}
      } else if (process.platform === 'darwin') {
        spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
      } else {
        spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
      }
    } catch (e) {
      console.log('⚠️ 未能自动打开浏览器，请手动访问: ' + url);
    }
  };

  await startServer({ onReady: (port) => {
    const url = `http://127.0.0.1:${port}`;
    openBrowser(url);
    console.log('  浏览器已自动打开（如未弹出，请手动访问 ' + url + '）');
  } });
  console.log('  关闭此窗口即停止工具。');
})();
