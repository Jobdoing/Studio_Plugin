import './runtime.mjs';
import init from './wordcraft-web-d0c6768ff251c2c5.js';
const response = await fetch('./wordcraft-web-ba30c028b7af90ef_bg.wasm.gz');
if (!response.ok) throw new Error('EDITOR_LOAD_FAILED');
const bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
await init({ module_or_path: bytes });
