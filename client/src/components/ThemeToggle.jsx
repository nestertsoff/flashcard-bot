import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      className="lang-btn"
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      {theme === 'light' ? '\u263E' : '\u2600'}
    </button>
  );
}
