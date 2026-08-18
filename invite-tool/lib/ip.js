/**
 * ip.js — Hiddify proxy detection + egress IP lookup.
 * We read the Windows system proxy (WinINET) to find Hiddify's local HTTP
 * proxy port, then verify it works by asking ip-api.com through it.
 */
const { fetch, ProxyAgent } = require('undici');
const { execSync } = require('child_process');

const DEFAULT_PORT = 12334; // Hiddify's usual local HTTP proxy port

function getSystemProxyPort() {
  try {
    const out = execSync(
      `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer`,
      { encoding: 'utf8' }
    );
    // e.g. "http://127.0.0.1:12334"
    const m = out.match(/127\.0\.0\.1:(\d+)/);
    if (m) return Number(m[1]);
  } catch (e) {
    // registry key missing
  }
  return DEFAULT_PORT;
}

function getSystemProxyEnabled() {
  try {
    const out = execSync(
      `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable`,
      { encoding: 'utf8' }
    );
    return /0x1/.test(out);
  } catch (e) {
    return false;
  }
}

async function queryEgressThroughProxy(proxyUrl) {
  const agent = new ProxyAgent(proxyUrl);
  try {
    const r = await fetch('http://ip-api.com/json/?fields=query,country,city,isp', {
      dispatcher: agent,
    });
    return await r.json();
  } finally {
    agent.close();
  }
}

/**
 * Detect an available Hiddify proxy.
 * Returns { ok, port, proxyUrl, ip } — ip is the egress info when working.
 */
async function detectProxy() {
  const enabled = getSystemProxyEnabled();
  const port = getSystemProxyPort();
  const proxyUrl = `http://127.0.0.1:${port}`;

  // try the configured port, plus a couple of common alternate ports
  const candidates = [port];
  if (!candidates.includes(DEFAULT_PORT)) candidates.push(DEFAULT_PORT);
  [1087, 7890, 2081].forEach((p) => { if (!candidates.includes(p)) candidates.push(p); });

  for (const p of candidates) {
    const url = `http://127.0.0.1:${p}`;
    try {
      const info = await queryEgressThroughProxy(url);
      if (info && info.query && !/^ERR/.test(info.query)) {
        return { ok: true, port: p, proxyUrl: url, ip: info, systemEnabled: enabled };
      }
    } catch (e) {
      // port not listening, try next
    }
  }
  return { ok: false, proxyUrl, ip: null, systemEnabled: enabled };
}

module.exports = { detectProxy, getSystemProxyPort, getSystemProxyEnabled };
