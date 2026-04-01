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
      ORDER BY s.created_at ASC
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
