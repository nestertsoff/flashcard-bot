# Telegram Flashcard Bot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Telegram bot with an HTML5 Mini App for creating and studying vocabulary flashcard sets, with flashcard flip and multiple-choice test modes, progress tracking, and sharing.

**Architecture:** Single Docker container running a Fastify HTTP server (REST API + static Mini App) and a Telegram bot (node-telegram-bot-api). SQLite database via better-sqlite3 stored on a Docker volume. Mini App is vanilla HTML/JS/CSS authenticated via Telegram WebApp initData.

**Tech Stack:** Node.js 20, Fastify, node-telegram-bot-api, better-sqlite3, vanilla HTML5/JS/CSS, Docker

---

## File Structure

```
src/
  index.js          — entry point: loads env, inits DB, starts bot + server
  db.js             — SQLite connection, schema migration, query functions
  auth.js           — Telegram initData HMAC validation
  bot.js            — Telegram bot: commands, message parsing, set creation
  server.js         — Fastify: API routes + static file serving
public/
  index.html        — Mini App HTML shell
  style.css         — Mini App styles (cards, flip animation, quiz UI)
  app.js            — Mini App logic (API client, screens, flashcard + test modes)
tests/
  db.test.js        — Database layer tests
  auth.test.js      — initData validation tests
  bot.test.js       — Message parsing + command tests
  server.test.js    — API endpoint tests
Dockerfile
docker-compose.yml
.env.example
package.json
```

---

### Task 1: Project Setup and Dependencies

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Initialize package.json with dependencies**

```bash
cd /home/devuser/interview
rm -f package.json package-lock.json test.cs
rm -rf node_modules
```

```bash
npm init -y
npm install fastify @fastify/static better-sqlite3 node-telegram-bot-api dotenv
npm install --save-dev vitest
```

- [ ] **Step 2: Add test script to package.json**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "start": "node src/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Create .env.example**

Create `.env.example`:
```
BOT_TOKEN=your_telegram_bot_token_here
WEBAPP_URL=https://your-domain.com
DATA_DIR=./data
```

- [ ] **Step 4: Create .gitignore**

Create `.gitignore`:
```
node_modules/
data/
.env
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore
git commit -m "feat: initialize project with dependencies"
```

---

### Task 2: Database Layer

**Files:**
- Create: `src/db.js`
- Create: `tests/db.test.js`

- [ ] **Step 1: Write failing tests for database layer**

Create `tests/db.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { createDb } from '../src/db.js';

let db;
const TEST_DB = './data/test.db';

beforeEach(() => {
  fs.mkdirSync('./data', { recursive: true });
  db = createDb(TEST_DB);
});

afterEach(() => {
  db.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('users', () => {
  it('upserts a user', () => {
    db.upsertUser(111, 'alice');
    db.upsertUser(111, 'alice_new');
    const user = db.getUser(111);
    expect(user.id).toBe(111);
    expect(user.username).toBe('alice_new');
  });
});

describe('sets', () => {
  it('creates a set with cards', () => {
    db.upsertUser(1, 'bob');
    const setId = db.createSet(1, 'Animals', [
      { word: 'Hund', translations: ['собака', 'пёс'] },
      { word: 'Katze', translations: ['кошка'] },
    ]);
    expect(setId).toBeGreaterThan(0);

    const set = db.getSet(setId, 1);
    expect(set.title).toBe('Animals');
    expect(set.cards).toHaveLength(2);
    expect(set.cards[0].word).toBe('Hund');
    expect(set.cards[0].translations).toEqual(['собака', 'пёс']);
  });

  it('lists sets for a user', () => {
    db.upsertUser(1, 'bob');
    db.createSet(1, 'Set A', [{ word: 'a', translations: ['b'] }]);
    db.createSet(1, 'Set B', [{ word: 'c', translations: ['d'] }]);
    const sets = db.listSets(1);
    expect(sets).toHaveLength(2);
    expect(sets[0].title).toBe('Set A');
    expect(sets[0].card_count).toBe(1);
  });

  it('deletes a set and its cards', () => {
    db.upsertUser(1, 'bob');
    const setId = db.createSet(1, 'Temp', [{ word: 'x', translations: ['y'] }]);
    db.deleteSet(setId, 1);
    expect(db.getSet(setId, 1)).toBeNull();
  });

  it('does not delete another user set', () => {
    db.upsertUser(1, 'bob');
    db.upsertUser(2, 'eve');
    const setId = db.createSet(1, 'Mine', [{ word: 'x', translations: ['y'] }]);
    db.deleteSet(setId, 2);
    expect(db.getSet(setId, 1)).not.toBeNull();
  });
});

describe('sharing', () => {
  it('generates a share code and copies set', () => {
    db.upsertUser(1, 'bob');
    db.upsertUser(2, 'eve');
    const setId = db.createSet(1, 'Shared', [
      { word: 'a', translations: ['b'] },
    ]);
    const code = db.generateShareCode(setId, 1);
    expect(code).toHaveLength(6);

    const newSetId = db.importByShareCode(code, 2);
    expect(newSetId).toBeGreaterThan(0);
    const imported = db.getSet(newSetId, 2);
    expect(imported.title).toBe('Shared');
    expect(imported.cards).toHaveLength(1);
  });

  it('returns null for invalid share code', () => {
    expect(db.importByShareCode('nope00', 1)).toBeNull();
  });
});

describe('progress', () => {
  it('updates and retrieves progress', () => {
    db.upsertUser(1, 'bob');
    const setId = db.createSet(1, 'P', [{ word: 'w', translations: ['t'] }]);
    const cardId = db.getSet(setId, 1).cards[0].id;

    db.updateProgress(1, cardId, 'known');
    const set = db.getSet(setId, 1);
    expect(set.cards[0].status).toBe('known');
    expect(set.cards[0].mistakes).toBe(0);
  });

  it('increments mistakes on learning', () => {
    db.upsertUser(1, 'bob');
    const setId = db.createSet(1, 'P', [{ word: 'w', translations: ['t'] }]);
    const cardId = db.getSet(setId, 1).cards[0].id;

    db.updateProgress(1, cardId, 'learning');
    db.updateProgress(1, cardId, 'learning');
    const set = db.getSet(setId, 1);
    expect(set.cards[0].status).toBe('learning');
    expect(set.cards[0].mistakes).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/db.test.js`
Expected: FAIL — `Cannot find module '../src/db.js'`

- [ ] **Step 3: Implement db.js**

Create `src/db.js`:
```js
import Database from 'better-sqlite3';
import crypto from 'crypto';

export function createDb(dbPath) {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      share_code TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      set_id INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
      word TEXT NOT NULL,
      translations TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'new',
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      mistakes INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, card_id)
    );
  `);

  function upsertUser(id, username) {
    sqlite.prepare(
      `INSERT INTO users (id, username) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET username = excluded.username`
    ).run(id, username);
  }

  function getUser(id) {
    return sqlite.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
  }

  function createSet(userId, title, cards) {
    const insert = sqlite.transaction(() => {
      const { lastInsertRowid } = sqlite.prepare(
        'INSERT INTO sets (user_id, title) VALUES (?, ?)'
      ).run(userId, title);
      const setId = Number(lastInsertRowid);
      const stmt = sqlite.prepare(
        'INSERT INTO cards (set_id, word, translations) VALUES (?, ?, ?)'
      );
      for (const card of cards) {
        stmt.run(setId, card.word, JSON.stringify(card.translations));
      }
      return setId;
    });
    return insert();
  }

  function listSets(userId) {
    return sqlite.prepare(`
      SELECT s.id, s.title, s.share_code, s.created_at,
             COUNT(c.id) as card_count
      FROM sets s LEFT JOIN cards c ON c.set_id = s.id
      WHERE s.user_id = ?
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `).all(userId);
  }

  function getSet(setId, userId) {
    const set = sqlite.prepare('SELECT * FROM sets WHERE id = ? AND user_id = ?').get(setId, userId);
    if (!set) return null;
    const cards = sqlite.prepare(`
      SELECT c.id, c.word, c.translations,
             COALESCE(p.status, 'new') as status,
             COALESCE(p.mistakes, 0) as mistakes
      FROM cards c
      LEFT JOIN progress p ON p.card_id = c.id AND p.user_id = ?
      WHERE c.set_id = ?
    `).all(userId, setId);
    return {
      ...set,
      cards: cards.map(c => ({ ...c, translations: JSON.parse(c.translations) })),
    };
  }

  function deleteSet(setId, userId) {
    sqlite.prepare('DELETE FROM sets WHERE id = ? AND user_id = ?').run(setId, userId);
  }

  function generateShareCode(setId, userId) {
    const set = sqlite.prepare('SELECT * FROM sets WHERE id = ? AND user_id = ?').get(setId, userId);
    if (!set) return null;
    if (set.share_code) return set.share_code;
    const code = crypto.randomBytes(3).toString('hex');
    sqlite.prepare('UPDATE sets SET share_code = ? WHERE id = ?').run(code, setId);
    return code;
  }

  function importByShareCode(code, userId) {
    const source = sqlite.prepare('SELECT * FROM sets WHERE share_code = ?').get(code);
    if (!source) return null;
    const cards = sqlite.prepare('SELECT word, translations FROM cards WHERE set_id = ?').all(source.id);
    return createSet(userId, source.title, cards.map(c => ({
      word: c.word,
      translations: JSON.parse(c.translations),
    })));
  }

  function updateProgress(userId, cardId, status) {
    const isMistake = status === 'learning';
    sqlite.prepare(`
      INSERT INTO progress (user_id, card_id, status, mistakes, last_seen)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, card_id) DO UPDATE SET
        status = excluded.status,
        mistakes = CASE WHEN excluded.status = 'learning' THEN progress.mistakes + 1 ELSE progress.mistakes END,
        last_seen = CURRENT_TIMESTAMP
    `).run(userId, cardId, status, isMistake ? 1 : 0);
  }

  function close() {
    sqlite.close();
  }

  return {
    upsertUser, getUser, createSet, listSets, getSet,
    deleteSet, generateShareCode, importByShareCode,
    updateProgress, close,
  };
}
```

- [ ] **Step 4: Add `"type": "module"` to package.json**

In `package.json`, add at the top level:
```json
{
  "type": "module"
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/db.test.js`
Expected: All 8 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/db.js tests/db.test.js package.json
git commit -m "feat: add database layer with full test coverage"
```

---

### Task 3: Telegram initData Auth

**Files:**
- Create: `src/auth.js`
- Create: `tests/auth.test.js`

- [ ] **Step 1: Write failing tests for auth**

Create `tests/auth.test.js`:
```js
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { validateInitData } from '../src/auth.js';

const BOT_TOKEN = 'test_token_123';

function makeInitData(data, token) {
  const pairs = Object.entries(data).map(([k, v]) => `${k}=${v}`);
  const checkString = pairs
    .filter(([k]) => k !== 'hash')
    .sort()
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  pairs.push(`hash=${hash}`);
  return pairs.join('&');
}

describe('validateInitData', () => {
  it('validates correct initData', () => {
    const user = JSON.stringify({ id: 123, username: 'test' });
    const raw = makeInitData({ user, auth_date: '1234567890' }, BOT_TOKEN);
    const result = validateInitData(raw, BOT_TOKEN);
    expect(result).toEqual({ id: 123, username: 'test' });
  });

  it('rejects tampered initData', () => {
    const raw = 'user=%7B%22id%22%3A1%7D&auth_date=123&hash=invalidhash';
    const result = validateInitData(raw, BOT_TOKEN);
    expect(result).toBeNull();
  });

  it('rejects empty string', () => {
    expect(validateInitData('', BOT_TOKEN)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/auth.test.js`
Expected: FAIL — `Cannot find module '../src/auth.js'`

- [ ] **Step 3: Implement auth.js**

Create `src/auth.js`:
```js
import crypto from 'crypto';

export function validateInitData(initData, botToken) {
  if (!initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const checkString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expected = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

    if (hash !== expected) return null;

    const userStr = params.get('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    return { id: user.id, username: user.username || '' };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/auth.test.js`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/auth.js tests/auth.test.js
git commit -m "feat: add Telegram initData HMAC validation"
```

---

### Task 4: Bot Message Parsing and Commands

**Files:**
- Create: `src/bot.js`
- Create: `tests/bot.test.js`

- [ ] **Step 1: Write failing tests for message parsing**

Create `tests/bot.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { parseCardSet } from '../src/bot.js';

describe('parseCardSet', () => {
  it('parses a valid set', () => {
    const text = 'German Animals\nHund - собака, пёс\nKatze - кошка';
    const result = parseCardSet(text);
    expect(result).toEqual({
      title: 'German Animals',
      cards: [
        { word: 'Hund', translations: ['собака', 'пёс'] },
        { word: 'Katze', translations: ['кошка'] },
      ],
    });
  });

  it('skips empty lines', () => {
    const text = 'Title\n\nword1 - t1\n\nword2 - t2\n';
    const result = parseCardSet(text);
    expect(result.cards).toHaveLength(2);
  });

  it('returns null for title only', () => {
    expect(parseCardSet('Just a title')).toBeNull();
  });

  it('returns null for invalid format', () => {
    expect(parseCardSet('Title\nno dash here\nalso bad')).toBeNull();
  });

  it('trims whitespace from words and translations', () => {
    const text = 'Test\n  Hund  -  собака ,  пёс  ';
    const result = parseCardSet(text);
    expect(result.cards[0].word).toBe('Hund');
    expect(result.cards[0].translations).toEqual(['собака', 'пёс']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/bot.test.js`
Expected: FAIL — `Cannot find module '../src/bot.js'`

- [ ] **Step 3: Implement bot.js**

Create `src/bot.js`:
```js
import TelegramBot from 'node-telegram-bot-api';

export function parseCardSet(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;

  const title = lines[0].trim();
  const cards = [];

  for (let i = 1; i < lines.length; i++) {
    const sepIdx = lines[i].indexOf(' - ');
    if (sepIdx === -1) continue;
    const word = lines[i].slice(0, sepIdx).trim();
    const translationsRaw = lines[i].slice(sepIdx + 3);
    const translations = translationsRaw.split(',').map(t => t.trim()).filter(Boolean);
    if (word && translations.length > 0) {
      cards.push({ word, translations });
    }
  }

  return cards.length > 0 ? { title, cards } : null;
}

export function createBot(token, db, webAppUrl) {
  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    db.upsertUser(msg.from.id, msg.from.username || '');
    bot.sendMessage(chatId,
      'Welcome to Flashcard Bot! Send me a word list to create a set:\n\n' +
      'Title\nword1 - translation1, translation2\nword2 - translation1\n\n' +
      'Commands:\n/sets — view your sets\n/share <code> — import a shared set'
    );
  });

  bot.onText(/\/sets/, (msg) => {
    const chatId = msg.chat.id;
    db.upsertUser(msg.from.id, msg.from.username || '');
    const sets = db.listSets(msg.from.id);
    if (sets.length === 0) {
      bot.sendMessage(chatId, 'No sets yet. Send me a word list to create one!');
      return;
    }
    const buttons = sets.map(s => [{
      text: `${s.title} (${s.card_count})`,
      web_app: { url: `${webAppUrl}/app/?setId=${s.id}` },
    }]);
    bot.sendMessage(chatId, 'Your sets:', {
      reply_markup: { inline_keyboard: buttons },
    });
  });

  bot.onText(/\/share (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    db.upsertUser(userId, msg.from.username || '');
    const code = match[1].trim();
    const newSetId = db.importByShareCode(code, userId);
    if (!newSetId) {
      bot.sendMessage(chatId, 'Invalid share code.');
      return;
    }
    const set = db.getSet(newSetId, userId);
    bot.sendMessage(chatId, `Imported "${set.title}" (${set.cards.length} cards)`, {
      reply_markup: {
        inline_keyboard: [[{
          text: 'Learn',
          web_app: { url: `${webAppUrl}/app/?setId=${newSetId}` },
        }]],
      },
    });
  });

  bot.on('message', (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    db.upsertUser(userId, msg.from.username || '');

    const parsed = parseCardSet(msg.text);
    if (!parsed) {
      bot.sendMessage(chatId,
        'Could not parse your message. Use this format:\n\n' +
        'Title\nword1 - translation1, translation2\nword2 - translation1'
      );
      return;
    }

    const setId = db.createSet(userId, parsed.title, parsed.cards);
    bot.sendMessage(chatId, `Set "${parsed.title}" created (${parsed.cards.length} cards)`, {
      reply_markup: {
        inline_keyboard: [[{
          text: 'Learn',
          web_app: { url: `${webAppUrl}/app/?setId=${setId}` },
        }]],
      },
    });
  });

  return bot;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/bot.test.js`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/bot.js tests/bot.test.js
git commit -m "feat: add bot message parsing and Telegram commands"
```

---

### Task 5: Fastify Server and API Routes

**Files:**
- Create: `src/server.js`
- Create: `tests/server.test.js`

- [ ] **Step 1: Write failing tests for API**

Create `tests/server.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import crypto from 'crypto';
import { createDb } from '../src/db.js';
import { buildServer } from '../src/server.js';

const BOT_TOKEN = 'test_token_123';
const TEST_DB = './data/test_server.db';
let db, server;

function makeInitData(userId, username) {
  const user = JSON.stringify({ id: userId, username });
  const data = { user, auth_date: '1234567890' };
  const checkString = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  return `user=${encodeURIComponent(user)}&auth_date=1234567890&hash=${hash}`;
}

beforeEach(async () => {
  fs.mkdirSync('./data', { recursive: true });
  db = createDb(TEST_DB);
  server = buildServer(db, BOT_TOKEN);
  await server.ready();
});

afterEach(async () => {
  await server.close();
  db.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('GET /api/sets', () => {
  it('returns empty list for new user', async () => {
    db.upsertUser(1, 'bob');
    const res = await server.inject({
      method: 'GET', url: '/api/sets',
      headers: { 'x-telegram-init-data': makeInitData(1, 'bob') },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns 401 without auth', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/sets' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/sets/:id', () => {
  it('returns set with cards and progress', async () => {
    db.upsertUser(1, 'bob');
    const setId = db.createSet(1, 'Test', [{ word: 'a', translations: ['b'] }]);
    const res = await server.inject({
      method: 'GET', url: `/api/sets/${setId}`,
      headers: { 'x-telegram-init-data': makeInitData(1, 'bob') },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.title).toBe('Test');
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].status).toBe('new');
  });

  it('returns 404 for other user set', async () => {
    db.upsertUser(1, 'bob');
    db.upsertUser(2, 'eve');
    const setId = db.createSet(1, 'Test', [{ word: 'a', translations: ['b'] }]);
    const res = await server.inject({
      method: 'GET', url: `/api/sets/${setId}`,
      headers: { 'x-telegram-init-data': makeInitData(2, 'eve') },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/sets/:id', () => {
  it('deletes own set', async () => {
    db.upsertUser(1, 'bob');
    const setId = db.createSet(1, 'Del', [{ word: 'a', translations: ['b'] }]);
    const res = await server.inject({
      method: 'DELETE', url: `/api/sets/${setId}`,
      headers: { 'x-telegram-init-data': makeInitData(1, 'bob') },
    });
    expect(res.statusCode).toBe(200);
    expect(db.getSet(setId, 1)).toBeNull();
  });
});

describe('POST /api/sets/:id/share', () => {
  it('generates a share code', async () => {
    db.upsertUser(1, 'bob');
    const setId = db.createSet(1, 'Sh', [{ word: 'a', translations: ['b'] }]);
    const res = await server.inject({
      method: 'POST', url: `/api/sets/${setId}/share`,
      headers: { 'x-telegram-init-data': makeInitData(1, 'bob') },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().code).toHaveLength(6);
  });
});

describe('POST /api/progress', () => {
  it('updates card progress', async () => {
    db.upsertUser(1, 'bob');
    const setId = db.createSet(1, 'P', [{ word: 'w', translations: ['t'] }]);
    const cardId = db.getSet(setId, 1).cards[0].id;
    const res = await server.inject({
      method: 'POST', url: '/api/progress',
      headers: {
        'x-telegram-init-data': makeInitData(1, 'bob'),
        'content-type': 'application/json',
      },
      payload: { cardId, status: 'known' },
    });
    expect(res.statusCode).toBe(200);
    expect(db.getSet(setId, 1).cards[0].status).toBe('known');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server.test.js`
Expected: FAIL — `Cannot find module '../src/server.js'`

- [ ] **Step 3: Implement server.js**

Create `src/server.js`:
```js
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateInitData } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function buildServer(db, botToken) {
  const app = Fastify();

  app.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'public'),
    prefix: '/app/',
  });

  app.decorateRequest('telegramUser', null);

  app.addHook('preHandler', (req, reply, done) => {
    if (!req.url.startsWith('/api/')) return done();
    const initData = req.headers['x-telegram-init-data'];
    const user = validateInitData(initData, botToken);
    if (!user) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
    db.upsertUser(user.id, user.username);
    req.telegramUser = user;
    done();
  });

  app.get('/api/sets', (req) => {
    return db.listSets(req.telegramUser.id);
  });

  app.get('/api/sets/:id', (req, reply) => {
    const set = db.getSet(Number(req.params.id), req.telegramUser.id);
    if (!set) return reply.code(404).send({ error: 'Not found' });
    return set;
  });

  app.delete('/api/sets/:id', (req) => {
    db.deleteSet(Number(req.params.id), req.telegramUser.id);
    return { ok: true };
  });

  app.post('/api/sets/:id/share', (req, reply) => {
    const code = db.generateShareCode(Number(req.params.id), req.telegramUser.id);
    if (!code) return reply.code(404).send({ error: 'Not found' });
    return { code };
  });

  app.post('/api/progress', (req) => {
    const { cardId, status } = req.body;
    db.updateProgress(req.telegramUser.id, cardId, status);
    return { ok: true };
  });

  return app;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server.test.js`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/server.js tests/server.test.js
git commit -m "feat: add Fastify REST API with auth and full test coverage"
```

---

### Task 6: Entry Point

**Files:**
- Create: `src/index.js`

- [ ] **Step 1: Create src/index.js**

Create `src/index.js`:
```js
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
```

- [ ] **Step 2: Commit**

```bash
git add src/index.js
git commit -m "feat: add entry point wiring bot, server, and database"
```

---

### Task 7: Mini App — HTML Shell and Styles

**Files:**
- Create: `public/index.html`
- Create: `public/style.css`

- [ ] **Step 1: Create public/index.html**

Create `public/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Flashcards</title>
  <link rel="stylesheet" href="style.css">
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
</head>
<body>
  <div id="app">
    <!-- Set screen -->
    <div id="screen-set" class="screen hidden">
      <h1 id="set-title"></h1>
      <div id="set-progress" class="progress-bar">
        <span class="known"></span>
        <span class="learning"></span>
        <span class="new"></span>
      </div>
      <div id="set-stats" class="stats"></div>

      <div class="direction-toggle">
        <button id="btn-dir" class="btn-secondary">Word → Translation</button>
      </div>

      <div class="action-buttons">
        <button id="btn-cards" class="btn-primary">Cards</button>
        <button id="btn-test" class="btn-primary">Test</button>
      </div>

      <button id="btn-share" class="btn-secondary">Share</button>
      <div id="share-code" class="share-code hidden"></div>

      <div id="word-list" class="word-list"></div>
    </div>

    <!-- Flashcard screen -->
    <div id="screen-flashcard" class="screen hidden">
      <div id="flashcard-counter" class="counter"></div>
      <div id="flashcard" class="card">
        <div class="card-inner">
          <div class="card-front"><span id="card-front-text"></span></div>
          <div class="card-back"><span id="card-back-text"></span></div>
        </div>
      </div>
      <div id="flashcard-buttons" class="card-buttons hidden">
        <button id="btn-dont-know" class="btn-danger">Don't know</button>
        <button id="btn-know" class="btn-success">Know</button>
      </div>
    </div>

    <!-- Test screen -->
    <div id="screen-test" class="screen hidden">
      <div id="test-counter" class="counter"></div>
      <div id="test-word" class="test-word"></div>
      <div id="test-options" class="test-options"></div>
      <button id="btn-next" class="btn-primary hidden">Next</button>
    </div>

    <!-- Results screen -->
    <div id="screen-results" class="screen hidden">
      <h2>Results</h2>
      <div id="results-score" class="results-score"></div>
      <div id="results-details" class="results-details"></div>
      <button id="btn-restart" class="btn-primary">Try Again</button>
    </div>

    <!-- Loading -->
    <div id="screen-loading" class="screen">
      <div class="loader"></div>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create public/style.css**

Create `public/style.css`:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg: var(--tg-theme-bg-color, #ffffff);
  --text: var(--tg-theme-text-color, #000000);
  --hint: var(--tg-theme-hint-color, #999999);
  --link: var(--tg-theme-link-color, #2678b6);
  --btn: var(--tg-theme-button-color, #2678b6);
  --btn-text: var(--tg-theme-button-text-color, #ffffff);
  --secondary-bg: var(--tg-theme-secondary-bg-color, #f0f0f0);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  padding: 16px;
  -webkit-user-select: none;
  user-select: none;
}

.screen { display: flex; flex-direction: column; gap: 16px; }
.hidden { display: none !important; }

h1 { font-size: 24px; text-align: center; }
h2 { font-size: 20px; text-align: center; }

/* Buttons */
.btn-primary, .btn-secondary, .btn-danger, .btn-success {
  padding: 14px 24px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-primary { background: var(--btn); color: var(--btn-text); }
.btn-secondary { background: var(--secondary-bg); color: var(--text); }
.btn-danger { background: #ff3b30; color: white; }
.btn-success { background: #34c759; color: white; }
button:active { opacity: 0.7; }

.action-buttons { display: flex; gap: 12px; }
.action-buttons .btn-primary { flex: 1; }

/* Progress bar */
.progress-bar {
  display: flex; height: 8px; border-radius: 4px;
  overflow: hidden; background: var(--secondary-bg);
}
.progress-bar .known { background: #34c759; }
.progress-bar .learning { background: #ff9500; }
.progress-bar .new { background: var(--secondary-bg); }
.stats { text-align: center; font-size: 14px; color: var(--hint); }

/* Direction toggle */
.direction-toggle { text-align: center; }
.direction-toggle button { width: 100%; }

/* Share */
.share-code {
  text-align: center; font-size: 24px; font-weight: 700;
  letter-spacing: 4px; padding: 12px;
  background: var(--secondary-bg); border-radius: 12px;
}

/* Word list */
.word-list { display: flex; flex-direction: column; gap: 8px; }
.word-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px; background: var(--secondary-bg); border-radius: 8px;
}
.word-item .word { font-weight: 600; }
.word-item .translation { color: var(--hint); text-align: right; }

/* Flashcard */
.counter { text-align: center; color: var(--hint); font-size: 14px; }

.card {
  perspective: 1000px; width: 100%; height: 250px;
  cursor: pointer; margin: 0 auto;
}
.card-inner {
  position: relative; width: 100%; height: 100%;
  transition: transform 0.5s;
  transform-style: preserve-3d;
}
.card.flipped .card-inner { transform: rotateY(180deg); }
.card-front, .card-back {
  position: absolute; width: 100%; height: 100%;
  backface-visibility: hidden;
  display: flex; align-items: center; justify-content: center;
  background: var(--secondary-bg); border-radius: 16px;
  padding: 24px; font-size: 28px; font-weight: 600;
  text-align: center; word-break: break-word;
}
.card-back { transform: rotateY(180deg); }

.card-buttons { display: flex; gap: 12px; }
.card-buttons button { flex: 1; }

/* Test */
.test-word {
  text-align: center; font-size: 28px; font-weight: 600;
  padding: 24px; background: var(--secondary-bg);
  border-radius: 16px;
}
.test-options { display: flex; flex-direction: column; gap: 10px; }
.test-option {
  padding: 16px; border: 2px solid var(--secondary-bg);
  border-radius: 12px; font-size: 16px;
  background: var(--bg); cursor: pointer;
  transition: all 0.2s; text-align: center;
}
.test-option.correct { border-color: #34c759; background: #34c75920; }
.test-option.wrong { border-color: #ff3b30; background: #ff3b3020; }
.test-option.disabled { pointer-events: none; }

/* Results */
.results-score {
  text-align: center; font-size: 48px; font-weight: 700;
  color: var(--btn);
}
.results-details { display: flex; flex-direction: column; gap: 8px; }
.result-item {
  display: flex; justify-content: space-between;
  padding: 10px; background: var(--secondary-bg); border-radius: 8px;
}
.result-item.wrong { border-left: 3px solid #ff3b30; }
.result-item.right { border-left: 3px solid #34c759; }

/* Loader */
.loader {
  width: 40px; height: 40px; margin: 40vh auto;
  border: 3px solid var(--secondary-bg);
  border-top-color: var(--btn);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

- [ ] **Step 3: Commit**

```bash
git add public/index.html public/style.css
git commit -m "feat: add Mini App HTML shell and CSS styles"
```

---

### Task 8: Mini App — JavaScript Logic

**Files:**
- Create: `public/app.js`

- [ ] **Step 1: Create public/app.js — API client and state**

Create `public/app.js`:
```js
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const API_BASE = '/api';
const initData = tg.initData;

async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      'X-Telegram-Init-Data': initData,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API_BASE + path, opts);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// State
let currentSet = null;
let cards = [];
let cardIndex = 0;
let direction = 'word'; // 'word' = word→translation, 'translation' = translation→word
let results = [];
let mode = null; // 'flashcard' | 'test'

// Screens
const screens = {
  set: document.getElementById('screen-set'),
  flashcard: document.getElementById('screen-flashcard'),
  test: document.getElementById('screen-test'),
  results: document.getElementById('screen-results'),
  loading: document.getElementById('screen-loading'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

// Back button
tg.BackButton.onClick(() => {
  if (mode) {
    mode = null;
    showScreen('set');
    tg.BackButton.hide();
  }
});

// --- SET SCREEN ---

async function loadSet() {
  const params = new URLSearchParams(window.location.search);
  const setId = params.get('setId');
  if (!setId) return;

  showScreen('loading');
  currentSet = await api('GET', `/sets/${setId}`);
  renderSet();
  showScreen('set');
}

function renderSet() {
  document.getElementById('set-title').textContent = currentSet.title;

  const known = currentSet.cards.filter(c => c.status === 'known').length;
  const learning = currentSet.cards.filter(c => c.status === 'learning').length;
  const newCount = currentSet.cards.length - known - learning;
  const total = currentSet.cards.length || 1;

  const bar = document.getElementById('set-progress');
  bar.querySelector('.known').style.flex = known / total;
  bar.querySelector('.learning').style.flex = learning / total;
  bar.querySelector('.new').style.flex = newCount / total;

  document.getElementById('set-stats').textContent =
    `${known} known · ${learning} learning · ${newCount} new · ${currentSet.cards.length} total`;

  const list = document.getElementById('word-list');
  list.innerHTML = currentSet.cards.map(c =>
    `<div class="word-item">
      <span class="word">${esc(c.word)}</span>
      <span class="translation">${esc(c.translations.join(', '))}</span>
    </div>`
  ).join('');
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Direction toggle
const btnDir = document.getElementById('btn-dir');
btnDir.addEventListener('click', () => {
  direction = direction === 'word' ? 'translation' : 'word';
  btnDir.textContent = direction === 'word' ? 'Word → Translation' : 'Translation → Word';
});

// Share
document.getElementById('btn-share').addEventListener('click', async () => {
  const codeEl = document.getElementById('share-code');
  if (!codeEl.classList.contains('hidden')) {
    codeEl.classList.add('hidden');
    return;
  }
  const { code } = await api('POST', `/sets/${currentSet.id}/share`);
  codeEl.textContent = code;
  codeEl.classList.remove('hidden');
});

// --- FLASHCARD MODE ---

document.getElementById('btn-cards').addEventListener('click', () => {
  mode = 'flashcard';
  cards = sortCards(currentSet.cards);
  cardIndex = 0;
  results = [];
  showScreen('flashcard');
  tg.BackButton.show();
  renderFlashcard();
});

function sortCards(cardList) {
  const order = { learning: 0, new: 1, known: 2 };
  return [...cardList].sort((a, b) => order[a.status] - order[b.status]);
}

function renderFlashcard() {
  if (cardIndex >= cards.length) {
    showResults();
    return;
  }
  const card = cards[cardIndex];
  const counter = document.getElementById('flashcard-counter');
  counter.textContent = `${cardIndex + 1} / ${cards.length}`;

  const front = direction === 'word' ? card.word : card.translations.join(', ');
  const back = direction === 'word' ? card.translations.join(', ') : card.word;

  document.getElementById('card-front-text').textContent = front;
  document.getElementById('card-back-text').textContent = back;

  const cardEl = document.getElementById('flashcard');
  cardEl.classList.remove('flipped');
  document.getElementById('flashcard-buttons').classList.add('hidden');
}

document.getElementById('flashcard').addEventListener('click', () => {
  const cardEl = document.getElementById('flashcard');
  cardEl.classList.toggle('flipped');
  if (cardEl.classList.contains('flipped')) {
    document.getElementById('flashcard-buttons').classList.remove('hidden');
  }
});

document.getElementById('btn-know').addEventListener('click', async () => {
  const card = cards[cardIndex];
  await api('POST', '/progress', { cardId: card.id, status: 'known' });
  results.push({ card, correct: true });
  cardIndex++;
  renderFlashcard();
});

document.getElementById('btn-dont-know').addEventListener('click', async () => {
  const card = cards[cardIndex];
  await api('POST', '/progress', { cardId: card.id, status: 'learning' });
  results.push({ card, correct: false });
  cardIndex++;
  renderFlashcard();
});

// --- TEST MODE ---

document.getElementById('btn-test').addEventListener('click', () => {
  mode = 'test';
  cards = sortCards(currentSet.cards);
  cardIndex = 0;
  results = [];
  showScreen('test');
  tg.BackButton.show();
  renderTestQuestion();
});

function renderTestQuestion() {
  if (cardIndex >= cards.length) {
    showResults();
    return;
  }
  const card = cards[cardIndex];
  document.getElementById('test-counter').textContent = `${cardIndex + 1} / ${cards.length}`;

  const question = direction === 'word' ? card.word : card.translations.join(', ');
  document.getElementById('test-word').textContent = question;

  const correctAnswer = direction === 'word' ? card.translations.join(', ') : card.word;
  const allAnswers = currentSet.cards.map(c =>
    direction === 'word' ? c.translations.join(', ') : c.word
  );
  const wrongAnswers = allAnswers
    .filter(a => a !== correctAnswer)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const options = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);

  const container = document.getElementById('test-options');
  container.innerHTML = options.map(opt =>
    `<div class="test-option" data-answer="${esc(opt)}" data-correct="${opt === correctAnswer}">${esc(opt)}</div>`
  ).join('');

  document.getElementById('btn-next').classList.add('hidden');

  container.querySelectorAll('.test-option').forEach(el => {
    el.addEventListener('click', () => handleTestAnswer(el, card, correctAnswer));
  });
}

async function handleTestAnswer(el, card, correctAnswer) {
  const allOptions = document.querySelectorAll('.test-option');
  allOptions.forEach(o => o.classList.add('disabled'));

  const chosen = el.dataset.answer;
  const isCorrect = chosen === correctAnswer;

  if (isCorrect) {
    el.classList.add('correct');
    await api('POST', '/progress', { cardId: card.id, status: 'known' });
  } else {
    el.classList.add('wrong');
    allOptions.forEach(o => {
      if (o.dataset.correct === 'true') o.classList.add('correct');
    });
    await api('POST', '/progress', { cardId: card.id, status: 'learning' });
  }

  results.push({ card, correct: isCorrect });
  document.getElementById('btn-next').classList.remove('hidden');
}

document.getElementById('btn-next').addEventListener('click', () => {
  cardIndex++;
  renderTestQuestion();
});

// --- RESULTS ---

function showResults() {
  mode = null;
  const correct = results.filter(r => r.correct).length;
  document.getElementById('results-score').textContent = `${correct} / ${results.length}`;

  document.getElementById('results-details').innerHTML = results.map(r =>
    `<div class="result-item ${r.correct ? 'right' : 'wrong'}">
      <span>${esc(r.card.word)}</span>
      <span>${esc(r.card.translations.join(', '))}</span>
    </div>`
  ).join('');

  showScreen('results');
}

document.getElementById('btn-restart').addEventListener('click', async () => {
  currentSet = await api('GET', `/sets/${currentSet.id}`);
  renderSet();
  showScreen('set');
  tg.BackButton.hide();
});

// --- INIT ---
loadSet();
```

- [ ] **Step 2: Commit**

```bash
git add public/app.js
git commit -m "feat: add Mini App JavaScript — flashcard and test modes"
```

---

### Task 9: Docker Setup

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Step 1: Create Dockerfile**

Create `Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY src/ src/
COPY public/ public/
EXPOSE 3000
VOLUME /app/data
CMD ["node", "src/index.js"]
```

- [ ] **Step 2: Create docker-compose.yml**

Create `docker-compose.yml`:
```yaml
services:
  bot:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - bot-data:/app/data
    environment:
      - BOT_TOKEN=${BOT_TOKEN}
      - WEBAPP_URL=${WEBAPP_URL}
      - DATA_DIR=/app/data
    restart: unless-stopped

volumes:
  bot-data:
```

- [ ] **Step 3: Create .dockerignore**

Create `.dockerignore`:
```
node_modules
data
.env
.git
docs
tests
```

- [ ] **Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "feat: add Docker and docker-compose configuration"
```

---

### Task 10: Run All Tests and Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (db: 8, auth: 3, bot: 5, server: 6 = 22 total)

- [ ] **Step 2: Verify Docker build**

Run: `docker build -t flashcard-bot .`
Expected: Build succeeds

- [ ] **Step 3: Final commit with any fixes**

If any fixes were needed, commit them. Otherwise skip.

```bash
git add -A
git commit -m "chore: final verification — all tests pass, Docker builds"
```
