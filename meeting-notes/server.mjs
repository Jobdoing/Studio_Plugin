import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { startServer } from './backend/server.mjs';

const config = new URL('./backend/.env', import.meta.url);
if (existsSync(config)) loadEnvFile(fileURLToPath(config));
await startServer();
