(() => {
  const storageKey = 'attendly-colour-theme';
  const buttons = [...document.querySelectorAll('.theme-toggle')];

  function applyTheme(theme) {
    const light = theme === 'light';
    const darkThemeStylesheet = document.getElementById('futuristicDarkTheme');
    if (darkThemeStylesheet) darkThemeStylesheet.disabled = light;
    document.body.classList.toggle('light-theme', light);
    document.documentElement.style.colorScheme = light ? 'light' : 'dark';
    buttons.forEach((button) => {
      button.textContent = light ? '◐ Dark mode' : '☀ Light mode';
      button.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
    });
  }

  let savedTheme = 'dark';
  try { savedTheme = localStorage.getItem(storageKey) || 'dark'; } catch (_) { /* Storage can be unavailable. */ }
  applyTheme(savedTheme);

  buttons.forEach((button) => button.addEventListener('click', () => {
    const nextTheme = document.body.classList.contains('light-theme') ? 'dark' : 'light';
    try { localStorage.setItem(storageKey, nextTheme); } catch (_) { /* Keep the in-memory choice. */ }
    applyTheme(nextTheme);
  }));
})();
