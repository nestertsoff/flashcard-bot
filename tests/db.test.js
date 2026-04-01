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
  it('creates and retrieves a user', () => {
    const id = db.createUser('alice', 'hash123');
    expect(id).toBeGreaterThan(0);
    const user = db.getUserById(id);
    expect(user.username).toBe('alice');
  });

  it('finds user by username', () => {
    db.createUser('bob', 'hash');
    const user = db.getUserByUsername('bob');
    expect(user.username).toBe('bob');
    expect(user.password).toBe('hash');
  });

  it('returns null for missing user', () => {
    expect(db.getUserByUsername('nope')).toBeNull();
    expect(db.getUserById(999)).toBeNull();
  });
});

describe('sets and cards', () => {
  it('creates set with cards and adds single card', () => {
    const uid = db.createUser('u', 'p');
    const setId = db.createSet(uid, 'Animals', [
      { word: 'Hund', translations: ['dog'] },
    ]);
    db.addCard(setId, uid, 'Katze', ['cat']);
    const set = db.getSet(setId, uid);
    expect(set.title).toBe('Animals');
    expect(set.cards).toHaveLength(2);
  });

  it('lists sets with progress counts', () => {
    const uid = db.createUser('u', 'p');
    db.createSet(uid, 'A', [{ word: 'w', translations: ['t'] }]);
    const sets = db.listSets(uid);
    expect(sets).toHaveLength(1);
    expect(sets[0].card_count).toBe(1);
  });

  it('deletes set and cards cascade', () => {
    const uid = db.createUser('u', 'p');
    const setId = db.createSet(uid, 'Del', [{ word: 'x', translations: ['y'] }]);
    db.deleteSet(setId, uid);
    expect(db.getSet(setId, uid)).toBeNull();
  });

  it('deletes individual card', () => {
    const uid = db.createUser('u', 'p');
    const setId = db.createSet(uid, 'S', [{ word: 'w', translations: ['t'] }]);
    const cardId = db.getSet(setId, uid).cards[0].id;
    db.deleteCard(cardId, uid);
    expect(db.getSet(setId, uid).cards).toHaveLength(0);
  });
});

describe('sharing', () => {
  it('generates share code and imports', () => {
    const uid1 = db.createUser('u1', 'p');
    const uid2 = db.createUser('u2', 'p');
    const setId = db.createSet(uid1, 'Shared', [{ word: 'a', translations: ['b'] }]);
    const code = db.generateShareCode(setId, uid1);
    expect(code).toHaveLength(6);
    const newSetId = db.importByShareCode(code, uid2);
    const imported = db.getSet(newSetId, uid2);
    expect(imported.title).toBe('Shared');
    expect(imported.cards).toHaveLength(1);
  });
});

describe('progress', () => {
  it('tracks mistakes on learning', () => {
    const uid = db.createUser('u', 'p');
    const setId = db.createSet(uid, 'P', [{ word: 'w', translations: ['t'] }]);
    const cardId = db.getSet(setId, uid).cards[0].id;
    db.updateProgress(uid, cardId, 'learning');
    db.updateProgress(uid, cardId, 'learning');
    expect(db.getSet(setId, uid).cards[0].mistakes).toBe(2);
  });
});
