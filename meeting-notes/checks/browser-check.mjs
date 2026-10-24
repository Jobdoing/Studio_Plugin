import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { transcribeFile } from '../backend/speech.mjs';

const studioRoot = process.env.STUDIO5_ROOT;
if (!studioRoot) throw new Error('Run current-sdk-check.mjs to prepare a verified origin/main snapshot, or set STUDIO5_ROOT explicitly.');
const { default: puppeteer } = createRequire(`${studioRoot}/package.json`)('puppeteer-core');
const executablePath = process.env.CHROME_FOR_TESTING || '/Volumes/Vibe-Temp/browsers/chrome/mac_arm-154.0.8037.92/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const root = existsSync('/Volumes/Vibe-Temp') ? '/Volumes/Vibe-Temp/meeting-notes/checks' : new URL('../.tmp/checks', import.meta.url).pathname;
await mkdir(root, { recursive: true });
const scratch = await mkdtemp(`${root}/browser-`);
const fixture = JSON.parse(await readFile(new URL('./transcript.json', import.meta.url), 'utf8'));
const copy = JSON.parse(await readFile(new URL('../plugin/meeting-notes/content.zh-Hant.json', import.meta.url), 'utf8'));
const plugin = new URL('../plugin/meeting-notes/', import.meta.url).pathname;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/studio-plugin.js' || path === '/favicon.ico') return res.writeHead(200).end('');
  const shared = ['/studio-kit.css', '/design-tokens.css'].includes(path);
  const target = shared ? `${studioRoot}/src${path}` : resolve(plugin, `.${path === '/' ? '/index.html' : path}`);
  if (!shared && !target.startsWith(plugin)) return res.writeHead(404).end();
  try {
    const content = await readFile(target);
    res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[extname(target)] || 'application/octet-stream' }).end(content);
  } catch { res.writeHead(404).end(); }
});
let browser;
try {
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  browser = await puppeteer.launch({ executablePath, headless: true, userDataDir: `${scratch}/profile`, args: ['--disable-dev-shm-usage', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'], env: { ...process.env, TMPDIR: scratch } });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 950 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`); });
  await page.evaluateOnNewDocument(({ raw, summary }) => {
    const state = window.testState = { project: { project_handle: 'p1', project_key: 'key1', name: 'Test project' }, records: [], calls: [], downloads: [], conflicts: {}, conflictChoice: 'later', failSave: false, failAI: false, holdAI: false, dirty: false };
    window.studio = {
      project: async () => state.project,
      onProjectChange: callback => { state.switchProject = async next => { state.project = next; await callback(next); }; },
      onCanClose: callback => { state.canClose = callback; },
      dirty: value => { state.dirty = value; }, confirm: async () => true,
      download: async (name, content) => { state.downloads.push({ name, content }); },
      records: {
        list: async (_, options) => {
          if (options.select || options.scope !== 'project' || !options.project_handle) throw new Error('INVALID_LIST_CONTRACT');
          return structuredClone(state.records.filter(record => record.handle === options.project_handle));
        },
        get: async (_, id) => structuredClone(state.records.find(record => record.record_id === id)),
        create: async (_, value) => {
          if (state.failSave) throw new Error('VERSION_CONFLICT');
          const record = { record_id: `r${state.records.length + 1}`, version: 1, schema: value.schema, handle: value.project_handle, body: structuredClone(value.body) };
          state.records.push(record); return structuredClone(record);
        },
        update: async (_, id, value) => {
          const record = state.records.find(item => item.record_id === id);
          if (state.failSave) throw Object.assign(new Error('VERSION_CONFLICT'), { collection: 'meetings', record_id: id, current: structuredClone(record) });
          if (record.version !== value.version) throw new Error('VERSION_CONFLICT');
          Object.assign(record, { version: record.version + 1, body: structuredClone(value.body) });
          delete state.conflicts[id];
          return structuredClone(record);
        },
      },
      sync: {
        savedConflict: async (_, id) => state.conflicts[id] || null,
        resolveConflict: async (error, options) => {
          state.calls.push({ type: 'conflict', choice: state.conflictChoice });
          const record = state.records.find(item => item.record_id === error.record_id);
          state.conflicts[error.record_id] = structuredClone(options);
          if (state.conflictChoice === 'later') return { choice: 'later' };
          if (state.conflictChoice === 'mine') Object.assign(record, { version: record.version + 1, body: structuredClone(options.mine) });
          delete state.conflicts[error.record_id];
          return { choice: state.conflictChoice, record: structuredClone(record) };
        },
        resumeConflict: async (_, id) => {
          state.calls.push({ type: 'resume' });
          const options = state.conflicts[id];
          if (state.conflictChoice === 'later') return { choice: 'later' };
          const record = state.records.find(item => item.record_id === id);
          if (state.conflictChoice === 'mine') Object.assign(record, { version: record.version + 1, body: structuredClone(options.mine) });
          delete state.conflicts[id];
          return { choice: state.conflictChoice, record: structuredClone(record) };
        },
      },
      backend: { fetch: async (path, init) => {
        state.calls.push({ type: 'backend', path, project: init.project_handle });
        if (path === 'jobs') return Response.json({ id: 'job1' });
        if (init.method === 'DELETE') return Response.json({ removed: true });
        if (path.endsWith('/start')) return Response.json({ status: 'transcribing' });
        if (path.includes('/chunk')) return Response.json({ offset: 48044 });
        return Response.json({ status: 'complete', result: raw });
      } },
      ai: { complete: async request => {
        state.calls.push({ type: 'ai', project: state.project.project_handle, request });
        if (state.failAI) throw new Error('MODEL_UNAVAILABLE');
        if (state.holdAI) await new Promise(resolveAI => { state.releaseAI = resolveAI; });
        const data = JSON.parse(request.input);
        return { json: data.targets ? { segments: data.targets.map(({ id, text }) => ({ id, text })) } : summary };
      } },
    };
  }, fixture);
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !document.querySelector('#meeting-title').disabled);
  assert.ok(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()));
  assert.equal(await page.$eval('#summarize', el => el.disabled), true);
  assert.equal(await page.$eval('#record-start', el => el.disabled), false);
  const wave = Buffer.alloc(48044);
  wave.write('RIFF'); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8);
  wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(24000, 24); wave.writeUInt32LE(48000, 28); wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34); wave.write('data', 36); wave.writeUInt32LE(48000, 40);
  await writeFile(`${scratch}/test.wav`, wave);
  await page.type('#meeting-title', 'Meeting <img src=x onerror=alert(1)>');
  await (await page.$('#audio')).uploadFile(`${scratch}/test.wav`);
  await page.click('#transcribe');
  await page.waitForFunction(() => !document.querySelector('#polish').disabled);
  assert.equal(await page.$eval('#summarize', el => el.disabled), true);
  assert.equal(await page.evaluate(() => window.testState.records[0].body.raw.segments.length), 2);
  await page.click('#export-raw');
  await page.waitForFunction(() => window.testState.downloads.length === 1);
  assert.equal(await page.evaluate(() => window.testState.downloads[0].name), 'original-transcript.md');
  assert.ok((await page.evaluate(() => window.testState.downloads[0].content)).includes(fixture.raw.segments[0].text));
  await page.click('#polish');
  await page.waitForFunction(() => !document.querySelector('#summarize').disabled);
  assert.deepEqual(await page.$$eval('#fulltext textarea', elements => elements.map(el => el.value)), fixture.raw.segments.map(item => item.text));
  await page.click('#summarize');
  await page.waitForFunction(() => !document.querySelector('#export-summary').disabled);
  assert.match(await page.$eval('#summary-output', el => el.textContent), new RegExp(copy.unresolved));
  assert.equal(await page.evaluate(() => window.testState.calls.filter(call => call.type === 'ai').length), 2);
  const columns = await page.evaluate(() => {
    const left = document.querySelector('.transcript-panel').getBoundingClientRect();
    const right = document.querySelector('.summary-panel').getBoundingClientRect();
    return left.x < right.x && left.width > right.width && Math.abs(left.y - right.y) < 1;
  });
  assert.equal(columns, true, 'Desktop full text and summary must occupy separate columns.');
  await page.click('#export-full');
  await page.waitForFunction(() => window.testState.downloads.length === 2);
  assert.ok((await page.evaluate(() => window.testState.downloads[1].content)).includes(fixture.raw.segments[1].text));
  assert.equal(await page.$('#saved-list img'), null, 'Titles must be text, not HTML.');
  await page.click('#text-s1'); await page.type('#text-s1', ' ');
  assert.equal(await page.$eval('#export-summary', el => el.disabled), true);
  await page.evaluate(() => { window.testState.failSave = true; });
  await page.click('#save');
  await page.waitForFunction(() => document.querySelector('#status').dataset.status === 'danger');
  assert.equal(await page.evaluate(() => window.testState.dirty), true);
  assert.equal(await page.evaluate(() => window.testState.calls.filter(call => call.type === 'conflict').length), 1);
  assert.equal(await page.evaluate(() => window.testState.canClose({ save: true })), false);
  assert.equal(await page.evaluate(() => window.testState.canClose({ save: false })), true);
  await page.evaluate(() => { window.testState.conflictChoice = 'mine'; });
  await page.click('#save');
  await page.waitForFunction(() => !window.testState.dirty);
  await page.evaluate(() => {
    window.testState.conflictChoice = 'theirs';
    window.testState.records[0].body.title = 'Server revision';
  });
  await page.type('#meeting-title', ' local revision');
  await page.click('#save');
  await page.waitForFunction(() => document.querySelector('#meeting-title').value === 'Server revision');
  assert.equal(await page.evaluate(() => window.testState.dirty), false);
  await page.evaluate(() => {
    window.testState.conflicts.r1 = { mine: { ...structuredClone(window.testState.records[0].body), title: 'Recovered draft' } };
    window.testState.conflictChoice = 'mine'; window.testState.failSave = false;
  });
  await page.click('#new');
  await page.waitForFunction(() => document.querySelector('#meeting-title').value === '');
  await page.click('#saved-list button');
  await page.waitForFunction(() => document.querySelectorAll('#fulltext textarea').length === 2);
  assert.equal(await page.$eval('#meeting-title', el => el.value), 'Recovered draft');
  assert.equal(await page.evaluate(() => window.testState.calls.filter(call => call.type === 'resume').length), 1);
  await page.evaluate(() => { window.testState.failAI = true; });
  await page.click('#summarize');
  await page.waitForFunction(() => document.querySelector('#status').dataset.status === 'danger');
  assert.equal(await page.$$eval('#fulltext textarea', elements => elements.length), 2);
  await page.evaluate(() => { window.testState.failAI = false; });
  await page.click('#summarize');
  await page.waitForFunction(() => !document.querySelector('#export-summary').disabled);
  if (process.env.MEETING_NOTES_SCREENSHOT) await page.screenshot({ path: process.env.MEETING_NOTES_SCREENSHOT, fullPage: true });
  await page.setViewport({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile layout must not overflow.');
  assert.equal(await page.evaluate(() => document.querySelector('.summary-panel').getBoundingClientRect().top > document.querySelector('.transcript-panel').getBoundingClientRect().top), true);
  await page.evaluate(() => { window.testState.holdAI = true; });
  await page.click('#summarize');
  await page.waitForFunction(() => typeof window.testState.releaseAI === 'function');
  assert.equal(await page.evaluate(() => window.testState.canClose({ save: false })), false, 'Running work must guard departure.');
  await page.evaluate(async () => {
    await window.testState.switchProject({ project_handle: 'p2', project_key: 'key2', name: 'Second project' });
    window.testState.releaseAI();
  });
  await page.waitForFunction(() => document.querySelector('#project-name').textContent === 'Second project');
  assert.equal(await page.evaluate(() => window.testState.records.some(record => record.handle === 'p2')), false);
  assert.equal(await page.$eval('#summary-output', el => el.textContent), copy.emptySummary);
  await page.evaluate(() => {
    window.testState.holdAI = false;
    window.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
  });
  await page.click('#record-start');
  await page.waitForFunction(message => document.querySelector('#status').textContent === message, {}, copy.errors.MICROPHONE_DENIED);
  assert.equal(await page.$eval('#record-stop', el => el.disabled), true);
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await window.originalGetUserMedia(constraints);
      window.testCaptureStream = stream;
      return stream;
    };
  });
  await page.type('#meeting-title', 'Browser recording test');
  await page.click('#record-start');
  await page.waitForFunction(() => !document.querySelector('#record-stop').disabled && document.querySelector('#record-time').textContent !== '00:00:00');
  assert.equal(await page.evaluate(() => window.testState.canClose({ save: false })), false);
  await page.click('#record-stop');
  await page.waitForFunction(() => !document.querySelector('#record-download').disabled);
  assert.equal(await page.evaluate(() => window.testCaptureStream.getTracks().every(track => track.readyState === 'ended')), true);
  assert.equal(await page.evaluate(() => window.testState.canClose({ save: false })), false, 'Unbacked audio must guard departure.');
  await page.click('#record-download');
  await page.waitForFunction(message => document.querySelector('#recording-info').textContent === message, {}, copy.recordBackedUp);
  const encoded = await page.evaluate(async () => Array.from(new Uint8Array(await window.testState.downloads.at(-1).content.arrayBuffer())));
  assert.ok(encoded.length > 0);
  await writeFile(`${scratch}/browser.webm`, Buffer.from(encoded));
  await mkdir(`${scratch}/decoded`);
  await transcribeFile(`${scratch}/browser.webm`, `${scratch}/decoded`, { maxSpeakers: 2, keywords: [] }, {
    endpoint: 'https://check.cognitiveservices.azure.com/', key: 'test-only', signal: AbortSignal.timeout(15000),
    fetchImpl: async () => Response.json({ durationMilliseconds: 1000, phrases: [{ text: 'Synthetic test.', offsetMilliseconds: 0, durationMilliseconds: 900, speaker: 0 }] }),
  });
  await page.click('#transcribe');
  await page.waitForFunction(() => !document.querySelector('#polish').disabled);
  assert.equal(await page.evaluate(() => window.testState.records.some(record => record.handle === 'p2' && record.body.source?.name.endsWith('.webm'))), true);
  await page.evaluate(async () => window.testState.switchProject({ project_handle: 'p3', project_key: 'key3', name: 'Recording cleanup project' }));
  await page.click('#record-start');
  await page.waitForFunction(() => !document.querySelector('#record-stop').disabled && document.querySelector('#record-time').textContent !== '00:00:00');
  await page.evaluate(async () => window.testState.switchProject({ project_handle: 'p4', project_key: 'key4', name: 'Final project' }));
  await page.waitForFunction(() => window.testCaptureStream.getTracks().every(track => track.readyState === 'ended'));
  assert.equal(await page.$eval('#recording-preview', element => element.hidden), true);
  assert.equal(await page.$eval('#record-download', element => element.disabled), true);
  assert.deepEqual(errors, []);
  console.log('Chrome for Testing passed: two-column desktop, mobile stack, two stages, persistence, conflicts, project isolation, microphone denial, native recording/stop/download, WebM decoding and transcription handoff. Audio device, SDK and ASR/AI responses were simulated.');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
  await rm(scratch, { recursive: true, force: true });
}
