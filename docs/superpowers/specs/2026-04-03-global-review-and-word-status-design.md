# Global Review Mode & Word Status Indicators

## Overview

Two features for the flashcard learning app:
1. **Global Review** — study/test words from ALL sets, prioritized by error rate and staleness
2. **Word Status Indicators** — visual status (known/learning/new) + humanized last-seen date in all word lists

## Decisions

- **Scoring algorithm:** Mixed scoring — `mistakes * 2 + days_since_last_seen`. Only `learning` and `new` words (skip `known`).
- **Entry point:** Banner card on SetsPage between buttons and set list, showing count of words to review. Hidden when 0.
- **Word count selection:** On Review start screen (not global settings). Options: 10/20/30/50. Default 30, saved in localStorage.
- **Status indicators:** Colored left border on word items + date on right. Green=known, yellow=learning (+error count), gray=new.
- **Sharing:** Not affected — review queries filter by user_id through sets→cards→progress JOIN chain.

## Feature 1: Global Review

### API

`GET /api/review?limit=30` — returns top N words by priority score.

**Scoring SQL:**
```sql
SELECT c.id, c.word, c.translations, s.lang, s.translation_lang,
       COALESCE(p.status, 'new') as status,
       COALESCE(p.mistakes, 0) as mistakes,
       p.last_seen,
       (COALESCE(p.mistakes, 0) * 2 + COALESCE(CAST((julianday('now') - julianday(p.last_seen)) AS INTEGER), 999)) as score
FROM cards c
JOIN sets s ON s.id = c.set_id
LEFT JOIN progress p ON p.card_id = c.id AND p.user_id = ?
WHERE s.user_id = ? AND COALESCE(p.status, 'new') != 'known'
ORDER BY score DESC
LIMIT ?
```

**Response shape:**
```json
{
  "cards": [
    {
      "id": 42,
      "word": "kitap",
      "translations": ["книга"],
      "status": "learning",
      "mistakes": 3,
      "last_seen": "2026-03-28T10:00:00Z",
      "lang": "tr",
      "translation_lang": "uk"
    }
  ]
}
```

### UI: ReviewPage (`/review`)

Start screen with:
- Word count selector: buttons 10 / 20 / 30 / 50 (default from localStorage, fallback 30)
- Direction toggle: word→translation / translation→word
- Two action buttons: Cards / Test
- Start card (like FlashcardPage/TestPage) to enable mobile autoplay

Navigates to `/review/flashcard?dir=word&limit=30` or `/review/test?dir=word&limit=30`.

### UI: ReviewFlashcardPage (`/review/flashcard`)

Based on FlashcardPage but:
- Fetches data from `api.getReview(limit)` instead of `api.getSet(id)`
- Each card carries its own `lang` and `translation_lang` (words from different sets)
- Back button navigates to `/review` instead of `/sets/:id`
- Start card shown before first word

### UI: ReviewTestPage (`/review/test`)

Based on TestPage but:
- Same data source difference as ReviewFlashcardPage
- Per-card language for TTS
- Back navigates to `/review`

### SetsPage Banner

Shown between New/Import buttons and set list:
```
┌──────────────────────────────────┐
│ 🔄 Review          12 words     │
│    X words need practice    →   │
└──────────────────────────────────┘
```
- Fetches count from `GET /api/review?limit=1` or a dedicated count endpoint
- Hidden when no words need review
- Click navigates to `/review`

## Feature 2: Word Status Indicators

### SetDetailPage — Words Tab

Each word-item gets:
- **Left border:** 4px colored — `--success` (known), `--warning` (learning), `--border` (new)
- **Right side:** humanized last_seen date, or error count for learning words (e.g. "2 ✗"), or "new"

### timeAgo function

Client-side `timeAgo(dateString, langCode)` — no dependencies, ~30 lines.

**Thresholds:**
- < 1 min: "just now"
- < 60 min: "Xm ago"
- < 24h: "Xh ago"  
- < 7d: "Xd ago"
- < 30d: "Xw ago"
- ≥ 30d: "Xmo ago"

**Localized labels (4 languages):**

| Key | EN | UK | RU | TR |
|-----|----|----|----|----|
| justNow | just now | щойно | только что | az önce |
| mAgo | {n}m ago | {n}хв тому | {n}м назад | {n}dk önce |
| hAgo | {n}h ago | {n}год тому | {n}ч назад | {n}sa önce |
| dAgo | {n}d ago | {n}д тому | {n}д назад | {n}g önce |
| wAgo | {n}w ago | {n}тиж тому | {n}н назад | {n}hf önce |
| moAgo | {n}mo ago | {n}міс тому | {n}мес назад | {n}ay önce |

## File Changes

### Backend
- `src/db.js` — add `getReviewCards(userId, limit)` function
- `src/server.js` — add `GET /api/review?limit=30` endpoint

### Client — New Files
- `client/src/pages/ReviewPage.jsx` — start screen with count/direction selection
- `client/src/pages/ReviewFlashcardPage.jsx` — flashcards with per-card language
- `client/src/pages/ReviewTestPage.jsx` — test with per-card language
- `client/src/timeago.js` — humanized date function for 4 languages

### Client — Modified Files
- `client/src/api.js` — add `getReview(limit)`
- `client/src/main.jsx` — add routes `/review`, `/review/flashcard`, `/review/test`
- `client/src/pages/SetsPage.jsx` — add review banner card
- `client/src/pages/SetDetailPage.jsx` — add status borders + timeago to word items
- `client/src/i18n.js` — translations for review UI + timeago labels
- `client/src/index.css` — `.word-item.known`, `.word-item.learning`, `.word-item.new` border styles

### Not Modified
- Existing FlashcardPage, TestPage — untouched
- Share/import flow — untouched
- Progress tracking — untouched
