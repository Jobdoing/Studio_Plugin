import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as recorder from '../plugin/meeting-notes/recorder.mjs';

async function checkHostRecorder({ readHostRecording, validateHostRecording }) {
const id = 'a1234567-1234-1234-1234-123456789abc';
const metadata = { file_id: id, version: 2, ref: `doc:${id}@2`, name: 'Recording', mime: 'audio/webm',
  bytes: 3, duration_ms: 1000, stopped_by: 'user' };
const calls = [];
const sdk = { docs: { fetch: async (...args) => { calls.push(args); return new Blob(['abc']); } } };
const file = await readHostRecording(sdk, metadata, 'project-a');
assert.equal(file.name, 'Recording.webm');
assert.equal(await file.text(), 'abc');
assert.equal(file.type, 'audio/webm');
assert.deepEqual(calls, [[metadata.ref, {}, { project_handle: 'project-a' }]]);
const safari = await readHostRecording(sdk, { ...metadata, mime: 'audio/mp4', name: 'Recording.mp4' }, 'project-a');
assert.equal(safari.name, 'Recording.m4a');
assert.equal(safari.type, 'audio/mp4');
for (const invalid of [{ ref: `doc:${id}@1` }, { file_id: '../escape' }, { bytes: -1 }, { version: 0 },
  { mime: 'text/html' }, { stopped_by: 'unknown' }, { duration_ms: NaN }, { name: '' }]) {
  assert.throws(() => validateHostRecording({ ...metadata, ...invalid }), /INVALID_RECORDING/);
}
await assert.rejects(readHostRecording(sdk, { ...metadata, bytes: 64 * 1024 * 1024 + 1 }, 'project-a'), /RECORDING_READ_LIMIT/);
assert.equal(calls.length, 2, 'Oversized recordings must be refused before reading bytes.');
await assert.rejects(readHostRecording(sdk, { ...metadata, bytes: 4 }, 'project-a'), /INVALID_RECORDING/);
}
await checkHostRecorder(recorder);
const source = await readFile(new URL('../plugin/meeting-notes/recorder.mjs', import.meta.url), 'utf8');
const mutations = [
  ['pinned version', 'value.ref !== `doc:${value.file_id}@${value.version}`', 'false'],
  ['project binding', 'project_handle: projectHandle', "project_handle: 'other-project'"],
  ['size ceiling', 'if (value.bytes > 64 * 1024 * 1024)', 'if (false)'],
  ['content completeness', 'blob.size !== value.bytes', 'false'],
  ['Safari filename', "value.name.replace(/\\.mp4$/i, '.m4a')", 'value.name'],
];
for (const [name, before, after] of mutations) {
  assert.ok(source.includes(before), `Mutation target missing: ${name}`);
  const mutant = await import(`data:text/javascript;base64,${Buffer.from(source.replace(before, after)).toString('base64')}`);
  await assert.rejects(() => checkHostRecorder(mutant), `Surviving mutation: ${name}`);
}
console.log(`Host recording checks passed; ${mutations.length}/${mutations.length} mutations detected (version, project, size, content, Safari filename).`);
