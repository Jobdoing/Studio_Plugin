// Explicit live check: sends generated speech to Azure and incurs normal transcription usage.
// No production recording is used; credentials stay in process memory.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { transcribeFile } from '../backend/speech.mjs';

const [group, name] = process.argv.slice(2);
if (!group || !name) throw new Error('Usage: node checks/azure-check.mjs <resource-group> <resource-name>');
const exec = promisify(execFile);
const root = existsSync('/Volumes/Vibe-Temp') ? '/Volumes/Vibe-Temp/meeting-notes/checks' : new URL('../.tmp/checks', import.meta.url).pathname;
await mkdir(root, { recursive: true });
const scratch = await mkdtemp(`${root}/azure-`);
try {
  const fixture = JSON.parse(await readFile(new URL('./transcript.json', import.meta.url), 'utf8'));
  const azure = async args => {
    try { return (await exec('az', args, { timeout: 180000, maxBuffer: 16000 })).stdout.trim(); }
    catch (error) { throw new Error(`AZURE_CONFIGURATION_QUERY_FAILED (${error.killed ? 'timeout' : error.code || error.signal || 'unknown'})`); }
  };
  const endpoint = await azure(['cognitiveservices', 'account', 'show', '-g', group, '-n', name, '--query', 'properties.endpoint', '-o', 'tsv', '--only-show-errors']);
  const key = await azure(['cognitiveservices', 'account', 'keys', 'list', '-g', group, '-n', name, '--query', 'key1', '-o', 'tsv', '--only-show-errors']);
  assert.ok(key);
  for (let i = 0; i < fixture.raw.segments.length; i++) {
    await writeFile(`${scratch}/${i}.txt`, fixture.raw.segments[i].text);
    await exec('say', ['-v', fixture.voices[i], '-r', '150', '-f', `${scratch}/${i}.txt`, '-o', `${scratch}/${i}.aiff`], { timeout: 30000 });
  }
  await exec('ffmpeg', ['-nostdin', '-v', 'error', '-i', `${scratch}/0.aiff`, '-i', `${scratch}/1.aiff`,
    '-filter_complex', '[0:a][1:a]concat=n=2:v=0:a=1[out]', '-map', '[out]', `${scratch}/synthetic.wav`], { timeout: 30000 });
  const result = await transcribeFile(`${scratch}/synthetic.wav`, scratch, { maxSpeakers: 2, keywords: [] },
    { endpoint, key, signal: AbortSignal.timeout(180000) });
  assert.ok(result.segments.some(item => /\p{Script=Han}/u.test(item.text)), 'No Chinese speech recognized.');
  console.log(JSON.stringify({ synthetic: true, durationSeconds: result.duration / 1000, segments: result.segments.length,
    speakers: [...new Set(result.segments.map(item => item.speaker))], transcript: result.segments.map(item => item.text) }));
  assert.equal(new Set(result.segments.map(item => item.speaker).filter(value => value !== null)).size, 2, 'The two synthetic speakers were not separated.');
  const transcript = result.segments.map(item => item.text).join('').replace(/[\s\p{P}]/gu, '');
  for (const phrase of fixture.expectedPhrases) assert.ok(transcript.includes(phrase), 'A proposal, negation or unresolved-status phrase was not preserved.');
} finally { await rm(scratch, { recursive: true, force: true }); }
