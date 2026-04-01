import 'dotenv/config';
import fs from 'fs';
import { createDb } from './db.js';
import { createBot } from './bot.js';
import { buildServer } from './server.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const DATA_DIR = process.env.DATA_DIR || './data';
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN || !WEBAPP_URL) {
  console.error('Missing BOT_TOKEN or WEBAPP_URL in environment');
  process.exit(1);
}

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = createDb(`${DATA_DIR}/bot.db`);
const bot = createBot(BOT_TOKEN, db, WEBAPP_URL);
const server = buildServer(db, BOT_TOKEN);

server.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening on ${address}`);
  console.log('Bot started polling...');
});

process.on('SIGTERM', () => {
  bot.stopPolling();
  server.close();
  db.close();
});
