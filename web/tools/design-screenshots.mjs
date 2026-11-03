// Full-page screenshots of public pages at desktop, tablet and phone widths.
//   node tools/design-screenshots.mjs <base-url> <output-dir> <prefix> [browser-binary]
// Uses a headless Chromium-family browser over the DevTools protocol (Node's built-in
// WebSocket); nothing is installed. Example:
//   direnv exec web node web/tools/design-screenshots.mjs http://127.0.0.1:4191 previews design-pass-before
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, outDir, prefix, binary = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'] = process.argv.slice(2);
if (!base || !outDir || !prefix || process.argv.length > 6) throw new Error('usage: design-screenshots.mjs <base-url> <output-dir> <prefix> [browser-binary]');
let origin;
try { origin = new URL(base); } catch { throw new Error('Use a plain loopback HTTP origin.'); }
if (origin.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) ||
    origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
    !/^[a-zA-Z0-9_-]+$/.test(prefix)) throw new Error('Use a plain loopback HTTP origin and a filename-safe prefix.');

const pages = { home: '/', events: '/events/', newsletter: '/newsletter/', archive: '/shows-archive/', shop: '/merchandise/', donate: '/donate/' };
const widths = { desktop: 1280, tablet: 901, mobile: 375, narrow: 320 };
const profile = mkdtempSync(join(tmpdir(), 'terrace-shots-'));
mkdirSync(outDir, { recursive: true });

const browser = spawn(binary, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });

let launchFailed = false;
browser.once('error', () => { launchFailed = true; });

async function target() {
  for (let i = 0; i < 100; i++) {
    if (launchFailed || browser.exitCode !== null || browser.signalCode !== null) throw new Error('browser did not start');
    try {
      const port = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
      const list = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(1000) })).json();
      const page = list.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('browser did not start');
}

let ws;
try {
  ws = new WebSocket(await target());
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('browser connection timed out')), 15000);
    ws.onopen = () => { clearTimeout(timeout); resolve(); };
    ws.onerror = () => { clearTimeout(timeout); reject(new Error('browser connection failed')); };
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    const complete = pending.get(message.id);
    pending.delete(message.id);
    complete?.(message);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    const timeout = setTimeout(() => { pending.delete(n); reject(new Error('browser command timed out')); }, 15000);
    pending.set(n, m => { clearTimeout(timeout); m.error ? reject(new Error('browser command failed')) : resolve(m.result); });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const wait = ms => new Promise(r => setTimeout(r, ms));

  const report = [];
  for (const [device, width] of Object.entries(widths)) {
    for (const [name, path] of Object.entries(pages)) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width <= 375 });
      await send('Page.navigate', { url: new URL(path, base).href });
      await wait(2500);
      // Force lazy images to load and wait until every image has decoded.
      await send('Runtime.evaluate', { awaitPromise: true, expression: `(async()=>{await document.fonts.ready;const imgs=[...document.images];imgs.forEach(i=>{i.loading='eager'});await Promise.all(imgs.map(i=>i.decode().catch(()=>{})));scrollTo(0,0)})()` });
      await wait(800);
      const { result } = await send('Runtime.evaluate', { expression: 'document.documentElement.scrollHeight' });
      if (!Number.isFinite(result.value) || result.value <= 0 || result.value > 16000) throw new Error('page exceeds screenshot size limits');
      const height = result.value;
      const audit = await send('Runtime.evaluate', { returnByValue: true, expression: `({scrollWidth:document.documentElement.scrollWidth,h1Count:document.querySelectorAll('h1').length,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length,unnamedImages:[...document.images].filter(i=>!i.hasAttribute('alt')).length})` });
      report.push({ page: name, device, width, height, ...audit.result.value });
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 375 });
      await wait(500);
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const file = join(outDir, `${prefix}-${name}-${device}.png`);
      writeFileSync(file, Buffer.from(data, 'base64'));
      console.log(file, `${width}x${height}`);
    }
  }
  writeFileSync(join(outDir, `${prefix}-layout.json`), JSON.stringify(report, null, 2) + '\n');
} finally {
  ws?.close();
  if (browser.pid && browser.exitCode === null && browser.signalCode === null) {
    await new Promise(resolve => {
      const timeout = setTimeout(() => browser.kill('SIGKILL'), 5000);
      browser.once('exit', () => { clearTimeout(timeout); resolve(); });
      browser.kill();
    });
  }
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
