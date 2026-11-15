import './runtime.mjs';
import init from './deckcraft-web-32c8b224a785265a.js';
const response = await fetch('./deckcraft-web-9d481d878eb74bc3_bg.wasm.gz');
if (!response.ok) throw new Error('EDITOR_LOAD_FAILED');
const bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
await init({ module_or_path: bytes });
