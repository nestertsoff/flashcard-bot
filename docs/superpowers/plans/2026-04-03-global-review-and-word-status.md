# Global Review & Word Status Indicators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global review mode that picks the most error-prone and stale words across all sets, plus visual status indicators in word lists.

**Architecture:** New DB query scores words by `mistakes * 2 + days_since_last_seen`. Three new pages (ReviewPage, ReviewFlashcardPage, ReviewTestPage) reuse existing flashcard/test patterns but fetch from a cross-set API endpoint with per-card language info. Word lists get colored left borders and humanized timeago dates.

**Tech Stack:** React, Fastify, SQLite (better-sqlite3), Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `client/src/timeago.js` | Create | Humanized date formatting for 4 languages |
| `client/src/pages/ReviewPage.jsx` | Create | Start screen: word count selector, direction toggle, Cards/Test buttons |
| `client/src/pages/ReviewFlashcardPage.jsx` | Create | Flashcard mode using review API with per-card language |
| `client/src/pages/ReviewTestPage.jsx` | Create | Test mode using review API with per-card language |
| `src/db.js` | Modify | Add `getReviewCards(userId, limit)` and `getReviewCount(userId)` |
| `src/server.js` | Modify | Add `GET /api/review` endpoint |
| `client/src/api.js` | Modify | Add `getReview(limit)` and `getReviewCount()` |
| `client/src/main.jsx` | Modify | Add 3 new routes |
| `client/src/i18n.js` | Modify | Add review + timeago translations |
| `client/src/index.css` | Modify | Add word-item status border styles |
| `client/src/pages/SetsPage.jsx` | Modify | Add review banner card |
| `client/src/pages/SetDetailPage.jsx` | Modify | Add status borders + timeago to word items |
| `tests/db.test.js` | Modify | Add tests for getReviewCards |
| `tests/server.test.js` | Modify | Add tests for GET /api/review |

---

### Task 1: timeago utility

**Files:**
- Create: `client/src/timeago.js`

- [ ] **Step 1: Create timeago.js**

```javascript
const LABELS = {
  en: { justNow: 'just now', m: '{n}m ago', h: '{n}h ago', d: '{n}d ago', w: '{n}w ago', mo: '{n}mo ago' },
  uk: { justNow: 'щойно', m: '{n}хв тому', h: '{n}год тому', d: '{n}д тому', w: '{n}тиж тому', mo: '{n}міс тому' },
  ru: { justNow: 'только что', m: '{n}м назад', h: '{n}ч назад', d: '{n}д назад', w: '{n}н назад', mo: '{n}мес назад' },
  tr: { justNow: 'az önce', m: '{n}dk önce', h: '{n}sa önce', d: '{n}g önce', w: '{n}hf önce', mo: '{n}ay önce' },
};

export function timeAgo(dateString, lang = 'en') {
  if (!dateString) return '';
  const labels = LABELS[lang] || LABELS.en;
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return labels.justNow;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return labels.m.replace('{n}', minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return labels.h.replace('{n}', hours);
  const days = Math.floor(hours / 24);
  if (days < 7) return labels.d.replace('{n}', days);
  const weeks = Math.floor(days / 7);
  if (days < 30) return labels.w.replace('{n}', weeks);
  const months = Math.floor(days / 30);
  return labels.mo.replace('{n}', months);
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/timeago.js
git commit -m "feat: add timeago utility with 4-language support"
```

---

### Task 2: Backend — getReviewCards + API endpoint

**Files:**
- Modify: `src/db.js` — add `getReviewCards` and `getReviewCount` after `resetProgress` function (around line 170)
- Modify: `src/server.js` — add `GET /api/review` endpoint before the TTS section (around line 145)
- Modify: `src/auth.js` — add `/api/review` to skipAuth... Actually no — review requires auth. Leave auth as-is.

- [ ] **Step 1: Add getReviewCards and getReviewCount to db.js**

In `src/db.js`, add these two functions after the `resetProgress` function (after line 168) and before `updateProgress`:

```javascript
  function getReviewCards(userId, limit = 30) {
    return sqlite.prepare(`
      SELECT c.id, c.word, c.translations, s.lang, s.translation_lang,
             COALESCE(p.status, 'new') as status,
             COALESCE(p.mistakes, 0) as mistakes,
             p.last_seen
      FROM cards c
      JOIN sets s ON s.id = c.set_id
      LEFT JOIN progress p ON p.card_id = c.id AND p.user_id = ?
      WHERE s.user_id = ? AND COALESCE(p.status, 'new') != 'known'
      ORDER BY (COALESCE(p.mistakes, 0) * 2 + COALESCE(CAST((julianday('now') - julianday(p.last_seen)) AS INTEGER), 999)) DESC
      LIMIT ?
    `).all(userId, userId, limit).map(c => ({ ...c, translations: JSON.parse(c.translations) }));
  }

  function getReviewCount(userId) {
    const row = sqlite.prepare(`
      SELECT COUNT(*) as count
      FROM cards c
      JOIN sets s ON s.id = c.set_id
      LEFT JOIN progress p ON p.card_id = c.id AND p.user_id = ?
      WHERE s.user_id = ? AND COALESCE(p.status, 'new') != 'known'
    `).get(userId, userId);
    return row.count;
  }
```

Also add `getReviewCards` and `getReviewCount` to the return object (around line 181):

```javascript
  return {
    createUser, getUserByUsername, getUserById,
    createSet, listSets, getSet, updateSetTitle, deleteSet,
    addCard, deleteCard,
    generateShareCode, importByShareCode,
    resetProgress, getReviewCards, getReviewCount, updateProgress, close,
  };
```

- [ ] **Step 2: Add GET /api/review endpoint to server.js**

In `src/server.js`, add this before the `// --- TTS ---` section (around line 145):

```javascript
  // --- REVIEW ---

  app.get('/api/review', (req) => {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    return { cards: db.getReviewCards(req.user.id, limit) };
  });

  app.get('/api/review/count', (req) => {
    return { count: db.getReviewCount(req.user.id) };
  });
```

- [ ] **Step 3: Run existing tests to verify nothing is broken**

Run: `npm test`
Expected: All 21 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/db.js src/server.js
git commit -m "feat: add review API with scoring algorithm"
```

---

### Task 3: Backend tests for review

**Files:**
- Modify: `tests/db.test.js` — add review test suite
- Modify: `tests/server.test.js` — add review endpoint test

- [ ] **Step 1: Add review tests to tests/db.test.js**

Add this test suite at the end of the file, before the closing of the outer `describe`:

```javascript
  describe('review', () => {
    it('returns cards sorted by score (mistakes * 2 + staleness)', () => {
      const userId = db.createUser('reviewer', 'hash');
      const setId = db.createSet(userId, 'Review Set', [
        { word: 'a', translations: ['1'] },
        { word: 'b', translations: ['2'] },
        { word: 'c', translations: ['3'] },
      ]);
      const set = db.getSet(setId, userId);
      // Mark 'a' as known — should be excluded
      db.updateProgress(userId, set.cards[0].id, 'known');
      // Mark 'b' as learning with mistakes
      db.updateProgress(userId, set.cards[1].id, 'learning');
      db.updateProgress(userId, set.cards[1].id, 'learning');
      // 'c' stays new — no progress

      const review = db.getReviewCards(userId, 10);
      expect(review.length).toBe(2); // 'a' excluded (known)
      expect(review.map(r => r.word)).toContain('b');
      expect(review.map(r => r.word)).toContain('c');
      // Each card has lang info
      expect(review[0].lang).toBe('en');
      expect(review[0].translation_lang).toBe('uk');
    });

    it('respects limit parameter', () => {
      const userId = db.createUser('limiter', 'hash');
      db.createSet(userId, 'Big Set', [
        { word: 'w1', translations: ['t1'] },
        { word: 'w2', translations: ['t2'] },
        { word: 'w3', translations: ['t3'] },
      ]);
      const review = db.getReviewCards(userId, 2);
      expect(review.length).toBe(2);
    });

    it('returns count of reviewable cards', () => {
      const userId = db.createUser('counter', 'hash');
      const setId = db.createSet(userId, 'Count Set', [
        { word: 'x', translations: ['y'] },
        { word: 'z', translations: ['w'] },
      ]);
      expect(db.getReviewCount(userId)).toBe(2);
      const set = db.getSet(setId, userId);
      db.updateProgress(userId, set.cards[0].id, 'known');
      expect(db.getReviewCount(userId)).toBe(1);
    });
  });
```

- [ ] **Step 2: Add review endpoint test to tests/server.test.js**

Add this inside the existing `describe('sets API')` block, after the share/import test:

```javascript
    it('returns review cards', async () => {
      const cookie = await registerAndGetCookie('reviewuser', 'password123');
      // Create a set with cards
      await app.inject({ method: 'POST', url: '/api/sets', headers: { cookie }, payload: { title: 'Review', cards: [{ word: 'hello', translations: ['привет'] }] } });
      const res = await app.inject({ method: 'GET', url: '/api/review?limit=10', headers: { cookie } });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.cards).toHaveLength(1);
      expect(body.cards[0].word).toBe('hello');
      expect(body.cards[0].lang).toBe('en');
    });
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All tests pass (21 existing + 4 new = 25).

- [ ] **Step 4: Commit**

```bash
git add tests/db.test.js tests/server.test.js
git commit -m "test: add review API and scoring tests"
```

---

### Task 4: Client API + i18n + CSS

**Files:**
- Modify: `client/src/api.js` — add getReview and getReviewCount
- Modify: `client/src/i18n.js` — add review translations
- Modify: `client/src/index.css` — add word-item status styles

- [ ] **Step 1: Add review methods to api.js**

In `client/src/api.js`, add after the `resetProgress` line:

```javascript
  getReview: (limit) => request('GET', `/api/review?limit=${limit || 30}`),
  getReviewCount: () => request('GET', '/api/review/count'),
```

- [ ] **Step 2: Add i18n translations**

In `client/src/i18n.js`, add these keys to each language object:

**English (after `start: 'Start',`):**
```javascript
    review: 'Review',
    wordsToReview: 'words to review',
    reviewEmpty: 'All caught up! No words to review.',
    wordsCount: 'Words',
    new_word: 'new',
```

**Ukrainian (after `start: 'Почати',`):**
```javascript
    review: 'Повторення',
    wordsToReview: 'слів на повторення',
    reviewEmpty: 'Все повторено! Немає слів для повторення.',
    wordsCount: 'Слів',
    new_word: 'нове',
```

**Russian (after `start: 'Начать',`):**
```javascript
    review: 'Повторение',
    wordsToReview: 'слов на повторение',
    reviewEmpty: 'Всё повторено! Нет слов для повторения.',
    wordsCount: 'Слов',
    new_word: 'новое',
```

**Turkish (after `start: 'Başla',`):**
```javascript
    review: 'Tekrar',
    wordsToReview: 'tekrar edilecek kelime',
    reviewEmpty: 'Hepsi tamam! Tekrar edilecek kelime yok.',
    wordsCount: 'Kelime',
    new_word: 'yeni',
```

- [ ] **Step 3: Add word-item status styles to index.css**

In `client/src/index.css`, add after the existing `.word-item .delete-btn:hover` rule (around line 278):

```css
.word-item.status-known { border-left: 4px solid var(--success); }
.word-item.status-learning { border-left: 4px solid var(--warning); }
.word-item.status-new { border-left: 4px solid var(--border); }
.word-item .word-meta { font-size: 11px; color: var(--text-secondary); white-space: nowrap; margin-left: 8px; }
.word-item .word-meta .mistakes { color: var(--warning); font-weight: 700; }
```

- [ ] **Step 4: Build client to verify**

Run: `cd client && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add client/src/api.js client/src/i18n.js client/src/index.css
git commit -m "feat: add review API client, i18n translations, status styles"
```

---

### Task 5: Word status indicators in SetDetailPage

**Files:**
- Modify: `client/src/pages/SetDetailPage.jsx` — update Words tab to show status borders + timeago

- [ ] **Step 1: Add timeago import**

At the top of `client/src/pages/SetDetailPage.jsx`, add:

```javascript
import { timeAgo } from '../timeago';
```

Also need the current language code. The `useLang` hook is already imported. Check how it's used — `const { t } = useLang();`. We need the language code too. Read `LangContext.jsx` to see what's exported.

The `useLang` context provides `{ lang, setLang, t }`. So update the destructuring:

```javascript
const { t, lang: uiLang } = useLang();
```

- [ ] **Step 2: Update the word list rendering in the Words tab**

Replace the word list section (the `{set.cards.map(c => ...)}` block around lines 270-281) with:

```jsx
{set.cards.map(c => (
  <div key={c.id} className={`word-item status-${c.status || 'new'}`}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
      <SpeakButton text={c.word} lang={set.lang} size={16} />
      <span className="word">{c.word}</span>
      <span style={{ color: 'var(--text-secondary)', margin: '0 4px' }}>—</span>
      <SpeakButton text={c.translations.join(', ')} lang={set.translation_lang} size={16} />
      <span className="translation">{c.translations.join(', ')}</span>
    </div>
    <div className="word-meta">
      {c.status === 'learning' && <span className="mistakes">{c.mistakes}✗ · </span>}
      {c.last_seen ? timeAgo(c.last_seen, uiLang) : t.new_word || t.new_}
    </div>
    <button className="delete-btn" onClick={() => handleDeleteCard(c.id)} aria-label={t.delete}>×</button>
  </div>
))}
```

- [ ] **Step 3: Build and verify**

Run: `cd client && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/SetDetailPage.jsx
git commit -m "feat: add word status indicators with timeago in words tab"
```

---

### Task 6: ReviewPage (start screen)

**Files:**
- Create: `client/src/pages/ReviewPage.jsx`

- [ ] **Step 1: Create ReviewPage.jsx**

```jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { api } from '../api';

const LIMIT_OPTIONS = [10, 20, 30, 50];

function getReviewLimit() {
  return Number(localStorage.getItem('reviewLimit')) || 30;
}

function setReviewLimit(val) {
  localStorage.setItem('reviewLimit', String(val));
}

export default function ReviewPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [cards, setCards] = useState(null);
  const [limit, setLimit] = useState(getReviewLimit);
  const [direction, setDirection] = useState('word');

  useEffect(() => {
    api.getReview(limit).then(data => setCards(data.cards)).catch(() => navigate('/'));
  }, [limit]);

  if (cards === null) return <div className="loader-wrap"><div className="loader"></div></div>;

  if (cards.length === 0) {
    return (
      <div className="container">
        <div className="header">
          <button className="btn btn-secondary btn-icon" onClick={() => navigate('/')} aria-label={t.back} title={t.back}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 style={{ fontSize: 20, margin: 0 }}>{t.review}</h1>
          <div style={{ width: 44 }} />
        </div>
        <div className="empty-state">
          <img src="/stickers/4.webp" alt="" />
          <p>{t.reviewEmpty}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <button className="btn btn-secondary btn-icon" onClick={() => navigate('/')} aria-label={t.back} title={t.back}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 style={{ fontSize: 20, margin: 0 }}>{t.review}</h1>
        <div style={{ width: 44 }} />
      </div>

      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 16 }}>
        {cards.length} {t.wordsToReview}
      </p>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
        {LIMIT_OPTIONS.map(n => (
          <button key={n} className={`btn btn-sm ${limit === n ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setLimit(n); setReviewLimit(n); }}>
            {n}
          </button>
        ))}
      </div>

      <div className="direction-toggle">
        <button className="btn btn-secondary btn-sm btn-block"
          onClick={() => setDirection(d => d === 'word' ? 'translation' : 'word')}>
          {direction === 'word' ? t.wordToTranslation : t.translationToWord}
        </button>
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => navigate(`/review/flashcard?dir=${direction}&limit=${limit}`)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          {t.flashcards}
        </button>
        <button className="btn btn-primary" onClick={() => navigate(`/review/test?dir=${direction}&limit=${limit}`)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          {t.test}
        </button>
      </div>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <img src="/stickers/7.webp" alt="" style={{ width: 100, opacity: 0.7 }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `cd client && npm run build`
Expected: Build succeeds (page not routed yet, but compiles).

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/ReviewPage.jsx
git commit -m "feat: add ReviewPage with limit selector and direction toggle"
```

---

### Task 7: ReviewFlashcardPage

**Files:**
- Create: `client/src/pages/ReviewFlashcardPage.jsx`

- [ ] **Step 1: Create ReviewFlashcardPage.jsx**

Based on FlashcardPage but fetches from review API and uses per-card language:

```jsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { api } from '../api';
import { getCorrectSticker, getWrongSticker, getResultSticker, getResultMessage } from '../stickers';
import { speak, getAutoplay } from '../tts';
import SpeakButton from '../components/SpeakButton';

export default function ReviewFlashcardPage() {
  const [searchParams] = useSearchParams();
  const direction = searchParams.get('dir') || 'word';
  const limit = Number(searchParams.get('limit')) || 30;
  const navigate = useNavigate();
  const { t } = useLang();
  const [cards, setCards] = useState([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);
  const [sticker, setSticker] = useState(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    api.getReview(limit).then(data => setCards(data.cards)).catch(() => navigate('/'));
  }, []);

  useEffect(() => {
    if (started && cards.length > 0 && !done && !sticker && getAutoplay()) {
      const card = cards[index];
      const frontText = direction === 'word' ? card.word : card.translations.join(', ');
      const frontL = direction === 'word' ? card.lang : card.translation_lang;
      speak(frontText, frontL);
    }
  }, [index, cards, done, sticker, started]);

  if (cards.length === 0) return <div className="loader-wrap"><div className="loader"></div></div>;

  if (!started) {
    return (
      <div className="container">
        <div className="header">
          <button className="btn btn-secondary btn-icon" onClick={() => navigate('/review')} aria-label={t.back} title={t.back}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        </div>
        <div className="counter">{cards.length} {t.cards}</div>
        <div className="flashcard-container" onClick={() => setStarted(true)} style={{ cursor: 'pointer' }}>
          <div className="flashcard-inner">
            <div className="flashcard-front" style={{ fontSize: 36 }}>{t.start}</div>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    const correct = results.filter(r => r.correct).length;
    return (
      <div className="container">
        <h1 style={{ textAlign: 'center', marginBottom: 8 }}>{t.results}</h1>
        <div className="sticker-reaction large"><img src={getResultSticker(correct, results.length)} alt="" /></div>
        <p style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, color: 'var(--primary-dark)' }}>{getResultMessage(correct, results.length, t)}</p>
        <div className="results-score">{correct} / {results.length}</div>
        {results.map((r, i) => (
          <div key={i} className={`result-item ${r.correct ? 'right' : 'wrong'}`}>
            <span>{r.card.word}</span>
            <span>{r.card.translations.join(', ')}</span>
          </div>
        ))}
        <div className="btn-row" style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={() => { setIndex(0); setResults([]); setDone(false); setFlipped(false); setSticker(null); setStarted(false); }}>{t.tryAgain}</button>
          <button className="btn btn-secondary" onClick={() => navigate('/review')}>{t.back}</button>
        </div>
      </div>
    );
  }

  const card = cards[index];
  const front = direction === 'word' ? card.word : card.translations.join(', ');
  const back = direction === 'word' ? card.translations.join(', ') : card.word;
  const frontLang = direction === 'word' ? card.lang : card.translation_lang;
  const backLang = direction === 'word' ? card.translation_lang : card.lang;

  async function answer(correct) {
    await api.updateProgress(card.id, correct ? 'known' : 'learning');
    setSticker(correct ? getCorrectSticker() : getWrongSticker());
    const newResults = [...results, { card, correct }];
    setResults(newResults);
    setTimeout(() => {
      if (index + 1 >= cards.length) {
        setDone(true);
      } else {
        setIndex(index + 1);
        setFlipped(false);
        setSticker(null);
      }
    }, 800);
  }

  return (
    <div className="container">
      <div className="header">
        <button className="btn btn-secondary btn-icon" onClick={() => navigate('/review')} aria-label={t.back} title={t.back}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      </div>
      <div className="counter">{index + 1} / {cards.length}</div>
      {sticker && (<div className="sticker-reaction"><img src={sticker} alt="" /></div>)}
      {!sticker && (
        <>
          <div className={`flashcard-container ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)}>
            <div className="flashcard-inner">
              <div className="flashcard-front">
                <SpeakButton text={front} lang={frontLang} />
                <span style={{ margin: '0 8px' }}>{front}</span>
              </div>
              <div className="flashcard-back">
                <SpeakButton text={back} lang={backLang} />
                <span style={{ margin: '0 8px' }}>{back}</span>
              </div>
            </div>
          </div>
          {flipped && (
            <div className="btn-row">
              <button className="btn btn-danger" onClick={() => answer(false)}>{t.dontKnow}</button>
              <button className="btn btn-success" onClick={() => answer(true)}>{t.know}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/ReviewFlashcardPage.jsx
git commit -m "feat: add ReviewFlashcardPage with per-card language"
```

---

### Task 8: ReviewTestPage

**Files:**
- Create: `client/src/pages/ReviewTestPage.jsx`

- [ ] **Step 1: Create ReviewTestPage.jsx**

```jsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { api } from '../api';
import { getCorrectSticker, getWrongSticker, getResultSticker, getResultMessage } from '../stickers';
import { speak, getAutoplay } from '../tts';
import SpeakButton from '../components/SpeakButton';

export default function ReviewTestPage() {
  const [searchParams] = useSearchParams();
  const direction = searchParams.get('dir') || 'word';
  const limit = Number(searchParams.get('limit')) || 30;
  const navigate = useNavigate();
  const { t } = useLang();
  const [allCards, setAllCards] = useState([]);
  const [cards, setCards] = useState([]);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);
  const [options, setOptions] = useState([]);
  const [sticker, setSticker] = useState(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    api.getReview(limit).then(data => {
      setAllCards(data.cards);
      setCards(data.cards);
    }).catch(() => navigate('/'));
  }, []);

  useEffect(() => {
    if (cards.length === 0 || index >= cards.length) return;
    const card = cards[index];
    const correctAnswer = direction === 'word' ? card.translations.join(', ') : card.word;
    const allAnswers = allCards.map(c => direction === 'word' ? c.translations.join(', ') : c.word);
    const wrongAnswers = allAnswers.filter(a => a !== correctAnswer).sort(() => Math.random() - 0.5).slice(0, 3);
    setOptions([correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5));
  }, [cards, index, allCards, direction]);

  useEffect(() => {
    if (started && cards.length > 0 && !done && !answered && getAutoplay()) {
      const card = cards[index];
      const q = direction === 'word' ? card.word : card.translations.join(', ');
      const qLang = direction === 'word' ? card.lang : card.translation_lang;
      speak(q, qLang);
    }
  }, [index, cards, done, answered, started]);

  if (cards.length === 0) return <div className="loader-wrap"><div className="loader"></div></div>;

  if (!started) {
    return (
      <div className="container">
        <div className="header">
          <button className="btn btn-secondary btn-icon" onClick={() => navigate('/review')} aria-label={t.back} title={t.back}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        </div>
        <div className="counter">{cards.length} {t.cards}</div>
        <div className="flashcard-container" onClick={() => setStarted(true)} style={{ cursor: 'pointer' }}>
          <div className="flashcard-inner">
            <div className="flashcard-front" style={{ fontSize: 36 }}>{t.start}</div>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    const correct = results.filter(r => r.correct).length;
    return (
      <div className="container">
        <h1 style={{ textAlign: 'center', marginBottom: 8 }}>{t.results}</h1>
        <div className="sticker-reaction large"><img src={getResultSticker(correct, results.length)} alt="" /></div>
        <p style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, color: 'var(--primary-dark)' }}>{getResultMessage(correct, results.length, t)}</p>
        <div className="results-score">{correct} / {results.length}</div>
        {results.map((r, i) => (
          <div key={i} className={`result-item ${r.correct ? 'right' : 'wrong'}`}>
            <span>{r.card.word}</span>
            <span>{r.card.translations.join(', ')}</span>
          </div>
        ))}
        <div className="btn-row" style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={() => { setIndex(0); setResults([]); setDone(false); setAnswered(false); setSelected(null); setSticker(null); setStarted(false); }}>{t.tryAgain}</button>
          <button className="btn btn-secondary" onClick={() => navigate('/review')}>{t.back}</button>
        </div>
      </div>
    );
  }

  const card = cards[index];
  const question = direction === 'word' ? card.word : card.translations.join(', ');
  const correctAnswer = direction === 'word' ? card.translations.join(', ') : card.word;
  const questionLang = direction === 'word' ? card.lang : card.translation_lang;

  async function handleAnswer(opt) {
    if (answered) return;
    setAnswered(true);
    setSelected(opt);
    const isCorrect = opt === correctAnswer;
    setSticker(isCorrect ? getCorrectSticker() : getWrongSticker());
    await api.updateProgress(card.id, isCorrect ? 'known' : 'learning');
    setResults([...results, { card, correct: isCorrect }]);
  }

  function next() {
    setSticker(null);
    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex(index + 1);
      setAnswered(false);
      setSelected(null);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <button className="btn btn-secondary btn-icon" onClick={() => navigate('/review')} aria-label={t.back} title={t.back}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      </div>
      <div className="counter">{index + 1} / {cards.length}</div>
      <div style={{ textAlign: 'center', fontSize: 28, fontWeight: 700, padding: 24, background: 'var(--surface)', borderRadius: 'var(--radius)', marginBottom: 20, boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <SpeakButton text={question} lang={questionLang} />
        {question}
      </div>
      {sticker && (<div className="sticker-reaction"><img src={sticker} alt="" /></div>)}
      {options.map((opt, i) => (
        <div key={i}
          className={`test-option ${answered ? 'disabled' : ''} ${answered && opt === correctAnswer ? 'correct' : ''} ${answered && opt === selected && opt !== correctAnswer ? 'wrong' : ''}`}
          onClick={() => handleAnswer(opt)}>
          {opt}
        </div>
      ))}
      {answered && (
        <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={next}>{t.next}</button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/ReviewTestPage.jsx
git commit -m "feat: add ReviewTestPage with per-card language"
```

---

### Task 9: Routes + SetsPage banner

**Files:**
- Modify: `client/src/main.jsx` — add 3 routes + imports
- Modify: `client/src/pages/SetsPage.jsx` — add review banner

- [ ] **Step 1: Add routes to main.jsx**

Add imports at the top of `client/src/main.jsx` (after the existing page imports):

```javascript
import ReviewPage from './pages/ReviewPage';
import ReviewFlashcardPage from './pages/ReviewFlashcardPage';
import ReviewTestPage from './pages/ReviewTestPage';
```

Add routes inside `<Routes>`, after the `/share/:code` route and before the `*` catch-all:

```jsx
<Route path="/review" element={<ProtectedRoute><ReviewPage /></ProtectedRoute>} />
<Route path="/review/flashcard" element={<ProtectedRoute><ReviewFlashcardPage /></ProtectedRoute>} />
<Route path="/review/test" element={<ProtectedRoute><ReviewTestPage /></ProtectedRoute>} />
```

- [ ] **Step 2: Add review banner to SetsPage.jsx**

Add import at the top of `client/src/pages/SetsPage.jsx`:

```javascript
import { api } from '../api';
```

Wait — `api` is already imported in SetsPage. Check. Yes, it's imported on line 3. Good.

Add state for review count. In the state declarations (around line 10), add:

```javascript
const [reviewCount, setReviewCount] = useState(0);
```

In the existing `useEffect` that calls `loadSets()`, also fetch review count. Find `loadSets` function and add after `setSets`:

Update `loadSets` to also fetch review count:

```javascript
async function loadSets() {
  const data = await api.getSets();
  setSets(data);
  try {
    const r = await api.getReviewCount();
    setReviewCount(r.count);
  } catch {}
}
```

Add the banner card between the button row and the set list. Find the set list section (the `{sets.length === 0 ? ...}` block). Insert before it:

```jsx
{reviewCount > 0 && (
  <div className="card" onClick={() => navigate('/review')} style={{
    background: 'linear-gradient(145deg, var(--accent-light), var(--accent))',
    marginBottom: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }}>
    <div>
      <div style={{ fontWeight: 800, fontSize: 16 }}>🔄 {t.review}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{reviewCount} {t.wordsToReview}</div>
    </div>
    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>{reviewCount}</div>
  </div>
)}
```

Also add `useNavigate` import if not already present. Check — SetsPage uses `navigate` already so it's imported.

- [ ] **Step 3: Build and run tests**

Run: `npm test && cd client && npm run build`
Expected: All tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add client/src/main.jsx client/src/pages/SetsPage.jsx
git commit -m "feat: add review routes and banner on sets page"
```

---

### Task 10: Final integration test + deploy

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass (25+).

- [ ] **Step 2: Build client**

Run: `cd client && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Push and deploy**

```bash
git push origin master
```

Expected: CI picks up, builds Docker image, deploys to VM.
