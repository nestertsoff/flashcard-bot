import { useState, useEffect } from 'react';
import { speak, hasVoice } from '../tts';

export default function SpeakButton({ text, lang, size = 18 }) {
  const [available, setAvailable] = useState(() => hasVoice(lang));

  useEffect(() => {
    // Voices may load async — recheck when they become available
    setAvailable(hasVoice(lang));
    const onVoicesChanged = () => setAvailable(hasVoice(lang));
    window.speechSynthesis?.addEventListener('voiceschanged', onVoicesChanged);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', onVoicesChanged);
  }, [lang]);

  if (!available) return null;

  return (
    <button
      className="speak-btn"
      onClick={(e) => { e.stopPropagation(); speak(text, lang); }}
      aria-label="Listen"
      title="Listen"
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      </svg>
    </button>
  );
}
