import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 10;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(userId, secret) {
  return jwt.sign({ userId }, secret, { expiresIn: '30d' });
}

export function verifyToken(token, secret) {
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

export function authMiddleware(secret, db) {
  return (req, reply, done) => {
    const skipAuth = ['/api/auth/register', '/api/auth/login', '/api/auth/logout'];
    if (skipAuth.some(p => req.url === p)) return done();
    if (!req.url.startsWith('/api/')) return done();

    const token = req.cookies?.token;
    if (!token) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    const payload = verifyToken(token, secret);
    if (!payload) {
      reply.code(401).send({ error: 'Invalid token' });
      return;
    }

    const user = db.getUserById(payload.userId);
    if (!user) {
      reply.code(401).send({ error: 'User not found' });
      return;
    }

    req.user = user;
    done();
  };
}
