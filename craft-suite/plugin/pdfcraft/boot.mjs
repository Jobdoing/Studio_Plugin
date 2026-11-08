import './runtime.mjs';
import init from './pdfcraft-web-29dd77cc741681a1.js';
const response = await fetch('./pdfcraft-web-d40df54f5e2f42c3_bg.wasm.gz');
if (!response.ok) throw new Error('EDITOR_LOAD_FAILED');
const bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
await init({ module_or_path: bytes });
