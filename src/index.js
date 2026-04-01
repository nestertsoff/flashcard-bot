import 'dotenv/config';
import fs from 'fs';
import { createDb } from './db.js';
import { buildServer } from './server.js';

const JWT_SECRET = process.env.JWT_SECRET;
const DATA_DIR = process.env.DATA_DIR || './data';
const PORT = process.env.PORT || 3000;

if (!JWT_SECRET) {
  console.error('Missing JWT_SECRET in environment');
  process.exit(1);
}

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = createDb(`${DATA_DIR}/bot.db`);
const server = buildServer(db, JWT_SECRET);

server.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening on ${address}`);
});

process.on('SIGTERM', () => {
  server.close();
  db.close();
});
