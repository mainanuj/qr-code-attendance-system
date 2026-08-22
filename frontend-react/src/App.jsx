import { useCallback, useEffect, useState } from 'react';
import './styles/legacy.css';
import { clearSession, getSession, saveSession } from './api/client.js';
import { useTheme } from './hooks/useTheme.js';
import ThemeToggle from './components/ThemeToggle.jsx';
import Toast from './components/Toast.jsx';
import PublicScanner from './components/PublicScanner.jsx';
import AuthPage from './components/AuthPage.jsx';
import AdminLayout from './components/AdminLayout.jsx';

export default function App() {
  // `?scan=public` always opens the login-free student scanner, even when a
  // teacher account is already active in the same browser.
  const [screen, setScreen] = useState(() => new URLSearchParams(window.location.search).get('scan') === 'public' ? 'public' : (getSession()?.token ? 'admin' : 'public'));
  const [session, setSession] = useState(() => getSession());
  const [message, setMessage] = useState('');
  const { theme, toggleTheme } = useTheme();
  const toast = useCallback((text) => setMessage(text), []);

  useEffect(() => { document.body.classList.toggle('authenticated', screen === 'admin'); document.body.classList.toggle('auth-mode', screen === 'auth'); }, [screen]);
  function openPublicScanner() { window.history.pushState({}, '', '/?scan=public'); setScreen('public'); }
  function openDashboard() { window.history.replaceState({}, '', '/'); setScreen('admin'); }
  function authenticated(nextSession) { saveSession(nextSession); setSession(nextSession); openDashboard(); }
  function logout() { clearSession(); setSession(null); window.history.replaceState({}, '', '/'); setScreen('public'); toast('You have been logged out.'); }

  return <div className="react-app">
    {screen === 'public' && <PublicScanner theme={theme} toggleTheme={toggleTheme} openLogin={() => setScreen('auth')} openDashboard={openDashboard} isTeacherLoggedIn={Boolean(session?.token)} />}
    {screen === 'auth' && <><div className="react-auth-theme"><ThemeToggle theme={theme} onToggle={toggleTheme} /></div><AuthPage onAuthenticated={authenticated} back={() => setScreen('public')} /></>}
    {screen === 'admin' && session && <AdminLayout session={session} logout={logout} theme={theme} toggleTheme={toggleTheme} toast={toast} openPublicScanner={openPublicScanner} />}
    <Toast message={message} clear={() => setMessage('')} />
  </div>;
}
