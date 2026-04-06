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
        card.status = status;
        if (status === 'learning') card.mistakes = (card.mistakes || 0) + 1;
        card.last_seen = new Date().toISOString();
        cache.put(req, new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' },
        }));
      }
    }
  }
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
