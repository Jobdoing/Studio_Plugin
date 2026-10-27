import './runtime.mjs';
import init from './deckcraft-web-bfc6f8c55a13c384.js';
const response = await fetch('./deckcraft-web-5a53bd7edd5c05c9_bg.wasm.gz');
if (!response.ok) throw new Error('EDITOR_LOAD_FAILED');
const bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
await init({ module_or_path: bytes });
