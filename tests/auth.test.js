import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword, signToken, verifyToken } from '../src/auth.js';

const SECRET = 'test_secret';

describe('password hashing', () => {
  it('hashes and compares correctly', async () => {
    const hash = await hashPassword('mypassword');
    expect(await comparePassword('mypassword', hash)).toBe(true);
    expect(await comparePassword('wrong', hash)).toBe(false);
  });
});

describe('JWT', () => {
  it('signs and verifies token', () => {
    const token = signToken(42, SECRET);
    const payload = verifyToken(token, SECRET);
    expect(payload.userId).toBe(42);
  });

  it('rejects invalid token', () => {
    expect(verifyToken('bad.token.here', SECRET)).toBeNull();
  });
});
