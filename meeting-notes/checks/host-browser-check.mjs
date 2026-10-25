import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { transcribeFile } from '../backend/speech.mjs';

const root = process.env.STUDIO5_ROOT;
if (!root) throw new Error('Run current-sdk-check.mjs to prepare the verified platform snapshot.');
const load = name => import(pathToFileURL(`${root}/${name}`).href);
const { createPluginFrames } = await load('scripts/lib/app-runtime/plugin-frames.mjs');
const { createAppServe } = await load('scripts/lib/blocks/app-serve.mjs');
const { installPlugin } = await load('scripts/lib/blocks/plugin-install.mjs');
const { loadRegistry } = await load('scripts/lib/blocks/registry.mjs');
const { assembleSdk } = await load('scripts/build-sdk.mjs');
const { platformViteConfig } = await load('scripts/start-platform.mjs');
const { createOpaqueDocsFixture } = await load('scripts/diagnostics/opaque-docs-fixture.mjs');
const require = createRequire(`${root}/package.json`);
const { build } = require('esbuild');
const puppeteer = require('puppeteer-core');
const scratch = await mkdtemp(`${process.env.TMPDIR || `${root}/`}/meeting-host-`);
let browser;
let server;
try {
  const blocksDir = `${scratch}/blocks`;
  const allowedOrigins = new Set();
  const fixture = await createOpaqueDocsFixture(`${scratch}/docs`, allowedOrigins, { pluginTitle: () => 'Meeting notes' });
  await installPlugin({ source: fileURLToPath(new URL('../plugin/meeting-notes/', import.meta.url)), blocksDir,
    appDataRoot: `${scratch}/data`, blobRoot: `${scratch}/blob` });
  const app = createAppServe({ blocksDir });
  const manifest = loadRegistry(blocksDir, { quiet: true }).find(entry => entry.id === 'meeting-notes');
  assert.equal(manifest.uses['audio-record'], true);
  assert.deepEqual(manifest.uses['studio-docs'], { access: 'read' });
  const bundle = await build({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {AppBlockView} from './src/AppBlockView';
    import {installPluginBridge} from './src/plugin-bridge';
    import {AudioRecordDialog} from './src/AudioRecordDialog';
    const frames=new Map(); const register=(id,el)=>el?frames.set(id,el):frames.delete(id);
    const host=document.createElement('div'); document.body.appendChild(host);
    let dialog=null, pending=null;
    const close=value=>{dialog?.unmount();dialog=null;const resolve=pending;pending=null;resolve?.(value)};
    const args=[id=>frames.get(id)?.contentWindow,()=>{},()=>Promise.resolve(false),
      win=>[...frames].find(([,el])=>el.contentWindow===win)?.[0]??null,()=>{},()=>[...frames.keys()],id=>frames.get(id)??null,
      ()=>({project_handle:'h-a',project_key:'project-a',name:'Project A'})];
    args[26]=()=>(${JSON.stringify(manifest.uses['studio-docs'])});
    args[34]=()=>true;
    args[35]=request=>new Promise(resolve=>{pending=resolve;dialog=createRoot(host);
      dialog.render(React.createElement(AudioRecordDialog,{request,pluginTitle:'Meeting notes',onClose:close}));});
    args[36]=()=>close(null);
    window.bridge=installPluginBridge(...args);
    createRoot(document.getElementById('root')).render(React.createElement(AppBlockView,
      {id:'meeting-notes',title:'Meeting notes',registerFrame:register}));
    `, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, format: 'esm', platform: 'browser',
    logLevel: 'silent', define: { 'process.env.NODE_ENV': '"production"' } });
  const frames = createPluginFrames({ requireSession: fixture.requireSession,
    snapshot: (_session, kind, id) => kind === 'installed' ? app.snapshot(id) : null, allowedOrigins });
  const policy = platformViteConfig(() => {}, false, 'local', 'user', {}).preview.headers['Content-Security-Policy'];
  const reads = [];
  server = createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path.startsWith('/api/plugin-frames') || path.startsWith('/plugin-assets/')) { void frames.handle(req, res, path); return; }
    if (path.startsWith('/api/docs/')) {
      if (path.endsWith('/content')) reads.push(req.url);
      try { void fixture.docs.handle(req, res, path, fixture.requireSession(req)); } catch { res.writeHead(401).end(); }
      return;
    }
    if (path === '/host.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].contents); return; }
    if (path === '/studio-plugin.js') { res.setHeader('Content-Type', 'text/javascript'); res.setHeader('Access-Control-Allow-Origin', '*'); res.end(assembleSdk()); return; }
    if (['/studio-kit.css', '/styles.css', '/design-tokens.css'].includes(path)) {
      res.setHeader('Content-Type', 'text/css'); res.setHeader('Access-Control-Allow-Origin', '*');
      void readFile(`${root}/src${path}`).then(bytes => res.end(bytes)); return;
    }
    if (path.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(path === '/api/me' ? { user_id: fixture.requireSession(req).userId } : { records: [], items: [], projects: [] })); return;
    }
    res.setHeader('Content-Type', 'text/html'); res.setHeader('Content-Security-Policy', policy);
    res.end('<link rel="stylesheet" href="/styles.css"><div id="root"></div><script type="module" src="/host.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://localhost:${server.address().port}`;
  allowedOrigins.add(origin);
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_FOR_TESTING, headless: true,
    userDataDir: `${scratch}/profile`, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluateOnNewDocument(() => {
    window.captureTracks = [];
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async options => {
      const stream = await original(options); window.captureTracks.push(...stream.getTracks()); return stream;
    };
  });
  await page.setCookie({ ...fixture.cookieFor('A'), url: origin, secure: true, httpOnly: true, path: '/' });
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector('iframe')?.src.includes('/plugin-assets/'));
  const frame = page.frames().find(candidate => candidate.url().includes('/plugin-assets/'));
  assert.ok(frame);
  await frame.waitForSelector('#record-start:not([disabled])');
  assert.equal(await frame.evaluate(() => window.origin), 'null');
  const clickHost = async label => {
    for (const button of await page.$$('.audio-record-dialog button')) {
      if (await button.evaluate(el => el.textContent) === label) { await button.click(); return; }
    }
    throw new Error(`Missing host button: ${label}`);
  };
  await frame.click('#record-start');
  await page.waitForSelector('.audio-record-dialog');
  await clickHost('取消');
  await frame.waitForSelector('#record-start:not([disabled])');
  assert.equal(reads.length, 0, 'Cancelled recording must not fetch a document.');
  await frame.click('#record-start');
  await page.waitForSelector('.audio-record-dialog');
  await clickHost('開始錄音');
  await page.waitForSelector('.audio-record-dot.is-live');
  await page.waitForFunction(() => document.querySelector('.audio-record-time').textContent !== '00:00');
  await clickHost('停止並儲存');
  await frame.waitForSelector('#recording-preview:not([hidden])', { timeout: 30000 });
  assert.equal(await page.evaluate(() => window.captureTracks.every(track => track.readyState === 'ended')), true);
  assert.equal(reads.length, 1, 'Consumer must read the saved recording through the real docs bridge.');
  assert.match(reads[0], /version=1/);
  assert.match(reads[0], /project_handle=h-a/);
  const bytes = await frame.evaluate(async () => Array.from(new Uint8Array(await (await fetch(document.querySelector('#recording-preview').src)).arrayBuffer())));
  assert.ok(bytes.length > 1000);
  await writeFile(`${scratch}/recording.webm`, Buffer.from(bytes));
  await mkdir(`${scratch}/decoded`);
  await transcribeFile(`${scratch}/recording.webm`, `${scratch}/decoded`, { maxSpeakers: 2, keywords: [] }, {
    endpoint: 'https://check.cognitiveservices.azure.com/', key: 'test-only', signal: AbortSignal.timeout(15000),
    fetchImpl: async () => Response.json({ durationMilliseconds: 1000,
      phrases: [{ text: 'Synthetic test.', offsetMilliseconds: 0, durationMilliseconds: 900, speaker: 0 }] }),
  });
  assert.deepEqual(errors, []);
  console.log('Opaque-frame integration passed: actual meeting-notes, current SDK/bridge/host dialog, cancellation, fake-mic capture, real docs save/versioned read, preview, track release and ffmpeg decode. No production login or real microphone used.');
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, { recursive: true, force: true });
}
