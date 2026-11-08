import './runtime.mjs';
import init from './cadcraft-web-1e642a8f956629ad.js';
const response = await fetch('./cadcraft-web-f6d7a0377c5bcce2_bg.wasm.gz');
if (!response.ok) throw new Error('EDITOR_LOAD_FAILED');
const bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
await init({ module_or_path: bytes });
