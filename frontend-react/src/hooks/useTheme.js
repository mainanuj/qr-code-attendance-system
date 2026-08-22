import { useEffect, useState } from 'react';
import darkThemeUrl from '../styles/futuristic-dark.css?url';

const key = 'attendly-colour-theme';

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem(key) || 'dark');

  useEffect(() => {
    const linkId = 'futuristicDarkTheme';
    let link = document.getElementById(linkId);
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = darkThemeUrl;
      document.head.appendChild(link);
    }
    const light = theme === 'light';
    link.disabled = light;
    document.body.classList.toggle('light-theme', light);
    document.documentElement.style.colorScheme = light ? 'light' : 'dark';
    localStorage.setItem(key, theme);
  }, [theme]);

  return { theme, toggleTheme: () => setTheme((value) => value === 'light' ? 'dark' : 'light') };
}
