# PWA with Offline Support

## Overview

Convert the flashcard web app (elvishka.com) into an installable PWA with offline flashcard/test usage, cached TTS audio, and transparent progress synchronization.

## Decisions

- **Offline scope:** Read-only — browse sets, study flashcards, take tests offline. Creating/deleting sets and words requires online.
- **TTS caching:** Prefetch all audio for a set when user opens the set page. Cache-first strategy — once cached, always served from cache.
- **Progress sync:** Optimistic — offline progress updates cached API responses immediately. Background Sync sends to server when online. Fallback queue flush on next successful fetch for browsers without Background Sync.
- **UI indicators:** Audio prefetch status shown on set cards (SetsPage) and set header (SetDetailPage): spinner → checkmark → hide.

## Feature 1: PWA Manifest & Installation

### manifest.json (`client/public/manifest.json`)

```json
{
  "name": "Elvishka — Flashcards",
  "short_name": "Elvishka",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#FFB4A2",
  "background_color": "#FFFAF7",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### index.html additions

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#FFB4A2">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
```

### SW registration in main.jsx

```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

### Icon generation

Generate 192x192 and 512x512 PNG icons from existing `client/public/embarrassed.png`. Place in `client/public/icons/`.

## Feature 2: Service Worker Caching

### File: `client/public/sw.js`

Three caching strategies by resource type:

**1. App Shell — cache-first (install-time)**

Cached on SW install: JS/CSS bundles, fonts, stickers, icons, manifest. Updated on SW version bump.

```
Cache name: 'app-shell-v{VERSION}'
Pattern: *.js, *.css, /stickers/*, /icons/*, /manifest.json, /embarrassed.png
Strategy: Cache on install, serve from cache, update on new SW version
```

**2. API data — network-first, fallback to cache**

```
Cache name: 'api-data'
Pattern: GET /api/sets, GET /api/sets/:id, GET /api/review, GET /api/review/count
Strategy: Try network first, write response to cache. On network failure, serve from cache.
```

Skip caching for: POST/DELETE/PATCH requests, `/api/auth/*` endpoints.

**3. TTS audio — cache-first**

```
Cache name: 'tts-audio'
Pattern: GET /api/tts?text=...&lang=...
Strategy: Check cache first. If hit, return cached. If miss, fetch from network, cache response, return.
```

TTS URLs are deterministic (same text+lang = same audio), so cache never invalidates.

### SW lifecycle

- `install`: Pre-cache app shell assets, call `skipWaiting()`
- `activate`: Clean old cache versions, call `clients.claim()`
- `fetch`: Route to appropriate strategy based on URL pattern

## Feature 3: Offline Progress Sync

### Problem

POST `/api/progress` (cardId, status) fails when offline. User expects buttons to work regardless.

### Solution

**1. SW intercept:** On failed POST to `/api/progress`, save request body to IndexedDB queue (`pending-progress` store).

**2. Optimistic cache update:** After queuing, SW updates cached GET responses:
- Find card in cached `/api/sets/:id` response → update `status`, `mistakes`, `last_seen`
- Update `known_count`/`learning_count` in cached `/api/sets` list response
- Update cached `/api/review` and `/api/review/count` responses

**3. Background Sync:** Register sync event `'sync-progress'`. On connectivity restore, replay all queued requests in order, then delete from queue.

**4. Fallback (no Background Sync support):** On every successful fetch intercepted by SW, check queue and flush pending progress requests.

**5. After sync:** Server responses to GET requests overwrite cache with authoritative data.

### IndexedDB schema

```
Database: 'elvishka-offline'
Store: 'pending-progress'
  key: auto-increment
  value: { cardId: number, status: string, timestamp: number }
```

## Feature 4: TTS Audio Prefetch

### Module: `client/src/prefetch.js`

```js
export async function prefetchSetAudio(set, onProgress)
```

- Iterates all cards in set
- For each card: generates 2 URLs (`/api/tts?text={word}&lang={set.lang}` and `/api/tts?text={translations}&lang={set.translation_lang}`)
- Fetches with concurrency limit of 4
- Calls `onProgress({ total, loaded })` after each fetch
- SW caches responses automatically (cache-first strategy)
- Skips URLs already in cache (checks `caches.match()` before fetching)

### Integration points

**SetDetailPage:** After `loadSet()` completes, call `prefetchSetAudio(set, onProgress)`. Show prefetch indicator in header next to title.

**SetsPage:** After `loadSets()` completes, prefetch audio for each set sequentially. Show prefetch indicator on each set card.

**ReviewPage:** After loading review cards, prefetch audio for all review cards.

### Prefetch indicator component

SVG-based, inline (not a separate component file — just JSX in the pages):
- **Loading:** Small animated spinner icon (12-14px)
- **Done:** Checkmark icon, fades out after 2 seconds
- **Error/offline:** Hidden (not critical)

### Indicator placement

- **SetsPage cards:** Right side, next to card count text
- **SetDetailPage header:** Next to the title (in the spacer div area)

## File Changes

### New Files
- `client/public/manifest.json` — PWA manifest
- `client/public/sw.js` — Service Worker with 3-strategy caching + offline progress sync
- `client/public/icons/icon-192.png` — PWA icon 192x192
- `client/public/icons/icon-512.png` — PWA icon 512x512
- `client/src/prefetch.js` — TTS audio prefetch with progress callback

### Modified Files
- `client/index.html` — manifest link, theme-color, apple-touch-icon meta tags
- `client/src/main.jsx` — SW registration
- `client/src/pages/SetDetailPage.jsx` — call prefetchSetAudio, show indicator in header
- `client/src/pages/SetsPage.jsx` — call prefetchSetAudio per set, show indicator on cards
- `client/src/pages/ReviewPage.jsx` — call prefetchSetAudio for review cards

### Not Modified
- Backend (src/*) — no changes needed
- tts.js — Audio() requests go through SW transparently
- FlashcardPage, TestPage, ReviewFlashcardPage, ReviewTestPage — work as before, SW handles caching
- api.js — fetch calls unchanged, SW intercepts transparently
