export default function ThemeToggle({ theme, onToggle }) {
  const light = theme === 'light';
  return <button className="theme-toggle" type="button" onClick={onToggle} aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}>{light ? '◐ Dark mode' : '☀ Light mode'}</button>;
}
