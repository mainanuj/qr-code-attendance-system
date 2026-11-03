import { useState } from 'react';
import { api } from '../api/client.js';
import BrandLogo from './BrandLogo.jsx';

export default function AuthPage({ onAuthenticated, back }) {
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const register = mode === 'register';
  const forgot = mode === 'forgot';
  const update = (name) => (event) => setForm((value) => ({ ...value, [name]: event.target.value }));

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
    setSuccess('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowNewPassword(false);
    setForm((prev) => ({ ...prev, password: '', confirmPassword: '', newPassword: '' }));
  }

  async function submit(event) {
    event.preventDefault(); setError(''); setSuccess('');
    if (forgot) {
      if (form.newPassword !== form.confirmPassword) {
        setError('New password and confirm password do not match.');
        return;
      }
      try {
        const result = await api.resetPassword({
          username: form.username.trim(),
          email: form.email.trim(),
          newPassword: form.newPassword
        });
        setSuccess(result.message || 'Password reset successfully! Please log in.');
        setMode('login');
        setForm((prev) => ({ ...prev, password: '', newPassword: '', confirmPassword: '' }));
      } catch (requestError) { setError(requestError.message); }
      return;
    }

    if (register) {
      if (!form.password || form.password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError('Password and confirm password do not match.');
        return;
      }
    }

    try {
      const payload = register
        ? {
            name: form.name.trim(),
            username: form.username.trim(),
            email: form.email.trim(),
            password: form.password
          }
        : {
            username: form.username.trim(),
            password: form.password
          };
      const session = register ? await api.register(payload) : await api.login(payload);
      onAuthenticated(session);
    } catch (requestError) { setError(requestError.message); }
  }

  const title = register ? 'Create teacher account' : forgot ? 'Reset password' : 'Welcome back';
  const subtitle = register
    ? 'Create your private dashboard in a few seconds.'
    : forgot
      ? 'Verify your username & email to set a new password.'
      : 'Log in to access your private teacher dashboard.';

  return <section className="auth-screen"><div className="auth-panel"><a className="brand auth-brand" href="/login" onClick={(e) => { e.preventDefault(); if (back) back(); }}><span className="brand-mark"><BrandLogo size={36} /></span><span>Attendly</span></a>
    <div className="auth-copy"><p className="eyebrow">QR ATTENDANCE SYSTEM</p><h1>{title}</h1><p>{subtitle}</p></div>
    <form className="auth-form" onSubmit={submit} autoComplete="off">
      {forgot ? (
        <>
          <label>Username<input value={form.username} onChange={update('username')} placeholder="Your username" required /></label>
          <label>Registered Email<input value={form.email} onChange={update('email')} type="email" autoComplete="email" placeholder="teacher@college.edu" required /></label>
          <label>New Password
            <div className="auth-password-wrap">
              <input value={form.newPassword} onChange={update('newPassword')} type={showNewPassword ? 'text' : 'password'} minLength={6} placeholder="At least 6 characters" required />
              <button type="button" className="auth-password-toggle" onClick={() => setShowNewPassword((prev) => !prev)} aria-label={showNewPassword ? 'Hide password' : 'Show password'} title={showNewPassword ? 'Hide password' : 'Show password'} tabIndex="-1">
                <EyeIcon visible={showNewPassword} />
              </button>
            </div>
          </label>
          <label>Confirm New Password
            <div className="auth-password-wrap">
              <input value={form.confirmPassword} onChange={update('confirmPassword')} type={showNewPassword ? 'text' : 'password'} minLength={6} placeholder="Re-enter new password" required />
            </div>
          </label>
          <button className="primary-btn wide" type="submit">Reset password <span>→</span></button>
        </>
      ) : (
        <>
          {register && <label>Full name<input value={form.name} onChange={update('name')} autoComplete="name" placeholder="Prof. Sharma" required /></label>}
          <label>{register ? 'Username' : 'Username or email'}<input name="attendly-username" value={form.username} onChange={update('username')} autoComplete="username" placeholder={register ? 'Choose a unique username' : 'Username or email'} required /></label>
          {register && <label>Email<input value={form.email} onChange={update('email')} type="email" autoComplete="email" placeholder="teacher@college.edu" required /></label>}
          <label>Password
            <div className="auth-password-wrap">
              <input name="attendly-password" value={form.password} onChange={update('password')} type={showPassword ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? 'At least 6 characters' : 'Your password'} required />
              <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} tabIndex="-1">
                <EyeIcon visible={showPassword} />
              </button>
            </div>
          </label>
          {register && (
            <label>Confirm Password
              <div className="auth-password-wrap">
                <input name="attendly-register-confirm-password" value={form.confirmPassword} onChange={update('confirmPassword')} type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Re-enter your password" required />
                <button type="button" className="auth-password-toggle" onClick={() => setShowConfirmPassword((prev) => !prev)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} title={showConfirmPassword ? 'Hide password' : 'Show password'} tabIndex="-1">
                  <EyeIcon visible={showConfirmPassword} />
                </button>
              </div>
            </label>
          )}
          {!register && (
            <div className="auth-forgot-row">
              <button type="button" className="auth-forgot-link" onClick={() => switchMode('forgot')}>Forgot password?</button>
            </div>
          )}
          <button className="primary-btn wide" type="submit">{register ? 'Create teacher account' : 'Log in'} <span>→</span></button>
        </>
      )}
    </form>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {success && <p className="auth-success" role="status">{success}</p>}
    <p className="auth-toggle">
      {forgot ? (
        <>Remember your password? <button type="button" onClick={() => switchMode('login')}>Log in</button></>
      ) : register ? (
        <>Already have an account? <button type="button" onClick={() => switchMode('login')}>Log in</button></>
      ) : (
        <>New teacher? <button type="button" onClick={() => switchMode('register')}>Create an account</button></>
      )}
    </p>
    {back && <button className="auth-back" type="button" onClick={back}>Back to public QR scanner</button>}
  </div><div className="auth-art"><div className="auth-orbit orbit-a" /><div className="auth-orbit orbit-b" /><div className="auth-qr">⌁</div><p>Your students. Your records.<br /><strong>One secure dashboard.</strong></p></div></section>;
}

function EyeIcon({ visible }) {
  return visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
