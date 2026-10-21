import './runtime.mjs';
import init from './deckcraft-web-7ec1a5ff362261ed.js';
const response = await fetch('./deckcraft-web-75e9573652b725e8_bg.wasm.gz');
if (!response.ok) throw new Error('EDITOR_LOAD_FAILED');
const bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
await init({ module_or_path: bytes });
