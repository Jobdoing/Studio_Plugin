import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import * as model from '../plugin/meeting-notes/model.mjs';

export async function checkModel(m) {
  const raw = m.normalizeSpeech({ durationMilliseconds: 5000, phrases: [
    { text: 'I propose Friday, but only after the inspection. This is a proposal, not an agreement.', offsetMilliseconds: 0, durationMilliseconds: 2000, speaker: 0 },
    { text: 'I disagree. The inspection is still pending. We have not decided the date.', offsetMilliseconds: 1800, durationMilliseconds: 2000, speaker: 1 },
    { text: 'Please check again.', offsetMilliseconds: 4000, durationMilliseconds: 900 },
  ] });
  assert.equal(raw.segments[2].speaker, null);
  assert.equal(raw.segments[1].start, 1800);
  assert.throws(() => m.normalizeSpeech({ durationMilliseconds: 1, phrases: [{ text: 'x', offsetMilliseconds: 5000, durationMilliseconds: 1 }] }), /INVALID_TRANSCRIPT/);
  assert.throws(() => m.validateRaw({ ...raw, segments: [{ ...raw.segments[0], id: 'other' }] }), /INVALID_TRANSCRIPT/);
  const readable = raw.segments.map(({ id, text }) => ({ id, text }));
  assert.deepEqual(m.validateReadable(raw.segments, { segments: readable }), readable);
  assert.throws(() => m.validateReadable(raw.segments, { segments: readable.slice(1) }), /MISSING_SEGMENTS/);
  assert.throws(() => m.validateReadable(raw.segments, { segments: [...readable, { id: 's4', text: 'Invented speech.' }] }), /MISSING_SEGMENTS/);
  assert.throws(() => m.validateReadable(raw.segments, { segments: [...readable].reverse() }), /MISSING_SEGMENTS/);
  assert.throws(() => m.validateReadable(raw.segments, { segments: readable.map(item => ({ ...item, text: 'Agreed.' })) }), /TEXT_COVERAGE_FAILED/);
  const summary = { subject: 'Schedule', issues: [{ topic: 'Date', discussion: 'A conditional proposal was disputed.',
    conclusion: 'No date agreed.', status: 'unresolved', evidence: [{ id: 's2', quote: 'We have not decided the date.' }] }] };
  assert.deepEqual(m.validateSummary(summary, readable), summary);
  assert.throws(() => m.validateSummary({ ...summary, issues: [{ ...summary.issues[0], evidence: [{ id: 's2', quote: 'Friday was agreed.' }] }] }, readable), /INVALID_EVIDENCE/);
  assert.throws(() => m.validateSummary({ ...summary, issues: [{ ...summary.issues[0], status: 'approved' }] }, readable), /INVALID_SUMMARY/);
  assert.throws(() => m.validateMeeting({ title: 'Meeting', source: null, raw, readable: [], summary }), /INVALID_RECORD/);
  let calls = 0;
  const ai = { async complete(request) {
    calls++;
    const data = JSON.parse(request.input);
    assert.ok(request.input.length <= 20000);
    return { json: { segments: data.targets.map(({ id, text }) => ({ id, text })) } };
  } };
  const progress = [];
  assert.deepEqual(await m.generateFullText(ai, raw.segments, readable.slice(0, 1), value => progress.push(value)), readable);
  assert.equal(calls, 1);
  assert.equal(progress[0].length, 3);
  let summaryCalls = 0;
  assert.deepEqual(await m.generateSummary({ async complete() { summaryCalls++; return { json: summary }; } }, raw.segments, readable), summary);
  assert.equal(summaryCalls, 1);
  await assert.rejects(() => m.generateSummary(ai, raw.segments, readable.slice(0, 1)), /MISSING_SEGMENTS/);
  assert.throws(() => m.batches([{ text: 'x'.repeat(4000) }]), /SEGMENT_TOO_LARGE/);
  const long = Array.from({ length: 8 }, (_, index) => ({ id: `s${index + 1}`, text: `${index}: ` + 'A condition remains pending. '.repeat(45) }));
  const chunks = m.batches(long);
  assert.ok(chunks.length > 1);
  assert.deepEqual(chunks.flat(), long);
  let committed = [];
  let count = 0;
  await assert.rejects(() => m.generateFullText({ async complete(request) {
    if (++count === 2) throw new Error('MODEL_UNAVAILABLE');
    return { json: { segments: JSON.parse(request.input).targets } };
  } }, long, [], value => { committed = value; }), /MODEL_UNAVAILABLE/);
  assert.deepEqual(committed, chunks[0]);
  assert.deepEqual(await m.generateFullText(ai, long, committed), long);
  let phase = 0;
  await assert.rejects(() => m.generateSummary({ async complete(request) {
    const input = JSON.parse(request.input);
    if (Array.isArray(input) && input[0].id) {
      const item = input[0]; phase++;
      return { json: { subject: 'Schedule', issues: [{ ...summary.issues[0], evidence: [{ id: item.id, quote: item.text }] }] } };
    }
    assert.ok(phase > 1);
    return { json: input[0] };
  } }, long, long), /SUMMARY_COVERAGE_FAILED/);
  assert.match(m.exportText({ title: 'Test', raw, readable }, { speaker: 'Speaker', unknownSpeaker: 'Unknown' }), /\[s3\]/);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkModel(model);
  const source = await readFile(new URL('../plugin/meeting-notes/model.mjs', import.meta.url), 'utf8');
  const mutations = [
    ['count', "if (!Array.isArray(result?.segments) || result.segments.length !== source.length)", 'if (!Array.isArray(result?.segments))'],
    ['order', 'item?.id !== source[index].id || ', ''],
    ['compression', 'if (length > 30 && (ratio < 0.8 || ratio > 1.4))', 'if (false)'],
    ['evidence', "if (!text(evidence?.quote) || !byId.get(evidence.id)?.includes(evidence.quote))", 'if (false)'],
    ['coverage', 'if (!issue.evidence.some(item => covered.has(JSON.stringify([item.id, item.quote]))))', 'if (false)'],
  ];
  for (const [name, before, after] of mutations) {
    assert.ok(source.includes(before), `Mutation target missing: ${name}`);
    const mutant = await import(`data:text/javascript;base64,${Buffer.from(source.replace(before, after)).toString('base64')}`);
    await assert.rejects(() => checkModel(mutant), `Surviving mutation: ${name}`);
  }
  console.log(`Model contracts passed; ${mutations.length}/${mutations.length} mutations detected.`);
}
