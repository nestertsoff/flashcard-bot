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
