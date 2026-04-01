import { useLang } from '../context/LangContext';

export default function LangSwitcher() {
  const { lang, changeLang, LANGUAGES } = useLang();
  return (
    <div className="lang-switcher">
      {LANGUAGES.map(l => (
        <button key={l.code}
          className={`lang-btn ${lang === l.code ? 'active' : ''}`}
          onClick={() => changeLang(l.code)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}
