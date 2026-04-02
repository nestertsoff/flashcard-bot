import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPassword, comparePassword, signToken, authMiddleware } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

export function buildServer(db, jwtSecret) {
  const app = Fastify();

  app.register(fastifyCookie);

  app.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'client', 'dist'),
    prefix: '/',
    wildcard: false,
    setHeaders(reply, filePath) {
      if (filePath.endsWith('.html')) {
        reply.setHeader('Cache-Control', 'no-cache');
      } else {
        reply.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  });

  app.decorateRequest('user', null);
  app.addHook('preHandler', authMiddleware(jwtSecret, db));

  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  };

  // --- AUTH ---

  app.post('/api/auth/register', async (req, reply) => {
    const { username, password } = req.body || {};
    if (!username || !USERNAME_RE.test(username)) {
      return reply.code(400).send({ error: 'Username must be 3-30 alphanumeric characters or underscores' });
    }
    if (!password || password.length < 6) {
      return reply.code(400).send({ error: 'Password must be at least 6 characters' });
    }
    if (db.getUserByUsername(username)) {
      return reply.code(409).send({ error: 'Username already taken' });
    }
    const hashed = await hashPassword(password);
    const userId = db.createUser(username, hashed);
    const token = signToken(userId, jwtSecret);
    reply.setCookie('token', token, cookieOpts);
    return { id: userId, username };
  });

  app.post('/api/auth/login', async (req, reply) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return reply.code(400).send({ error: 'Username and password required' });
    }
    const user = db.getUserByUsername(username);
    if (!user || !(await comparePassword(password, user.password))) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    const token = signToken(user.id, jwtSecret);
    reply.setCookie('token', token, cookieOpts);
    return { id: user.id, username: user.username };
  });

  app.post('/api/auth/logout', (req, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'Unauthorized' });
    return { id: req.user.id, username: req.user.username };
  });

  // --- DATA API ---

  app.get('/api/sets', (req) => {
    return db.listSets(req.user.id);
  });

  app.post('/api/sets', (req) => {
    const { title, cards, lang, translationLang } = req.body || {};
    if (!title || !title.trim()) {
      return { error: 'Title required' };
    }
    const setId = db.createSet(req.user.id, title.trim(), cards || [], lang || 'en', translationLang || 'uk');
    return db.getSet(setId, req.user.id);
  });

  app.get('/api/sets/:id', (req, reply) => {
    const set = db.getSet(Number(req.params.id), req.user.id);
    if (!set) return reply.code(404).send({ error: 'Not found' });
    return set;
  });

  app.delete('/api/sets/:id', (req) => {
    db.deleteSet(Number(req.params.id), req.user.id);
    return { ok: true };
  });

  app.post('/api/sets/:id/cards', (req, reply) => {
    const { word, translations } = req.body || {};
    if (!word || !translations || !translations.length) {
      return reply.code(400).send({ error: 'Word and translations required' });
    }
    const cardId = db.addCard(Number(req.params.id), req.user.id, word.trim(), translations);
    if (!cardId) return reply.code(404).send({ error: 'Set not found' });
    return { id: cardId, word: word.trim(), translations };
  });

  app.delete('/api/cards/:id', (req) => {
    db.deleteCard(Number(req.params.id), req.user.id);
    return { ok: true };
  });

  app.post('/api/sets/:id/share', (req, reply) => {
    const code = db.generateShareCode(Number(req.params.id), req.user.id);
    if (!code) return reply.code(404).send({ error: 'Not found' });
    return { code };
  });

  app.post('/api/share/:code', (req, reply) => {
    const newSetId = db.importByShareCode(req.params.code, req.user.id);
    if (!newSetId) return reply.code(404).send({ error: 'Invalid share code' });
    return db.getSet(newSetId, req.user.id);
  });

  app.post('/api/progress', (req) => {
    const { cardId, status } = req.body || {};
    db.updateProgress(req.user.id, cardId, status);
    return { ok: true };
  });

  // --- TTS ---

  const TTS_LANG_MAP = {
    en: 'en-US', uk: 'uk-UA', ru: 'ru-RU', tr: 'tr-TR',
    de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT',
    pt: 'pt-PT', pl: 'pl-PL', ja: 'ja-JP', ko: 'ko-KR',
    zh: 'zh-CN', ar: 'ar-SA', nl: 'nl-NL', sv: 'sv-SE',
    cs: 'cs-CZ', ro: 'ro-RO', hu: 'hu-HU',
  };

  app.get('/api/tts', async (req, reply) => {
    const { text, lang } = req.query || {};
    if (!text || !lang) return reply.code(400).send({ error: 'text and lang required' });
    const apiKey = process.env.GOOGLE_TTS_KEY;
    if (!apiKey) return reply.code(503).send({ error: 'TTS not configured' });

    const languageCode = TTS_LANG_MAP[lang] || lang;

    const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9 },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return reply.code(res.status).send({ error: err });
    }

    const data = await res.json();
    const audio = Buffer.from(data.audioContent, 'base64');
    reply.header('Content-Type', 'audio/mpeg');
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.send(audio);
  });

  // --- SPA FALLBACK ---

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    reply.header('Cache-Control', 'no-cache');
    return reply.sendFile('index.html');
  });

  return app;
}
