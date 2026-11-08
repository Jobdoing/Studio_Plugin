import './runtime.mjs';
import init from './gridcraft-web-53d7453232189972.js';
const response = await fetch('./gridcraft-web-ea5eca87963dcc01_bg.wasm.gz');
if (!response.ok) throw new Error('EDITOR_LOAD_FAILED');
const bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
await init({ module_or_path: bytes });
