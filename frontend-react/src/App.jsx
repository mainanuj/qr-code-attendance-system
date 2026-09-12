import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import './styles/legacy.css';
import { clearSession, getSession, saveSession } from './api/client.js';
import { useTheme } from './hooks/useTheme.js';
import ThemeToggle from './components/ThemeToggle.jsx';
import Toast from './components/Toast.jsx';
import PublicScanner from './components/PublicScanner.jsx';
import AuthPage from './components/AuthPage.jsx';
import AdminLayout from './components/AdminLayout.jsx';

const adminPaths = ['/dashboard', '/students', '/attendance', '/attendance-records', '/settings'];

export default function App() {
  const [session, setSession] = useState(() => getSession());
  const [message, setMessage] = useState('');
  const { theme, toggleTheme } = useTheme();
  const toast = useCallback((text) => setMessage(text), []);
  const location = useLocation();
  const navigate = useNavigate();

  const isAuthRoute = location.pathname === '/login' || location.pathname === '/auth';
  const isAdminRoute = adminPaths.includes(location.pathname);

  useEffect(() => {
    document.body.classList.toggle('authenticated', isAdminRoute);
    document.body.classList.toggle('auth-mode', isAuthRoute);
  }, [isAdminRoute, isAuthRoute]);

  function handleAuthenticated(nextSession) {
    saveSession(nextSession);
    setSession(nextSession);
    navigate('/dashboard');
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    navigate('/');
    toast('You have been logged out.');
  }

  return (
    <div className="react-app">
      <Routes>
        {/* Public QR Scanner */}
        <Route
          path="/"
          element={
            <PublicScanner
              theme={theme}
              toggleTheme={toggleTheme}
              openLogin={() => navigate('/login')}
              openDashboard={() => navigate('/dashboard')}
              isTeacherLoggedIn={Boolean(session?.token)}
            />
          }
        />

        {/* Teacher Login / Register */}
        <Route
          path="/login"
          element={
            session?.token ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <>
                <div className="react-auth-theme">
                  <ThemeToggle theme={theme} onToggle={toggleTheme} />
                </div>
                <AuthPage
                  onAuthenticated={handleAuthenticated}
                  back={() => navigate('/')}
                />
              </>
            )
          }
        />
        <Route path="/auth" element={<Navigate to="/login" replace />} />

        {/* Protected Dashboard Routes (Wrapped in single parent to preserve state across tab switches) */}
        <Route
          element={
            session?.token ? (
              <AdminLayout
                session={session}
                logout={handleLogout}
                theme={theme}
                toggleTheme={toggleTheme}
                toast={toast}
                openPublicScanner={() => navigate('/')}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          {adminPaths.map((path) => (
            <Route key={path} path={path} element={null} />
          ))}
        </Route>

        {/* Catch-all fallback */}
        <Route
          path="*"
          element={<Navigate to={session?.token ? '/dashboard' : '/'} replace />}
        />
      </Routes>
      <Toast message={message} clear={() => setMessage('')} />
    </div>
  );
}

