import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      className="lang-btn"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      style={{ fontSize: 16, padding: '4px 8px' }}
    >
      {theme === 'light' ? '\u263E' : '\u2600'}
    </button>
  );
}
