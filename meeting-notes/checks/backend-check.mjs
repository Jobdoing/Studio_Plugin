import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, mkdir, rm, readdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertionVerifier } from '../backend/auth.mjs';
import { createMeetingServer, uploadSettings } from '../backend/server.mjs';
import { transcribeFile, speechUrl } from '../backend/speech.mjs';

const root = existsSync('/Volumes/Vibe-Temp') ? '/Volumes/Vibe-Temp/meeting-notes/checks' : new URL('../.tmp/checks', import.meta.url).pathname;
await mkdir(root, { recursive: true });
const scratch = await mkdtemp(`${root}/backend-`);
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'check' };
const auth = assertionVerifier('http://studio.test', async () => Response.json({ keys: [jwk] }));
function token(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', kid: 'check' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ aud: 'meeting-notes', sub: 'u1', company: { id: 'c1' }, project: { key: 'p1' }, iat: now, exp: now + 300, ...overrides })).toString('base64url');
  return `${header}.${body}.${sign(null, Buffer.from(`${header}.${body}`), privateKey).toString('base64url')}`;
}
const raw = { duration: 1000, segments: [{ id: 's1', start: 0, end: 1000, speaker: 0, text: 'Synthetic test.' }] };
let app;
try {
  await assert.rejects(() => auth(token({ aud: 'other' })), /UNAUTHORIZED/);
  await assert.rejects(() => auth(token({ exp: 0 })), /UNAUTHORIZED/);
  await assert.rejects(() => auth(token({ project: null })), /UNAUTHORIZED/);
  await assert.rejects(() => auth(token({ exp: Math.floor(Date.now() / 1000) + 3600 })), /UNAUTHORIZED/);
  await assert.rejects(() => auth(`${token()}x`), /UNAUTHORIZED/);
  assert.notEqual(await auth(token()), await auth(token({ sandbox: true })));
  assert.throws(() => uploadSettings({ name: '../x.exe', size: 1, maxSpeakers: 2, keywords: [] }), /INVALID_UPLOAD/);
  assert.throws(() => uploadSettings({ name: 'x.wav', size: 500000000, maxSpeakers: 2, keywords: [] }), /INVALID_UPLOAD/);
  assert.throws(() => speechUrl('https://attacker.test'), /INVALID_SPEECH_ENDPOINT/);
  assert.throws(() => speechUrl('https://valid.cognitiveservices.azure.com/other'), /INVALID_SPEECH_ENDPOINT/);
  const settings = { name: 'test.wav', size: 4, maxSpeakers: 2, keywords: [] };
  let inputDirectory;
  let resolveTranscription;
  app = await createMeetingServer({ studioUrl: 'http://studio.test', scratchRoot: scratch, endpoint: 'https://check.cognitiveservices.azure.com/', key: 'test-only', authenticate: auth,
    transcribe: async (input, directory) => {
      inputDirectory = directory;
      assert.equal((await readFile(input)).toString(), '1234');
      return new Promise(resolve => { resolveTranscription = resolve; });
    } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const request = (path, method = 'GET', body, identity = token()) => fetch(`${base}${path}`, { method, body, headers: { 'X-Studio-Assertion': identity } });
  assert.equal((await request('/health', 'GET', undefined, 'invalid')).status, 401);
  const created = await request('/jobs', 'POST', JSON.stringify(settings));
  assert.equal(created.status, 201);
  const { id } = await created.json();
  const path = `/jobs/${id}`;
  assert.equal((await request(path, 'GET', undefined, token({ project: { key: 'p2' } }))).status, 404);
  assert.equal((await request(path, 'DELETE', undefined, token({ sub: 'u2' }))).status, 404);
  assert.equal((await request(`${path}/start`, 'POST')).status, 409);
  assert.equal((await request(`${path}/chunk?offset=1`, 'POST', '12')).status, 409);
  assert.equal((await request(`${path}/chunk?offset=0`, 'POST', Buffer.alloc(8 * 1024 * 1024 + 1))).status, 413);
  assert.equal((await request(`${path}/chunk?offset=0`, 'POST', '12')).status, 200);
  assert.equal((await request(`${path}/chunk?offset=0`, 'POST', '12')).status, 409);
  assert.equal((await request(`${path}/chunk?offset=2`, 'POST', '345')).status, 400);
  assert.equal((await request(`${path}/chunk?offset=2`, 'POST', '34')).status, 200);
  assert.equal((await request(`${path}/start`, 'POST')).status, 202);
  assert.equal((await request(`${path}/start`, 'POST')).status, 409);
  while (!resolveTranscription) await new Promise(resolve => setTimeout(resolve, 5));
  resolveTranscription(raw);
  for (let attempt = 0; attempt < 100 && existsSync(inputDirectory); attempt++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(existsSync(inputDirectory), false, 'Audio must be removed after transcription.');
  assert.deepEqual((await (await request(path)).json()).result, raw);
  assert.equal((await request(path, 'DELETE')).status, 200);
  assert.equal((await request(path)).status, 404);
  const ids = [];
  for (let i = 0; i < 4; i++) ids.push((await (await request('/jobs', 'POST', JSON.stringify(settings))).json()).id);
  assert.equal((await request('/jobs', 'POST', JSON.stringify(settings))).status, 503);
  for (const job of ids) assert.equal((await request(`/jobs/${job}`, 'DELETE')).status, 200);

  // Synthetic silence exercises decoding and the outgoing API contract, not ASR accuracy.
  const wave = Buffer.alloc(44 + 48000);
  wave.write('RIFF'); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8);
  wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(24000, 24); wave.writeUInt32LE(48000, 28); wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34); wave.write('data', 36); wave.writeUInt32LE(48000, 40);
  const input = `${scratch}/test.wav`;
  await writeFile(input, wave);
  const converted = await transcribeFile(input, scratch, { maxSpeakers: 3, keywords: ['Test term'] }, {
    endpoint: 'https://check.cognitiveservices.azure.com/', key: 'test-only', signal: AbortSignal.timeout(15000),
    async fetchImpl(url, init) {
      assert.match(url, /api-version=2025-10-15$/);
      assert.equal(init.headers['Ocp-Apim-Subscription-Key'], 'test-only');
      assert.equal(init.redirect, 'error');
      const definition = JSON.parse(init.body.get('definition'));
      assert.deepEqual(definition, { locales: ['zh-TW'], diarization: { enabled: true, maxSpeakers: 3 }, profanityFilterMode: 'None', phraseList: { phrases: ['Test term'] } });
      assert.equal(init.body.get('audio').type, 'audio/flac');
      return Response.json({ durationMilliseconds: 1000, phrases: [{ text: 'Synthetic test.', offsetMilliseconds: 0, durationMilliseconds: 1000, speaker: 0 }] });
    },
  });
  assert.deepEqual(converted, raw);
  const savedEnv = Object.fromEntries(['PATH', 'FFMPEG_BIN', 'FFPROBE_BIN'].map(name => [name, process.env[name]]));
  try {
    process.env.FFMPEG_BIN = (await promisify(execFile)('which', ['ffmpeg'])).stdout.trim();
    process.env.FFPROBE_BIN = (await promisify(execFile)('which', ['ffprobe'])).stdout.trim();
    process.env.PATH = `${scratch}/no-tools-on-path`;
    await mkdir(`${scratch}/absolute-binaries`);
    const result = await transcribeFile(input, `${scratch}/absolute-binaries`, { maxSpeakers: 2, keywords: [] }, {
      endpoint: 'https://check.cognitiveservices.azure.com/', key: 'test-only', signal: AbortSignal.timeout(15000),
      fetchImpl: async () => Response.json({ durationMilliseconds: 1000,
        phrases: [{ text: 'Synthetic test.', offsetMilliseconds: 0, durationMilliseconds: 1000, speaker: 0 }] }),
    });
    assert.deepEqual(result, raw, 'Absolute tool paths must work without ffmpeg or ffprobe on PATH.');
    for (const name of ['FFMPEG_BIN', 'FFPROBE_BIN']) {
      const absolute = process.env[name]; process.env[name] = 'relative-tool';
      await assert.rejects(() => transcribeFile(input, scratch, { maxSpeakers: 2, keywords: [] }, {
        endpoint: 'https://check.cognitiveservices.azure.com/', key: 'test-only', signal: AbortSignal.timeout(15000),
      }), /INVALID_AUDIO_BINARY/);
      process.env[name] = absolute;
    }
  } finally {
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
  await mkdir(`${scratch}/rate-limit`);
  await assert.rejects(() => transcribeFile(input, `${scratch}/rate-limit`, { maxSpeakers: 2, keywords: [] }, {
    endpoint: 'https://check.cognitiveservices.azure.com/', key: 'test-only', signal: AbortSignal.timeout(15000),
    fetchImpl: async () => new Response('', { status: 429 }),
  }), /SPEECH_RATE_LIMIT/);
  await writeFile(`${scratch}/playlist.wav`, `ffconcat version 1.0\nfile '${input}'\n`);
  await assert.rejects(() => transcribeFile(`${scratch}/playlist.wav`, scratch, { maxSpeakers: 2, keywords: [] }, {
    endpoint: 'https://check.cognitiveservices.azure.com/', key: 'test-only', signal: AbortSignal.timeout(15000),
    fetchImpl: async () => { throw new Error('Untrusted playlist reached Azure.'); },
  }), /AUDIO_CONVERSION_FAILED/);
  await app.dispose(); app = null;
  assert.deepEqual((await readdir(scratch)).filter(name => name.startsWith('run-')), []);
  console.log('Backend contracts passed: signed identity, project isolation, uploads, capacity, audio conversion, absolute binary paths without PATH lookup, and cleanup.');
} finally { if (app) await app.dispose(); await rm(scratch, { recursive: true, force: true }); }
