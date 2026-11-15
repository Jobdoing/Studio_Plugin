import './runtime.mjs';
import init from './wordcraft-web-1b64eb3600268251.js';
const response = await fetch('./wordcraft-web-e4cd89f98fbc7ecc_bg.wasm.gz');
if (!response.ok) throw new Error('EDITOR_LOAD_FAILED');
const bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
await init({ module_or_path: bytes });
