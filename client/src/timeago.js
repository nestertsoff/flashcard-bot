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
