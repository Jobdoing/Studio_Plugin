import './runtime.mjs';
import init from './gridcraft-web-1e7088f5e84b40fa.js';
const response = await fetch('./gridcraft-web-3bf0df056ca4d757_bg.wasm.gz');
if (!response.ok) throw new Error('EDITOR_LOAD_FAILED');
const bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
await init({ module_or_path: bytes });
