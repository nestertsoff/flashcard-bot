import { describe, it, expect } from 'vitest';
import { parseCardSet } from '../src/bot.js';

describe('parseCardSet', () => {
  it('parses a valid set', () => {
    const text = 'German Animals\nHund - собака, пёс\nKatze - кошка';
    const result = parseCardSet(text);
    expect(result).toEqual({
      title: 'German Animals',
      cards: [
        { word: 'Hund', translations: ['собака', 'пёс'] },
        { word: 'Katze', translations: ['кошка'] },
      ],
    });
  });

  it('skips empty lines', () => {
    const text = 'Title\n\nword1 - t1\n\nword2 - t2\n';
    const result = parseCardSet(text);
    expect(result.cards).toHaveLength(2);
  });

  it('returns null for title only', () => {
    expect(parseCardSet('Just a title')).toBeNull();
  });

  it('returns null for invalid format', () => {
    expect(parseCardSet('Title\nno dash here\nalso bad')).toBeNull();
  });

  it('trims whitespace from words and translations', () => {
    const text = 'Test\n  Hund  -  собака ,  пёс  ';
    const result = parseCardSet(text);
    expect(result.cards[0].word).toBe('Hund');
    expect(result.cards[0].translations).toEqual(['собака', 'пёс']);
  });
});
