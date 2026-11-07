import './runtime.mjs';
import init from './deckcraft-web-11eb66d1c3fa6dbf.js';
const response = await fetch('./deckcraft-web-645214441b21eba9_bg.wasm.gz');
if (!response.ok) throw new Error('EDITOR_LOAD_FAILED');
const bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
await init({ module_or_path: bytes });
