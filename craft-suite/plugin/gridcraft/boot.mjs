import './runtime.mjs';
import init from './gridcraft-web-6c5d49416a3b59c0.js';
const response = await fetch('./gridcraft-web-8313ce6939890b91_bg.wasm.gz');
if (!response.ok) throw new Error('EDITOR_LOAD_FAILED');
const bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
await init({ module_or_path: bytes });
