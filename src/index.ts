import 'dotenv/config';
import { loadConfig } from './config.js';
import { buildServer } from './server.js';

const config = loadConfig();
const server = await buildServer(config);

await server.listen({ port: config.PORT, host: '0.0.0.0' });
