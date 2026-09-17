/**
 * Headless Chrome offline PWA smoke test via CDP (no puppeteer download).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createConnection } from 'node:net';

const PORT = 9333;
const ORIGIN = 'http://127.0.0.1:8765';
const PROFILE = '/tmp/sw-pwa-cdp-profile';

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(PROFILE, { recursive: true });

const waitPort = async (port, ms = 15000) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const ok = await new Promise((resolve) => {
      const s = createConnection({ host: '127.0.0.1', port }, () => {
        s.end();
        resolve(true);
      });
      s.on('error', () => resolve(false));
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`CDP port ${port} not open`);
};

const chrome = spawn(
  '/usr/local/bin/google-chrome',
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    'about:blank',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);

let stderr = '';
chrome.stderr.on('data', (d) => {
  stderr += d.toString();
});

const shutdown = () => {
  try {
    chrome.kill('SIGKILL');
  } catch {
    /* ignore */
  }
};

process.on('exit', shutdown);

try {
  await waitPort(PORT);
  const version = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json());
  const wsUrl = version.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const eventWaiters = [];

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    for (const waiter of [...eventWaiters]) {
      if (waiter.match(msg)) {
        eventWaiters.splice(eventWaiters.indexOf(waiter), 1);
        waiter.resolve(msg);
      }
    }
  });

  const send = (method, params = {}, sessionId) => {
    const id = nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  };

  const { targetId } = await send('Target.createTarget', { url: `${ORIGIN}/` });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const sessionSend = (method, params = {}) => send(method, params, sessionId);

  await sessionSend('Page.enable');
  await sessionSend('Runtime.enable');
  await sessionSend('ServiceWorker.enable');

  // Wait for document + game bundle to load and register SW.
  for (let i = 0; i < 40; i += 1) {
    const { result } = await sessionSend('Runtime.evaluate', {
      expression: `navigator.serviceWorker?.controller ? 'controlled' : (navigator.serviceWorker ? await navigator.serviceWorker.getRegistration().then(r => r ? (r.active ? 'active:'+r.active.state : 'reg') : 'none') : 'unsupported')`,
      awaitPromise: true,
      returnByValue: true,
    });
    const state = result.value;
    process.stdout.write(`SW state: ${state}\n`);
    if (state === 'controlled' || String(state).startsWith('active:activated')) break;
    // Force register if game hasn't yet (bundle may take a moment)
    if (i === 5) {
      await sessionSend('Runtime.evaluate', {
        expression: `navigator.serviceWorker.register('./sw.js', { scope: './' }).then(r => r.update()).then(() => 'registered').catch(e => String(e))`,
        awaitPromise: true,
        returnByValue: true,
      });
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  // Ensure activation / claim
  await sessionSend('Runtime.evaluate', {
    expression: `(async () => {
      const reg = await navigator.serviceWorker.ready;
      await new Promise(r => setTimeout(r, 500));
      return {
        scope: reg.scope,
        state: reg.active?.state,
        controlled: !!navigator.serviceWorker.controller,
        cacheKeys: await caches.keys(),
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  }).then(({ result }) => {
    console.log('Ready:', JSON.stringify(result.value, null, 2));
  });

  const cached = await sessionSend('Runtime.evaluate', {
    expression: `(async () => {
      const keys = await caches.keys();
      const cache = await caches.open(keys.find(k => k.startsWith('secret-wars-offline-')) || keys[0]);
      const reqs = await cache.keys();
      return reqs.map(r => r.url);
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('Cached URLs:', cached.result.value.length);
  for (const u of cached.result.value) console.log(' -', u);

  // Go offline and verify critical assets resolve from cache.
  await sessionSend('Network.enable');
  await sessionSend('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });

  const offlineChecks = await sessionSend('Runtime.evaluate', {
    expression: `(async () => {
      const paths = [
        './',
        './index.html',
        './assets/game.js',
        './assets/game.js?v=2ab964df',
        './assets/game.css',
        './assets/heroes/ninja.png',
        './assets/audio/music.mp3',
        './manifest.webmanifest',
      ];
      const out = [];
      for (const p of paths) {
        try {
          const res = await fetch(p);
          out.push({ p, ok: res.ok, status: res.status, type: res.headers.get('content-type') });
        } catch (e) {
          out.push({ p, ok: false, error: String(e) });
        }
      }
      return out;
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  console.log('Offline fetch results:');
  let failed = 0;
  for (const row of offlineChecks.result.value) {
    console.log(JSON.stringify(row));
    if (!row.ok) failed += 1;
  }

  // Reload while offline
  await sessionSend('Page.reload', { ignoreCache: false });
  await new Promise((r) => setTimeout(r, 2500));
  const afterReload = await sessionSend('Runtime.evaluate', {
    expression: `({ href: location.href, hasGame: !!document.querySelector('#game canvas') || !!window.secretWars, title: document.title })`,
    returnByValue: true,
  });
  console.log('Offline reload:', JSON.stringify(afterReload.result.value));

  ws.close();
  shutdown();

  if (failed > 0) {
    console.error(`FAIL: ${failed} offline fetches failed`);
    process.exit(1);
  }
  if (!afterReload.result.value.hasGame && afterReload.result.value.title !== 'Secret Wars') {
    console.error('FAIL: offline reload did not keep app shell');
    process.exit(1);
  }
  console.log('PASS: offline PWA smoke test');
  process.exit(0);
} catch (err) {
  console.error('TEST ERROR:', err);
  console.error(stderr.slice(-2000));
  shutdown();
  process.exit(1);
}
