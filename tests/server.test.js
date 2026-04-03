import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { createDb } from '../src/db.js';
import { buildServer } from '../src/server.js';

const JWT_SECRET = 'test_secret';
const TEST_DB = './data/test_server.db';
let db, server;

beforeEach(async () => {
  fs.mkdirSync('./data', { recursive: true });
  db = createDb(TEST_DB);
  server = buildServer(db, JWT_SECRET);
  await server.ready();
});

afterEach(async () => {
  await server.close();
  db.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

async function registerAndGetCookie(username = 'testuser', password = 'password123') {
  const res = await server.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { username, password },
  });
  const cookie = res.cookies.find(c => c.name === 'token');
  return { res, cookie: `token=${cookie.value}` };
}

describe('auth', () => {
  it('registers and returns user', async () => {
    const { res } = await registerAndGetCookie();
    expect(res.statusCode).toBe(200);
    expect(res.json().username).toBe('testuser');
  });

  it('rejects duplicate username', async () => {
    await registerAndGetCookie();
    const res = await server.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { username: 'testuser', password: 'password123' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('logs in with correct credentials', async () => {
    await registerAndGetCookie();
    const res = await server.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { username: 'testuser', password: 'password123' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().username).toBe('testuser');
  });

  it('rejects wrong password', async () => {
    await registerAndGetCookie();
    const res = await server.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { username: 'testuser', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 without cookie', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/sets' });
    expect(res.statusCode).toBe(401);
  });

  it('returns user from /me', async () => {
    const { cookie } = await registerAndGetCookie();
    const res = await server.inject({
      method: 'GET', url: '/api/auth/me',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().username).toBe('testuser');
  });
});

describe('sets API', () => {
  it('creates and lists sets', async () => {
    const { cookie } = await registerAndGetCookie();
    const create = await server.inject({
      method: 'POST', url: '/api/sets',
      headers: { cookie },
      payload: { title: 'Test', cards: [{ word: 'hi', translations: ['привет'] }] },
    });
    expect(create.statusCode).toBe(200);
    expect(create.json().title).toBe('Test');

    const list = await server.inject({
      method: 'GET', url: '/api/sets',
      headers: { cookie },
    });
    expect(list.json()).toHaveLength(1);
  });

  it('adds card to set', async () => {
    const { cookie } = await registerAndGetCookie();
    const set = await server.inject({
      method: 'POST', url: '/api/sets',
      headers: { cookie },
      payload: { title: 'S', cards: [] },
    });
    const setId = set.json().id;
    const add = await server.inject({
      method: 'POST', url: `/api/sets/${setId}/cards`,
      headers: { cookie },
      payload: { word: 'hello', translations: ['привет'] },
    });
    expect(add.statusCode).toBe(200);
    expect(add.json().word).toBe('hello');
  });

  it('shares and imports set', async () => {
    const { cookie: c1 } = await registerAndGetCookie('user1');
    const { cookie: c2 } = await registerAndGetCookie('user2', 'pass222222');
    const set = await server.inject({
      method: 'POST', url: '/api/sets',
      headers: { cookie: c1 },
      payload: { title: 'Shared', cards: [{ word: 'a', translations: ['b'] }] },
    });
    const share = await server.inject({
      method: 'POST', url: `/api/sets/${set.json().id}/share`,
      headers: { cookie: c1 },
    });
    const code = share.json().code;
    const imp = await server.inject({
      method: 'POST', url: `/api/share/${code}`,
      headers: { cookie: c2 },
    });
    expect(imp.statusCode).toBe(200);
    expect(imp.json().title).toBe('Shared');
  });

  it('returns review cards', async () => {
    const { cookie } = await registerAndGetCookie('reviewuser', 'password123');
    await server.inject({ method: 'POST', url: '/api/sets', headers: { cookie }, payload: { title: 'Review', cards: [{ word: 'hello', translations: ['привет'] }] } });
    const res = await server.inject({ method: 'GET', url: '/api/review?limit=10', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].word).toBe('hello');
    expect(body.cards[0].lang).toBe('en');
  });
});
