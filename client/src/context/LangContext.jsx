import { createContext, useContext, useState } from 'react';
import { getTranslations, LANGUAGES } from '../i18n';

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('lang');
    if (saved && ['en', 'uk', 'ru'].includes(saved)) return saved;
    const browser = navigator.language.slice(0, 2);
    if (browser === 'uk') return 'uk';
    if (browser === 'ru') return 'ru';
    return 'en';
  });

  const t = getTranslations(lang);

  const changeLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem('lang', newLang);
  };

  return (
    <LangContext.Provider value={{ lang, t, changeLang, LANGUAGES }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
