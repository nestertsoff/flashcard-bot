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
