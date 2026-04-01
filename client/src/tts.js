const LANG_MAP = {
  en: 'en-US',
  uk: 'uk-UA',
  ru: 'ru-RU',
  tr: 'tr-TR',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-PT',
  pl: 'pl-PL',
  ja: 'ja-JP',
  ko: 'ko-KR',
  zh: 'zh-CN',
  ar: 'ar-SA',
  nl: 'nl-NL',
  sv: 'sv-SE',
  cs: 'cs-CZ',
  ro: 'ro-RO',
  hu: 'hu-HU',
};

export function hasVoice(langCode) {
  if (!window.speechSynthesis) return false;
  const lang = LANG_MAP[langCode] || langCode || 'en-US';
  const voices = window.speechSynthesis.getVoices();
  return voices.some(v => v.lang === lang || v.lang.startsWith(lang.split('-')[0]));
}

export function speak(text, langCode) {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const lang = LANG_MAP[langCode] || langCode || 'en-US';
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;

  // Try to find a matching voice
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find(v => v.lang === lang)
    || voices.find(v => v.lang.startsWith(lang.split('-')[0]));
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = lang;
  }

  window.speechSynthesis.speak(utterance);
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
