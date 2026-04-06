# PWA with Offline Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the flashcard web app into an installable PWA with offline study, cached TTS audio, and transparent progress synchronization.

**Architecture:** Service Worker intercepts all fetches with three strategies: cache-first for app shell and TTS audio, network-first for API data. Offline progress is queued in IndexedDB and synced via Background Sync. A prefetch module pre-downloads TTS audio when sets are viewed.

**Tech Stack:** Vite + React SPA, Service Worker (vanilla JS), Cache API, IndexedDB, Background Sync API

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `client/public/manifest.json` | Create | PWA manifest |
| `client/public/icons/icon-192.png` | Create | PWA icon 192x192 |
| `client/public/icons/icon-512.png` | Create | PWA icon 512x512 |
| `client/public/sw.js` | Create | Service Worker: caching, offline sync |
| `client/src/prefetch.js` | Create | TTS audio prefetch with progress |
| `client/index.html` | Modify | Add manifest link, theme-color, apple-touch-icon |
| `client/src/main.jsx` | Modify | Register service worker |
| `client/src/pages/SetDetailPage.jsx` | Modify | Prefetch indicator in header |
| `client/src/pages/SetsPage.jsx` | Modify | Prefetch indicator on set cards |
| `client/src/pages/ReviewPage.jsx` | Modify | Prefetch for review cards |
| `client/src/index.css` | Modify | Spinner animation for prefetch indicator |

---

### Task 1: PWA Manifest, Icons & HTML Meta Tags

**Files:**
- Create: `client/public/manifest.json`
- Create: `client/public/icons/icon-192.png`
- Create: `client/public/icons/icon-512.png`
- Modify: `client/index.html`

- [ ] **Step 1: Create manifest.json**

Create `client/public/manifest.json`:

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

- [ ] **Step 2: Generate PWA icons**

```bash
mkdir -p client/public/icons
# Using ImageMagick (or sharp-cli, or any resizer)
convert client/public/embarrassed.png -resize 192x192 client/public/icons/icon-192.png
convert client/public/embarrassed.png -resize 512x512 client/public/icons/icon-512.png
```

If `convert` is not available, use Node.js with sharp:
```bash
npx sharp-cli -i client/public/embarrassed.png -o client/public/icons/icon-192.png resize 192 192
npx sharp-cli -i client/public/embarrassed.png -o client/public/icons/icon-512.png resize 512 512
```

- [ ] **Step 3: Update index.html**

Replace the current `client/index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/embarrassed.png" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <link rel="manifest" href="/manifest.json" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#FFB4A2" />
    <title>Elvishka — Flashcards</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Build to verify**

Run: `cd client && npm run build`
Expected: Build succeeds. Check `dist/manifest.json` and `dist/icons/` exist.

- [ ] **Step 5: Commit**

```bash
git add client/public/manifest.json client/public/icons/ client/index.html
git commit -m "feat: add PWA manifest, icons, and meta tags"
```

---

### Task 2: Service Worker Registration

**Files:**
- Modify: `client/src/main.jsx`

- [ ] **Step 1: Add SW registration**

In `client/src/main.jsx`, add after the `createRoot(...).render(...)` block at the very end of the file:

```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

The full end of file should look like:

```javascript
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

- [ ] **Step 2: Build to verify**

Run: `cd client && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add client/src/main.jsx
git commit -m "feat: register service worker in main.jsx"
```

---

### Task 3: Service Worker — Core Caching

**Files:**
- Create: `client/public/sw.js`

- [ ] **Step 1: Create sw.js with caching strategies**

Create `client/public/sw.js`:

```javascript
const CACHE_VERSION = 1;
const APP_SHELL_CACHE = `app-shell-v${CACHE_VERSION}`;
const API_DATA_CACHE = 'api-data';
const TTS_CACHE = 'tts-audio';

const APP_SHELL_URLS = [
  '/',
  '/manifest.json',
  '/embarrassed.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/stickers/1.webp', '/stickers/2.webp', '/stickers/3.webp',
  '/stickers/4.webp', '/stickers/5.webp', '/stickers/6.webp',
  '/stickers/7.webp', '/stickers/8.webp', '/stickers/9.webp',
  '/stickers/10.webp', '/stickers/11.webp', '/stickers/12.webp',
];

// --- INSTALL ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS))
  );
  self.skipWaiting();
});

// --- ACTIVATE ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('app-shell-') && k !== APP_SHELL_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// --- FETCH ---
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET for caching (POST/DELETE/PATCH handled separately)
  if (event.request.method !== 'GET') {
    if (url.pathname === '/api/progress') {
      event.respondWith(handleProgressPost(event));
    }
    return;
  }

  // TTS audio — cache-first
  if (url.pathname === '/api/tts') {
    event.respondWith(cacheFirst(event.request, TTS_CACHE));
    return;
  }

  // API data — network-first
  if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/')) {
    event.respondWith(networkFirst(event.request, API_DATA_CACHE));
    return;
  }

  // App shell & static assets — cache-first with network fallback
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(event.request, APP_SHELL_CACHE));
    return;
  }
});

// --- STRATEGIES ---

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    // Flush pending progress on successful network
    flushPendingProgress();
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// --- OFFLINE PROGRESS SYNC ---

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('elvishka-offline', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('pending-progress', { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueProgress(body) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending-progress', 'readwrite');
    tx.objectStore('pending-progress').add({ ...body, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getPendingProgress() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending-progress', 'readonly');
    const req = tx.objectStore('pending-progress').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function clearPendingProgress() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending-progress', 'readwrite');
    tx.objectStore('pending-progress').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function handleProgressPost(event) {
  const body = await event.request.clone().json();
  try {
    const response = await fetch(event.request);
    return response;
  } catch {
    // Offline — queue and update cache optimistically
    await queueProgress(body);
    await updateCachedProgress(body);
    // Try Background Sync
    if (self.registration.sync) {
      self.registration.sync.register('sync-progress');
    }
    return new Response(JSON.stringify({ ok: true, offline: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function updateCachedProgress({ cardId, status }) {
  const cache = await caches.open(API_DATA_CACHE);
  const keys = await cache.keys();

  for (const req of keys) {
    const url = new URL(req.url);

    // Update /api/sets/:id
    if (/^\/api\/sets\/\d+$/.test(url.pathname)) {
      const res = await cache.match(req);
      if (!res) continue;
      const data = await res.json();
      const card = data.cards?.find((c) => c.id === cardId);
      if (card) {
        const oldStatus = card.status;
        card.status = status;
        if (status === 'learning') card.mistakes = (card.mistakes || 0) + 1;
        card.last_seen = new Date().toISOString();
        cache.put(req, new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' },
        }));
        // Also update the sets list
        await updateSetsListCache(cache, oldStatus, status);
      }
    }
  }
}

async function updateSetsListCache(cache, oldStatus, newStatus) {
  const listReq = await cache.match('/api/sets');
  if (!listReq) return;
  const sets = await listReq.json();
  // We can't know which set — just let it refresh next online load
  // The individual set detail cache is already correct
}

async function flushPendingProgress() {
  const pending = await getPendingProgress();
  if (pending.length === 0) return;
  for (const item of pending) {
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cardId: item.cardId, status: item.status }),
      });
    } catch {
      return; // Still offline, stop flushing
    }
  }
  await clearPendingProgress();
}

// --- BACKGROUND SYNC ---

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress') {
    event.waitUntil(flushPendingProgress());
  }
});
```

- [ ] **Step 2: Build to verify sw.js is copied to dist**

Run: `cd client && npm run build && ls dist/sw.js`
Expected: `sw.js` exists in `dist/`.

- [ ] **Step 3: Commit**

```bash
git add client/public/sw.js
git commit -m "feat: add service worker with 3-strategy caching and offline sync"
```

---

### Task 4: TTS Audio Prefetch Module

**Files:**
- Create: `client/src/prefetch.js`

- [ ] **Step 1: Create prefetch.js**

Create `client/src/prefetch.js`:

```javascript
export async function prefetchSetAudio(set, onProgress) {
  if (!set || !set.cards || set.cards.length === 0) return;

  const urls = [];
  for (const card of set.cards) {
    urls.push(`/api/tts?text=${encodeURIComponent(card.word)}&lang=${encodeURIComponent(set.lang)}`);
    const trans = Array.isArray(card.translations) ? card.translations.join(', ') : card.translations;
    urls.push(`/api/tts?text=${encodeURIComponent(trans)}&lang=${encodeURIComponent(set.translation_lang)}`);
  }

  const total = urls.length;
  let loaded = 0;
  if (onProgress) onProgress({ total, loaded });

  // Filter out already cached URLs
  const uncached = [];
  for (const url of urls) {
    const match = await caches.match(url);
    if (!match) uncached.push(url);
    else loaded++;
  }
  if (onProgress) onProgress({ total, loaded });
  if (uncached.length === 0) return;

  // Fetch with concurrency limit
  const limit = 4;
  let i = 0;
  async function next() {
    while (i < uncached.length) {
      const url = uncached[i++];
      try {
        await fetch(url);
      } catch {}
      loaded++;
      if (onProgress) onProgress({ total, loaded });
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, uncached.length) }, next));
}

export async function prefetchReviewAudio(cards, onProgress) {
  if (!cards || cards.length === 0) return;

  const urls = [];
  for (const card of cards) {
    urls.push(`/api/tts?text=${encodeURIComponent(card.word)}&lang=${encodeURIComponent(card.lang)}`);
    const trans = Array.isArray(card.translations) ? card.translations.join(', ') : card.translations;
    urls.push(`/api/tts?text=${encodeURIComponent(trans)}&lang=${encodeURIComponent(card.translation_lang)}`);
  }

  const total = urls.length;
  let loaded = 0;
  if (onProgress) onProgress({ total, loaded });

  const uncached = [];
  for (const url of urls) {
    const match = await caches.match(url);
    if (!match) uncached.push(url);
    else loaded++;
  }
  if (onProgress) onProgress({ total, loaded });
  if (uncached.length === 0) return;

  const limit = 4;
  let i = 0;
  async function next() {
    while (i < uncached.length) {
      const url = uncached[i++];
      try {
        await fetch(url);
      } catch {}
      loaded++;
      if (onProgress) onProgress({ total, loaded });
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, uncached.length) }, next));
}
```

- [ ] **Step 2: Build to verify**

Run: `cd client && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add client/src/prefetch.js
git commit -m "feat: add TTS audio prefetch module with concurrency limit"
```

---

### Task 5: Prefetch Indicator CSS

**Files:**
- Modify: `client/src/index.css`

- [ ] **Step 1: Add prefetch indicator styles**

In `client/src/index.css`, add these styles after the `.speak-btn:active` rule (around line 389):

```css
/* Prefetch indicator */
.prefetch-indicator { display: inline-flex; align-items: center; margin-left: 8px; }
.prefetch-spinner {
  width: 14px; height: 14px;
  border: 2px solid var(--border); border-top-color: var(--primary-dark);
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
.prefetch-done {
  color: var(--success); animation: fadeIn 0.3s ease;
}
```

The `spin` and `fadeIn` keyframes already exist in the file.

- [ ] **Step 2: Build to verify**

Run: `cd client && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add client/src/index.css
git commit -m "feat: add prefetch indicator styles"
```

---

### Task 6: Integrate Prefetch into SetDetailPage

**Files:**
- Modify: `client/src/pages/SetDetailPage.jsx`

- [ ] **Step 1: Add prefetch import and state**

At the top of `client/src/pages/SetDetailPage.jsx`, add import after the `timeAgo` import:

```javascript
import { prefetchSetAudio } from '../prefetch';
```

In the state declarations (after `const [titleDraft, setTitleDraft] = useState('');`), add:

```javascript
const [prefetchStatus, setPrefetchStatus] = useState(null); // null | 'loading' | 'done'
```

- [ ] **Step 2: Add prefetch call in loadSet**

Update the `loadSet` function to trigger prefetch after loading:

```javascript
  async function loadSet() {
    try {
      const data = await api.getSet(id);
      setSet(data);
      setPrefetchStatus('loading');
      prefetchSetAudio(data, ({ total, loaded }) => {
        if (loaded >= total) {
          setPrefetchStatus('done');
          setTimeout(() => setPrefetchStatus(null), 2000);
        }
      }).catch(() => setPrefetchStatus(null));
    } catch { navigate('/'); }
  }
```

- [ ] **Step 3: Add indicator in header**

Find the spacer div in the header: `<div style={{ width: 36 }} />` (line 146). Replace it with:

```jsx
        <div style={{ width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {prefetchStatus === 'loading' && <div className="prefetch-spinner" />}
          {prefetchStatus === 'done' && (
            <span className="prefetch-done">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
          )}
        </div>
```

- [ ] **Step 4: Build to verify**

Run: `cd client && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/SetDetailPage.jsx
git commit -m "feat: add TTS prefetch with indicator to SetDetailPage"
```

---

### Task 7: Integrate Prefetch into SetsPage

**Files:**
- Modify: `client/src/pages/SetsPage.jsx`

- [ ] **Step 1: Add prefetch import and state**

At the top of `client/src/pages/SetsPage.jsx`, add import after the `SettingsDropdown` import:

```javascript
import { prefetchSetAudio } from '../prefetch';
```

Add state for per-set prefetch status. After `const [newTransLang, setNewTransLang] = useState('uk');`:

```javascript
const [prefetchStatuses, setPrefetchStatuses] = useState({});
```

- [ ] **Step 2: Add prefetch function and trigger**

After the `loadSets` function, add a prefetch function:

```javascript
  async function prefetchAllSets(setsData) {
    for (const s of setsData) {
      if (s.card_count === 0) continue;
      try {
        const fullSet = await api.getSet(s.id);
        setPrefetchStatuses(prev => ({ ...prev, [s.id]: 'loading' }));
        await prefetchSetAudio(fullSet, ({ total, loaded }) => {
          if (loaded >= total) {
            setPrefetchStatuses(prev => ({ ...prev, [s.id]: 'done' }));
            setTimeout(() => setPrefetchStatuses(prev => ({ ...prev, [s.id]: null })), 2000);
          }
        });
      } catch {}
    }
  }
```

Update `loadSets` to trigger prefetch:

```javascript
  async function loadSets() {
    const data = await api.getSets();
    setSets(data);
    try {
      const r = await api.getReviewCount();
      setReviewCount(r.count);
    } catch {}
    prefetchAllSets(data);
  }
```

- [ ] **Step 3: Add indicator to set cards**

In the set card render (the `{sets.map(s => (` block), update the stats line to include the indicator. Replace:

```jsx
            <span className="stats">{s.card_count} {t.cards}</span>
```

With:

```jsx
            <span className="stats" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {s.card_count} {t.cards}
              {prefetchStatuses[s.id] === 'loading' && <span className="prefetch-spinner" />}
              {prefetchStatuses[s.id] === 'done' && (
                <span className="prefetch-done">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
              )}
            </span>
```

- [ ] **Step 4: Build to verify**

Run: `cd client && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/SetsPage.jsx
git commit -m "feat: add TTS prefetch with indicators to SetsPage"
```

---

### Task 8: Integrate Prefetch into ReviewPage

**Files:**
- Modify: `client/src/pages/ReviewPage.jsx`

- [ ] **Step 1: Add prefetch import and state**

At the top of `client/src/pages/ReviewPage.jsx`, add import:

```javascript
import { prefetchReviewAudio } from '../prefetch';
```

Add state after `const [direction, setDirection] = useState('word');`:

```javascript
const [prefetchStatus, setPrefetchStatus] = useState(null);
```

- [ ] **Step 2: Trigger prefetch when cards load**

Update the existing `useEffect` that fetches review cards:

```javascript
  useEffect(() => {
    api.getReview(limit).then(data => {
      setCards(data.cards);
      if (data.cards.length > 0) {
        setPrefetchStatus('loading');
        prefetchReviewAudio(data.cards, ({ total, loaded }) => {
          if (loaded >= total) {
            setPrefetchStatus('done');
            setTimeout(() => setPrefetchStatus(null), 2000);
          }
        }).catch(() => setPrefetchStatus(null));
      }
    }).catch(() => navigate('/'));
  }, [limit]);
```

- [ ] **Step 3: Add indicator in header**

Find the spacer div `<div style={{ width: 44 }} />` in the header of the main return (the non-empty state, around line 52). Replace with:

```jsx
        <div style={{ width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {prefetchStatus === 'loading' && <div className="prefetch-spinner" />}
          {prefetchStatus === 'done' && (
            <span className="prefetch-done">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
          )}
        </div>
```

- [ ] **Step 4: Build to verify**

Run: `cd client && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/ReviewPage.jsx
git commit -m "feat: add TTS prefetch with indicator to ReviewPage"
```

---

### Task 9: Final Test, Build & Deploy

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All 25 tests pass.

- [ ] **Step 2: Build client**

Run: `cd client && npm run build`
Expected: Build succeeds. Verify these files exist in `dist/`:
- `sw.js`
- `manifest.json`
- `icons/icon-192.png`
- `icons/icon-512.png`

- [ ] **Step 3: Test PWA locally**

Run the server locally and verify:
1. Open Chrome DevTools → Application → Manifest — should show app info
2. Application → Service Workers — should show registered SW
3. Application → Cache Storage — should show `app-shell-v1`, `api-data`, `tts-audio` caches
4. Go offline (DevTools → Network → Offline checkbox) — app should still load, sets should display from cache
5. Lighthouse → PWA audit — should pass installable criteria

- [ ] **Step 4: Push and deploy**

```bash
git push origin master
```

Expected: CI builds Docker image, deploys to VM. After deploy, verify PWA works on elvishka.com.
