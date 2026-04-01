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
