import './runtime.mjs';
import init from './pdfcraft-web-40a1922bc4fb6772.js';
const response = await fetch('./pdfcraft-web-f2defff5d2942191_bg.wasm.gz');
if (!response.ok) throw new Error('EDITOR_LOAD_FAILED');
const bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
await init({ module_or_path: bytes });
