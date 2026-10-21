import './runtime.mjs';
import init from './pdfcraft-web-edbaa9e5d1e73ec0.js';
const response = await fetch('./pdfcraft-web-11d53b0ff85f3034_bg.wasm.gz');
if (!response.ok) throw new Error('EDITOR_LOAD_FAILED');
const bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
await init({ module_or_path: bytes });
