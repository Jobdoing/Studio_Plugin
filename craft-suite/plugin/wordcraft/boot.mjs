import './runtime.mjs';
import init from './wordcraft-web-a027e458b8897950.js';
const response = await fetch('./wordcraft-web-40ca908605f1e31_bg.wasm.gz');
if (!response.ok) throw new Error('EDITOR_LOAD_FAILED');
const bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
await init({ module_or_path: bytes });
