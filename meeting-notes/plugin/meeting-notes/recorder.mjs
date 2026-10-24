// NOTE(ceiling): audio stays in browser RAM; stop near 128 MiB or five hours. Longer durable capture needs streamed storage.
const MAX_RECORDING_BYTES = 128 * 1024 * 1024;
const MAX_RECORDING_MS = 17940 * 1000;

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
