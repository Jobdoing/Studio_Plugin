import { MAX_AUDIO_BYTES, UPLOAD_CHUNK_BYTES, AUDIO_EXTENSIONS, generateFullText, generateSummary,
  timeLabel, exportText, validateReadable, validateRaw, validateMeeting } from './model.mjs';
import { recordMicrophone, validateHostRecording, readHostRecording } from './recorder.mjs';

const sdk = window.studio;
const $ = id => document.getElementById(id);
const copyResponse = await fetch('./content.zh-Hant.json');
if (!copyResponse.ok) throw new Error('COPY_UNAVAILABLE');
const copy = await copyResponse.json();
for (const element of document.querySelectorAll('[data-copy]')) element.textContent = copy[element.dataset.copy];
document.title = copy.title;
document.querySelector('.stages').setAttribute('aria-label', copy.title);
let project = null;
let record = null;
let meeting = emptyMeeting();
let dirty = false;
let busy = false;
let epoch = 0;
let operation = null;
let recorder = null;
let recordingPending = false;
let recordingRequest = 0;
let recordedFile = null;
let recordingUrl = null;
let recordingBackedUp = false;
let hostRecording = null;
const hostRecorder = typeof sdk?.audio?.record === 'function';

function emptyMeeting() { return { title: '', source: null, raw: null, readable: [], summary: null }; }
function element(tag, content, className) {
  const item = document.createElement(tag);
  if (content != null) item.textContent = content;
  if (className) item.className = className;
  return item;
}
function status(message, error = false) { $('status').textContent = message; $('status').dataset.status = error ? 'danger' : 'info'; }
function report(error) {
  const code = error?.message || 'UNKNOWN_ERROR';
  status(copy.errors[code] || copy.error, true);
}
function changed() { dirty = true; sdk?.dirty(true); controls(); }
function capturing() { return recordingPending || Boolean(recorder); }
function audioNeedsBackup() { return Boolean(recordedFile) && !recordingBackedUp; }
function syncDirty() { sdk?.dirty(dirty || capturing() || audioNeedsBackup()); }
function clearRecording() {
  recordingRequest++; recorder?.cancel(); recorder = null; recordingPending = false;
  recordedFile = null; recordingBackedUp = false;
  hostRecording = null;
  if (recordingUrl) URL.revokeObjectURL(recordingUrl);
  recordingUrl = null;
  $('recording-preview').removeAttribute('src'); $('recording-preview').load(); $('recording-preview').hidden = true;
  $('recording-info').textContent = hostRecorder ? copy.recordHostHelp : copy.recordHelp; $('record-time').textContent = '00:00:00';
}
function fullReady() { return meeting.raw && meeting.readable.length === meeting.raw.segments.length; }
function controls() {
  const available = Boolean(project?.project_handle) && !busy && !capturing();
  for (const id of ['meeting-title', 'speakers', 'keywords', 'new']) $(id).disabled = !available;
  $('audio').disabled = !available || Boolean(meeting.raw) || Boolean(recordedFile);
  $('record-start').disabled = !available || Boolean(meeting.raw) || Boolean(recordedFile) || Boolean(hostRecording) || (!hostRecorder && window.origin === 'null');
  if (!hostRecorder && window.origin === 'null') $('recording-info').textContent = copy.errors.RECORDING_HOST_REQUIRED;
  $('record-stop').hidden = hostRecorder;
  $('record-time').hidden = hostRecorder;
  if (hostRecorder && !capturing() && !hostRecording) $('recording-info').textContent = copy.recordHostHelp;
  $('record-stop').disabled = !capturing();
  $('record-download').disabled = (!recordedFile && !hostRecording) || busy || capturing();
  $('transcribe').disabled = !available || Boolean(meeting.raw);
  $('save').disabled = !available || !dirty;
  $('export-raw').disabled = !meeting.raw || busy;
  $('polish').disabled = !available || !meeting.raw || fullReady();
  $('summarize').disabled = !available || !fullReady();
  $('export-full').disabled = !fullReady() || busy;
  $('export-summary').disabled = !meeting.summary || busy;
  for (const field of document.querySelectorAll('#fulltext textarea, #saved-list button')) field.disabled = !available;
}
function renderSummary() {
  const host = $('summary-output');
  host.replaceChildren();
  if (!meeting.summary) { host.append(element('p', copy.emptySummary, 'muted')); return; }
  host.append(element('h3', `${copy.subject}: ${meeting.summary.subject}`));
  for (const issue of meeting.summary.issues) {
    const article = element('article', null, 'issue');
    article.append(element('h3', issue.topic), element('p', issue.discussion),
      element('p', `${copy.conclusion} · ${copy[issue.status]}: ${issue.conclusion}`));
    const details = element('details');
    details.append(element('summary', copy.evidence));
    for (const evidence of issue.evidence) {
      const link = element('a', `[${evidence.id}]`);
      link.href = `#segment-${evidence.id}`;
      const quote = element('blockquote');
      quote.append(link, document.createTextNode(` ${evidence.quote}`));
      details.append(quote);
    }
    article.append(details);
    host.append(article);
  }
}
function render() {
  $('meeting-title').value = meeting.title;
  $('source-info').textContent = meeting.source ? meeting.source.name : '';
  $('coverage').textContent = meeting.raw ? `${copy.coverage}: ${meeting.readable.length} / ${meeting.raw.segments.length}` : '';
  const host = $('fulltext');
  host.replaceChildren();
  if (!meeting.raw) host.append(element('p', copy.emptyFull, 'muted'));
  else {
    if (meeting.raw.segments.some(item => item.speaker === null)) host.append(element('p', copy.unknownWarning, 'kit-callout'));
    for (const [index, raw] of meeting.raw.segments.entries()) {
      const article = element('article', null, 'segment');
      article.id = `segment-${raw.id}`;
      const label = `${timeLabel(raw.start)}–${timeLabel(raw.end)} · ${raw.speaker === null ? copy.unknownSpeaker : `${copy.speaker} ${raw.speaker + 1}`}`;
      const readable = meeting.readable[index];
      if (readable) {
        const field = element('div', null, 'kit-field');
        const title = element('label', label);
        title.htmlFor = `text-${raw.id}`;
        const input = element('textarea');
        input.id = title.htmlFor;
        input.value = readable.text;
        input.rows = Math.max(3, Math.min(16, Math.ceil(readable.text.length / 50)));
        input.addEventListener('input', () => {
          readable.text = input.value;
          meeting.summary = null;
          changed(); renderSummary(); status(copy.summaryStale);
        });
        field.append(title, input);
        article.append(field);
      } else article.append(element('h3', label), element('p', raw.text));
      const original = element('details');
      original.append(element('summary', copy.raw), element('p', raw.text));
      article.append(original);
      host.append(article);
    }
  }
  renderSummary(); controls();
}
function checkEpoch(token) { if (token !== epoch) throw new Error('PROJECT_CHANGED'); }
function aiFor(token) {
  return { async complete(request) {
    checkEpoch(token);
    const result = await sdk.ai.complete(request);
    checkEpoch(token);
    return result;
  } };
}
async function refreshList(token = epoch) {
  if (!project) return;
  const rows = await sdk.records.list('meetings', { scope: 'project', project_handle: project.project_handle,
    order: 'updated_at desc' });
  if (token !== epoch) return;
  $('saved-list').replaceChildren();
  if (!rows.length) $('saved-list').append(element('p', copy.noMeetings, 'muted'));
  for (const row of rows) {
    const button = element('button', row.body?.title || copy.title, 'kit-button kit-button--secondary');
    button.type = 'button';
    button.addEventListener('click', () => run(async current => {
      if (dirty) throw new Error('UNSAVED');
      if (audioNeedsBackup()) throw new Error('RECORDING_NOT_BACKED_UP');
      let loaded = await sdk.records.get('meetings', row.record_id);
      checkEpoch(current);
      const pendingConflict = await sdk.sync.savedConflict('meetings', row.record_id);
      checkEpoch(current);
      if (pendingConflict) {
        const resolution = await sdk.sync.resumeConflict('meetings', row.record_id, { current: loaded });
        checkEpoch(current);
        if (resolution.choice === 'later') throw new Error('SAVE_DEFERRED');
        loaded = resolution.record;
      }
      if (!loaded || loaded.schema !== 'v1') throw new Error('INVALID_RECORD');
      const body = validateMeeting(loaded.body);
      clearRecording(); record = loaded; meeting = body;
      $('audio').value = ''; status(copy.saved); render();
    }));
    $('saved-list').append(button);
  }
  controls();
}
async function save(token = epoch) {
  checkEpoch(token);
  const snapshot = validateMeeting(meeting);
  if (!snapshot.title.trim()) throw new Error('TITLE_REQUIRED');
  if (new TextEncoder().encode(JSON.stringify(snapshot)).length > 1000000) throw new Error('RECORD_TOO_LARGE');
  let saved;
  try {
    saved = record
      ? await sdk.records.update('meetings', record.record_id, { version: record.version, schema: 'v1', body: snapshot })
      : await sdk.records.create('meetings', { scope: 'project', project_handle: project.project_handle, schema: 'v1', body: snapshot });
  } catch (error) {
    checkEpoch(token);
    if (!['VERSION_CONFLICT', 'LEASE_HELD', 'PUBLISHED'].includes(error.code || error.message)) throw error;
    const resolution = await sdk.sync.resolveConflict(error, { mine: snapshot, schema: 'v1', label: snapshot.title });
    checkEpoch(token);
    if (resolution.choice === 'later') throw new Error('SAVE_DEFERRED');
    saved = resolution.record;
    if (resolution.choice === 'theirs') {
      if (saved?.schema !== 'v1') throw new Error('INVALID_RECORD');
      meeting = validateMeeting(saved.body); record = saved; dirty = false; syncDirty();
      render(); await refreshList(token);
      throw new Error('SAVE_REPLACED');
    }
  }
  checkEpoch(token);
  record = saved;
  if (saved.pending) { status(copy.pending); throw new Error('SAVE_PENDING'); }
  dirty = JSON.stringify(snapshot) !== JSON.stringify(meeting);
  syncDirty();
  await refreshList(token);
  controls();
}
async function api(path, init, token) {
  checkEpoch(token);
  const response = await sdk.backend.fetch(path, { ...init, project_handle: project.project_handle, signal: operation.signal });
  checkEpoch(token);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.error === 'string' ? body.error : body.error?.code || 'BACKEND_FAILED');
  }
  return response.json();
}
async function run(action) {
  if (busy || capturing() || !project) return;
  const token = epoch;
  busy = true; operation = new AbortController(); controls();
  try { await action(token); }
  catch (error) { if (token === epoch) report(error); }
  finally { if (token === epoch) { busy = false; operation = null; controls(); } }
}
async function transcribe(token) {
  if (!recordedFile && hostRecording && !$('audio').files[0]) {
    const file = await readHostRecording(sdk, hostRecording, project.project_handle);
    checkEpoch(token); recordedFile = file;
  }
  const file = recordedFile || $('audio').files[0];
  const maxSpeakers = Number($('speakers').value);
  const keywords = $('keywords').value.split(/[,，\n]/).map(value => value.trim()).filter(Boolean);
  if (!file || !AUDIO_EXTENSIONS.test(file.name) || !Number.isInteger(maxSpeakers) || maxSpeakers < 2 || maxSpeakers > 35
    || keywords.length > 100 || keywords.some(word => word.length > 100)) throw new Error('INVALID_UPLOAD');
  if (file.size > MAX_AUDIO_BYTES) throw new Error('AUDIO_TOO_LARGE');
  if (!meeting.title.trim()) throw new Error('TITLE_REQUIRED');
  const metadata = document.createElement('audio');
  const objectUrl = URL.createObjectURL(file);
  try {
    await new Promise((resolveAudio, reject) => {
      const timeout = setTimeout(() => reject(new Error('AUDIO_CONVERSION_FAILED')), 10000);
      metadata.onloadedmetadata = () => { clearTimeout(timeout); resolveAudio(); };
      metadata.onerror = () => { clearTimeout(timeout); resolveAudio(); };
      metadata.src = objectUrl;
    });
    if (Number.isFinite(metadata.duration) && metadata.duration >= 18000) throw new Error('AUDIO_TOO_LONG');
  } finally { metadata.removeAttribute('src'); metadata.load(); URL.revokeObjectURL(objectUrl); }
  const handle = project.project_handle;
  let job;
  try {
    job = await api('jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, size: file.size, maxSpeakers, keywords }) }, token);
    for (let offset = 0; offset < file.size; offset += UPLOAD_CHUNK_BYTES) {
      status(`${copy.uploading} ${Math.floor(offset / file.size * 100)}%`);
      await api(`jobs/${job.id}/chunk?offset=${offset}`, { method: 'POST', body: file.slice(offset, offset + UPLOAD_CHUNK_BYTES) }, token);
    }
    await api(`jobs/${job.id}/start`, { method: 'POST' }, token);
    status(copy.transcribing);
    while (true) {
      const result = await api(`jobs/${job.id}`, {}, token);
      if (result.status === 'failed') throw new Error(result.error || 'INVALID_TRANSCRIPT');
      if (result.status === 'complete') {
        meeting.raw = validateRaw(result.result); meeting.source = { name: file.name, size: file.size,
          ...(hostRecording && file === recordedFile ? { ref: hostRecording.ref } : {}) };
        meeting.readable = []; meeting.summary = null; changed(); render();
        await save(token); status(copy.transcribed); break;
      }
      await new Promise(resolvePoll => setTimeout(resolvePoll, 1500));
      checkEpoch(token);
    }
  } finally {
    // NOTE(ceiling): a disconnected client cannot confirm deletion; the backend retries cleanup after 30 minutes of inactivity.
    if (job) await sdk.backend.fetch(`jobs/${job.id}`, { method: 'DELETE', project_handle: handle }).catch(() => {});
  }
}

$('meeting-title').addEventListener('input', () => { meeting.title = $('meeting-title').value; changed(); });
$('record-start').addEventListener('click', async () => {
  if (!project || busy || capturing() || meeting.raw || recordedFile) return;
  const token = epoch;
  const request = ++recordingRequest;
  recordingPending = true; syncDirty(); controls();
  $('recording-info').textContent = copy.recordRequesting;
  status(copy.recordRequesting);
  try {
    if (hostRecorder) {
      const handle = project.project_handle;
      const result = await sdk.audio.record({ project_handle: handle });
      if (token !== epoch || request !== recordingRequest) return;
      if (!result) { $('recording-info').textContent = copy.recordHostHelp; status(copy.ready); return; }
      hostRecording = validateHostRecording(result);
      recordingBackedUp = true;
      $('source-info').textContent = result.name;
      $('recording-info').textContent = copy.recordLoading;
      const file = await readHostRecording(sdk, result, handle);
      if (token !== epoch || request !== recordingRequest) return;
      recordedFile = file;
      recordingUrl = URL.createObjectURL(file);
      $('recording-preview').src = recordingUrl; $('recording-preview').hidden = false;
      $('recording-preview').setAttribute('aria-label', copy.recordHostReady);
      $('audio').value = '';
      $('recording-info').textContent = result.stopped_by === 'limit' ? copy.recordHostLimit
        : result.stopped_by === 'interrupted' ? copy.recordHostInterrupted : copy.recordHostReady;
      status($('recording-info').textContent);
      return;
    }
    const session = await recordMicrophone({
      onTick: elapsed => { if (request === recordingRequest) $('record-time').textContent = timeLabel(elapsed); },
      onComplete: (file, reason) => {
        if (token !== epoch || request !== recordingRequest) return;
        recorder = null; recordedFile = file; recordingBackedUp = false;
        recordingUrl = URL.createObjectURL(file);
        $('recording-preview').src = recordingUrl; $('recording-preview').hidden = false;
        $('recording-preview').setAttribute('aria-label', copy.recordReady);
        $('recording-info').textContent = reason === 'limit' ? copy.recordLimit : reason === 'stopped' ? copy.recordReady : copy.recordInterrupted;
        $('source-info').textContent = file.name; $('audio').value = ''; syncDirty(); controls();
      },
      onError: error => {
        if (token !== epoch || request !== recordingRequest) return;
        recorder = null; syncDirty(); controls(); report(error);
      },
    });
    if (token !== epoch || request !== recordingRequest) { session.cancel(); return; }
    recorder = session; recordingPending = false;
    $('recording-info').textContent = copy.recordActive; syncDirty(); controls();
  } catch (error) {
    if (token !== epoch || request !== recordingRequest) return;
    recordingPending = false; syncDirty(); controls(); report(error);
    if (hostRecording) $('recording-info').textContent = copy.recordReadFailed;
  } finally {
    if (hostRecorder && token === epoch && request === recordingRequest) { recordingPending = false; syncDirty(); controls(); }
  }
});
$('record-stop').addEventListener('click', () => {
  if (recordingPending) { recordingRequest++; recordingPending = false; $('recording-info').textContent = copy.recordHelp; }
  else recorder?.stop();
  syncDirty(); controls();
});
$('record-download').addEventListener('click', () => run(async token => {
  if (hostRecording) {
    await sdk.docs.download(hostRecording.ref, {}, { project_handle: project.project_handle });
    checkEpoch(token); $('recording-info').textContent = copy.recordHostDownloaded; return;
  }
  // NOTE(ceiling): the download acknowledgement confirms dispatch, not the user's disk save; the UI asks the user to verify the file.
  await sdk.download(recordedFile.name, recordedFile, recordedFile.type);
  checkEpoch(token); recordingBackedUp = true; syncDirty(); $('recording-info').textContent = copy.recordBackedUp;
}));
window.addEventListener('pagehide', () => { recorder?.cancel(); recorder = null; recordingRequest++; });
$('transcribe').addEventListener('click', () => run(transcribe));
$('save').addEventListener('click', () => run(async token => { await save(token); status(copy.saved); }));
$('export-raw').addEventListener('click', () => run(async () => {
  await sdk.download('original-transcript.md', exportText({ ...meeting, readable: meeting.raw.segments }, copy), 'text/markdown;charset=utf-8');
}));
$('polish').addEventListener('click', () => run(async token => {
  status(copy.polishing);
  await generateFullText(aiFor(token), meeting.raw.segments, meeting.readable, async progress => {
    checkEpoch(token); meeting.readable = progress; meeting.summary = null; changed(); render();
    await save(token); status(`${copy.polishing} ${progress.length} / ${meeting.raw.segments.length}`);
  });
  checkEpoch(token); status(copy.complete);
}));
$('summarize').addEventListener('click', () => run(async token => {
  if (dirty) await save(token);
  validateReadable(meeting.raw.segments, { segments: meeting.readable });
  status(copy.summarizing);
  const summary = await generateSummary(aiFor(token), meeting.raw.segments, meeting.readable);
  checkEpoch(token); meeting.summary = summary; changed(); render(); await save(token); status(copy.complete);
}));
for (const [id, summary] of [['export-full', false], ['export-summary', true]]) {
  $(id).addEventListener('click', () => run(async () => {
    await sdk.download(summary ? 'meeting-summary.md' : 'meeting-full-text.md', exportText(meeting, copy, summary), 'text/markdown;charset=utf-8');
  }));
}
$('new').addEventListener('click', () => run(async token => {
  if ((dirty || audioNeedsBackup()) && !await sdk.confirm(copy.confirmNew)) return;
  checkEpoch(token);
  clearRecording(); record = null; meeting = emptyMeeting(); dirty = false; sdk.dirty(false);
  $('audio').value = ''; $('keywords').value = ''; render(); status(copy.ready);
}));

async function start(next) {
  if (next?.project_handle === project?.project_handle && project) return;
  operation?.abort(); clearRecording(); epoch++; const token = epoch;
  project = next?.project_handle && next.project_handle !== '__all__' ? next : null;
  busy = false; operation = null; record = null; meeting = emptyMeeting(); dirty = false;
  sdk?.dirty(false); $('audio').value = ''; $('keywords').value = ''; $('saved-list').replaceChildren();
  $('project-name').textContent = project?.name || copy.noProject;
  status(project ? copy.ready : copy.noProject); render();
  if (project) try { await refreshList(token); } catch (error) { if (token === epoch) report(error); }
}
if (sdk) {
  sdk.onProjectChange(start);
  sdk.onCanClose(async ({ save: requested }) => {
    if (busy) return false;
    if (capturing()) { report(new Error('RECORDING_ACTIVE')); return false; }
    if (audioNeedsBackup()) { report(new Error('RECORDING_NOT_BACKED_UP')); return false; }
    if (requested && dirty) try { await save(); } catch (error) { report(error); return false; }
    return true;
  }, { saves: true });
  const token = epoch;
  const selected = await sdk.project();
  if (token === epoch) await start(selected);
} else { status(copy.noSdk, true); render(); }
