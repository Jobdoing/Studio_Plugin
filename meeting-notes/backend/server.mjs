import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, appendFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertionVerifier } from './auth.mjs';
import { transcribeFile } from './speech.mjs';
import { MAX_AUDIO_BYTES, UPLOAD_CHUNK_BYTES, AUDIO_EXTENSIONS } from '../plugin/meeting-notes/model.mjs';

function readBody(request, limit) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let total = 0;
    let exceeded = false;
    request.on('data', chunk => {
      if (exceeded) return;
      total += chunk.length;
      if (total > limit) { exceeded = true; reject(new Error('BODY_TOO_LARGE')); return; }
      chunks.push(chunk);
    });
    request.on('end', () => { if (!exceeded) resolveBody(Buffer.concat(chunks)); });
    request.on('error', reject);
    request.on('aborted', () => reject(new Error('UPLOAD_INTERRUPTED')));
  });
}

export function uploadSettings(value) {
  if (typeof value?.name !== 'string' || !AUDIO_EXTENSIONS.test(value.name)
    || !Number.isSafeInteger(value.size) || value.size < 1 || value.size > MAX_AUDIO_BYTES
    || !Number.isInteger(value.maxSpeakers) || value.maxSpeakers < 2 || value.maxSpeakers > 35
    || !Array.isArray(value.keywords) || value.keywords.length > 100
    || value.keywords.some(word => typeof word !== 'string' || !word.trim() || word.length > 100)) {
    throw new Error('INVALID_UPLOAD');
  }
  return { name: value.name, size: value.size, maxSpeakers: value.maxSpeakers, keywords: value.keywords };
}

export async function createMeetingServer({ studioUrl, scratchRoot, endpoint, key,
  authenticate = assertionVerifier(studioUrl), transcribe = transcribeFile }) {
  await mkdir(scratchRoot, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(`${resolve(scratchRoot)}/run-`);
  const jobs = new Map();
  const json = (response, status, value) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff' }).end(JSON.stringify(value));
  };
  async function remove(job) {
    job.controller?.abort();
    await job.task?.catch(() => {});
    await rm(job.directory, { recursive: true, force: true });
    jobs.delete(job.id);
  }
  const expiry = setInterval(() => {
    for (const job of jobs.values()) if (!job.locked && Date.now() - job.touched > 30 * 60 * 1000) {
      job.locked = true;
      remove(job).catch(() => { job.locked = false; console.error('Temporary audio cleanup failed; retrying at next expiry check.'); });
    }
  }, 60000).unref();
  const server = createServer(async (request, response) => {
    let job;
    let ownsLock = false;
    try {
      const owner = await authenticate(request.headers['x-studio-assertion']);
      const path = new URL(request.url, 'http://localhost').pathname;
      if (request.method === 'GET' && path === '/health') return json(response, 200, { configured: Boolean(endpoint && key) });
      if (request.method === 'POST' && path === '/jobs') {
        if (!endpoint || !key) throw new Error('SPEECH_NOT_CONFIGURED');
        // NOTE(ceiling): four concurrent uploads/jobs per process; a shared queue is needed for multiple workers.
        if (jobs.size >= 4) throw new Error('BACKEND_BUSY');
        const settings = uploadSettings(JSON.parse(await readBody(request, 16000)));
        if (jobs.size >= 4) throw new Error('BACKEND_BUSY');
        const id = randomUUID();
        job = { id, owner, settings, offset: 0, status: 'uploading', touched: Date.now(),
          directory: `${directory}/${id}`, locked: true };
        jobs.set(id, job);
        ownsLock = true;
        await mkdir(job.directory, { mode: 0o700 });
        job.input = `${job.directory}/source.audio`;
        await writeFile(job.input, '', { mode: 0o600 });
        return json(response, 201, { id });
      }
      const match = /^\/jobs\/([a-f0-9-]{36})(?:\/(chunk|start))?$/.exec(path);
      job = match && jobs.get(match[1]);
      if (!job || job.owner !== owner) throw new Error('NOT_FOUND');
      job.touched = Date.now();
      if (request.method === 'GET' && !match[2]) return json(response, 200,
        { id: job.id, status: job.status, offset: job.offset, result: job.result, error: job.error });
      if (job.locked) throw new Error('BACKEND_BUSY');
      job.locked = true;
      ownsLock = true;
      if (request.method === 'DELETE' && !match[2]) { await remove(job); return json(response, 200, { removed: true }); }
      if (request.method === 'POST' && match[2] === 'chunk') {
        const offset = new URL(request.url, 'http://localhost').searchParams.get('offset');
        if (job.status !== 'uploading' || offset !== String(job.offset)) throw new Error('UPLOAD_OFFSET');
        const body = await readBody(request, UPLOAD_CHUNK_BYTES);
        if (!body.length || job.offset + body.length > job.settings.size) throw new Error('INVALID_UPLOAD');
        await appendFile(job.input, body);
        job.offset += body.length;
        return json(response, 200, { offset: job.offset });
      }
      if (request.method === 'POST' && match[2] === 'start') {
        if (job.status !== 'uploading' || job.offset !== job.settings.size) throw new Error('UPLOAD_INCOMPLETE');
        job.status = 'transcribing';
        job.controller = new AbortController();
        const timeout = setTimeout(() => job.controller.abort(), 20 * 60 * 1000).unref();
        job.task = (async () => {
          try {
            const result = await transcribe(job.input, job.directory, job.settings,
              { endpoint, key, signal: job.controller.signal });
            job.result = result;
            job.status = 'complete';
          } catch (error) {
            job.error = job.controller.signal.aborted ? 'SPEECH_TIMEOUT' : error.message;
            job.status = 'failed';
          } finally {
            clearTimeout(timeout);
            job.touched = Date.now();
            try { await rm(job.directory, { recursive: true, force: true }); }
            catch { console.error('Temporary audio cleanup failed; retrying on job removal.'); }
          }
        })();
        return json(response, 202, { id: job.id, status: job.status });
      }
      throw new Error('NOT_FOUND');
    } catch (error) {
      const code = error instanceof SyntaxError ? 'INVALID_UPLOAD' : error.message;
      const status = { UNAUTHORIZED: 401, NOT_FOUND: 404, BODY_TOO_LARGE: 413, BACKEND_BUSY: 503,
        SPEECH_NOT_CONFIGURED: 503, INVALID_UPLOAD: 400, UPLOAD_OFFSET: 409, UPLOAD_INCOMPLETE: 409 }[code] ?? 500;
      json(response, status, { error: status === 500 ? 'BACKEND_FAILED' : code });
    } finally { if (ownsLock && job) job.locked = false; }
  });
  server.requestTimeout = 120000;
  return { server, async dispose() {
    clearInterval(expiry);
    await Promise.all([...jobs.values()].map(remove));
    await new Promise(resolveClose => server.close(resolveClose));
    await rm(directory, { recursive: true, force: true });
  } };
}

export async function startServer() {
  const external = '/Volumes/Vibe-Temp/meeting-notes/uploads';
  const scratchRoot = process.env.MEETING_NOTES_SCRATCH || (existsSync('/Volumes/Vibe-Temp') ? external
    : fileURLToPath(new URL('../.tmp/uploads', import.meta.url)));
  if (!existsSync('/Volumes/Vibe-Temp') && !process.env.MEETING_NOTES_SCRATCH) console.warn('External scratch volume unavailable; using project .tmp/uploads.');
  const app = await createMeetingServer({ studioUrl: process.env.STUDIO5_URL || 'http://127.0.0.1:5177',
    scratchRoot, endpoint: process.env.AZURE_SPEECH_ENDPOINT, key: process.env.AZURE_SPEECH_KEY });
  app.server.listen(Number(process.env.PORT || 8937), '127.0.0.1', () => console.log('Meeting notes backend ready on loopback.'));
  for (const event of ['SIGTERM', 'SIGINT']) process.once(event, async () => { await app.dispose(); process.exit(0); });
  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await startServer();
