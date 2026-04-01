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
