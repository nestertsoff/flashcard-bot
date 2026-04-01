let currentAudio = null;

export function speak(text, langCode) {
  if (!text || !langCode) return;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${langCode}&client=tw-ob`;
  const audio = new Audio(url);
  audio.playbackRate = 0.9;
  currentAudio = audio;
  audio.play().catch(() => {});
}

export function hasVoice() {
  return true;
}

export function getAutoplay() {
  return localStorage.getItem('autoplay') === 'true';
}

export function setAutoplay(val) {
  localStorage.setItem('autoplay', val ? 'true' : 'false');
}

export const TTS_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'ru', label: 'Russian' },
  { code: 'tr', label: 'Turkish' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'pl', label: 'Polish' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'nl', label: 'Dutch' },
  { code: 'sv', label: 'Swedish' },
  { code: 'cs', label: 'Czech' },
  { code: 'ro', label: 'Romanian' },
  { code: 'hu', label: 'Hungarian' },
];
