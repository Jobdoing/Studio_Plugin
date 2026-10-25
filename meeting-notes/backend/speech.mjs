import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { openAsBlob } from 'node:fs';
import { isAbsolute } from 'node:path';
import { normalizeSpeech } from '../plugin/meeting-notes/model.mjs';
const formats = 'wav,mp3,mov,aac,flac,ogg,matroska,webm,asf';

export function speechUrl(endpoint) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.cognitiveservices\.azure\.com$/.test(url.hostname)
    || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('INVALID_SPEECH_ENDPOINT');
  }
  return new URL('/speechtotext/transcriptions:transcribe?api-version=2025-10-15', url).href;
}

export async function transcribeFile(input, directory, settings, { endpoint, key, signal, fetchImpl = fetch }) {
  if (!endpoint || !key) throw new Error('SPEECH_NOT_CONFIGURED');
  const url = speechUrl(endpoint);
  const ffmpeg = process.env.FFMPEG_BIN || 'ffmpeg';
  const ffprobe = process.env.FFPROBE_BIN || 'ffprobe';
  if ((process.env.FFMPEG_BIN && !isAbsolute(ffmpeg)) || (process.env.FFPROBE_BIN && !isAbsolute(ffprobe))) {
    throw new Error('INVALID_AUDIO_BINARY');
  }
  async function probeDuration(path) {
    try {
      const result = await promisify(execFile)(ffprobe, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', formats,
        '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path],
      { signal, maxBuffer: 4096, timeout: 30000 });
      return Number(result.stdout.trim());
    } catch { throw new Error('AUDIO_CONVERSION_FAILED'); }
  }
  const duration = await probeDuration(input);
  // MediaRecorder WebM can omit duration; the decoded FLAC below must have a valid duration.
  if (Number.isFinite(duration) && duration <= 0) throw new Error('AUDIO_CONVERSION_FAILED');
  if (duration >= 18000) throw new Error('AUDIO_TOO_LONG');
  const output = `${directory}/mono.flac`;
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ['-nostdin', '-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', formats,
      '-i', input, '-vn', '-ac', '1', '-ar', '24000', '-c:a', 'flac', '-map_metadata', '-1', output],
    { stdio: 'ignore', signal });
    child.on('error', () => reject(new Error('AUDIO_CONVERSION_FAILED')));
    child.on('exit', code => code === 0 ? resolve() : reject(new Error('AUDIO_CONVERSION_FAILED')));
  });
  const decodedDuration = await probeDuration(output);
  if (!Number.isFinite(decodedDuration) || decodedDuration <= 0) throw new Error('AUDIO_CONVERSION_FAILED');
  if (decodedDuration >= 18000) throw new Error('AUDIO_TOO_LONG');
  const audio = await openAsBlob(output, { type: 'audio/flac' });
  if (audio.size >= 500000000) throw new Error('AUDIO_TOO_LARGE');
  const definition = { locales: ['zh-TW'], diarization: { enabled: true, maxSpeakers: settings.maxSpeakers },
    profanityFilterMode: 'None' };
  if (settings.keywords.length) definition.phraseList = { phrases: settings.keywords };
  const body = new FormData();
  body.append('audio', audio, 'meeting.flac');
  body.append('definition', JSON.stringify(definition));
  const response = await fetchImpl(url, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key },
    body, redirect: 'error', signal });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(response.status === 429 ? 'SPEECH_RATE_LIMIT' : `SPEECH_HTTP_${response.status}`);
  }
  return normalizeSpeech(await response.json());
}
