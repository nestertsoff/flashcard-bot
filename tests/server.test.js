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
