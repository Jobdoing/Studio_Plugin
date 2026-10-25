// NOTE(ceiling): audio stays in browser RAM; stop near 128 MiB or five hours. Longer durable capture needs streamed storage.
const MAX_RECORDING_BYTES = 128 * 1024 * 1024;
const MAX_RECORDING_MS = 17940 * 1000;

export function validateHostRecording(value) {
  if (!value || typeof value.file_id !== 'string' || !Number.isSafeInteger(value.version) || value.version < 1
    || !/^doc:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}@[1-9][0-9]*$/i.test(value.ref)
    || value.ref !== `doc:${value.file_id}@${value.version}` || typeof value.name !== 'string' || !value.name.trim()
    || !Number.isSafeInteger(value.bytes) || value.bytes < 1 || !Number.isFinite(value.duration_ms) || value.duration_ms < 0
    || typeof value.mime !== 'string' || !/^audio\//.test(value.mime)
    || !['user', 'limit', 'interrupted'].includes(value.stopped_by)) throw new Error('INVALID_RECORDING');
  return value;
}

export async function readHostRecording(sdk, value, projectHandle) {
  validateHostRecording(value);
  // NOTE(ceiling): docs.fetch caps reads at 64 MiB; larger recordings remain downloadable in Document Center for local upload.
  if (value.bytes > 64 * 1024 * 1024) throw new Error('RECORDING_READ_LIMIT');
  const blob = await sdk.docs.fetch(value.ref, {}, { project_handle: projectHandle });
  if (!(blob instanceof Blob) || blob.size !== value.bytes) throw new Error('INVALID_RECORDING');
  const extension = value.mime.includes('mp4') ? 'm4a' : value.mime.includes('ogg') ? 'ogg' : 'webm';
  const name = /\.(webm|m4a|ogg|opus)$/i.test(value.name) ? value.name : /\.mp4$/i.test(value.name)
    ? value.name.replace(/\.mp4$/i, '.m4a') : `${value.name}.${extension}`;
  return new File([blob], name, { type: value.mime });
}

export async function recordMicrophone({ onTick, onComplete, onError }) {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('RECORDING_UNSUPPORTED');
  if (window.origin === 'null') throw new Error('RECORDING_HOST_REQUIRED');
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (error) { throw new Error(error.name === 'NotAllowedError' ? 'MICROPHONE_DENIED' : 'MICROPHONE_UNAVAILABLE'); }
  let recorder;
  let ticker;
  let timeout;
  let canceled = false;
  let reason = 'stopped';
  const chunks = [];
  let bytes = 0;
  const cleanup = () => { clearInterval(ticker); clearTimeout(timeout); stream.getTracks().forEach(track => track.stop()); };
  const stop = (why = 'stopped') => {
    reason = why;
    if (recorder.state !== 'inactive') recorder.stop();
  };
  try {
    const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64000 });
    recorder.ondataavailable = event => {
      if (event.data.size) { chunks.push(event.data); bytes += event.data.size; }
      if (bytes >= MAX_RECORDING_BYTES && recorder.state !== 'inactive') stop('limit');
    };
    recorder.onerror = () => { reason = 'error'; };
    recorder.onstop = () => {
      cleanup();
      if (canceled) return;
      if (!bytes) { onError(new Error('RECORDING_EMPTY')); return; }
      const type = recorder.mimeType || chunks[0].type || 'audio/webm';
      const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      const file = new File(chunks, `meeting-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`, { type });
      onComplete(file, reason);
    };
    stream.getAudioTracks().forEach(track => { track.onended = () => { if (recorder.state !== 'inactive') stop('interrupted'); }; });
    recorder.start(1000);
    const started = Date.now();
    ticker = setInterval(() => onTick(Date.now() - started), 1000);
    timeout = setTimeout(() => stop('limit'), MAX_RECORDING_MS);
    return { stop, cancel() { canceled = true; stop(); cleanup(); } };
  } catch { cleanup(); throw new Error('RECORDING_FAILED'); }
}
