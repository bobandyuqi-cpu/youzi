/**
 * start.js — one-click entry: ensure deps, start the server, then auto-open the browser.
 * Run:  node start.js
 * All logic lives here in one node process (no fragile cmd start/timeout).
 */
const { exec, spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..'); // 项目根目录（package.json 所在处）

// 依赖缺失时自动 npm install（首次下载/克隆后无需手动装）
function ensureDeps() {
  try {
    require.resolve('undici');
    return true;
  } catch (e) {
    return false;
  }
}

(async () => {
  // 0) 首次运行自动安装依赖
  if (!ensureDeps()) {
    console.log('  检测到缺少依赖，正在自动安装（npm install）...');
    try {
      execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
    } catch (e) {
      console.log('  ⚠️ 自动安装失败，请手动在项目根目录执行: npm install');
      console.log('     然后重新运行本工具。');
      process.exit(1);
    }
    console.log('  依赖安装完成。');
  }

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
