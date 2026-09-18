import { useState } from 'react';
import { api } from '../api/client.js';
import BrandLogo from './BrandLogo.jsx';

export default function AuthPage({ onAuthenticated, back }) {
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });
  const [inputsUnlocked, setInputsUnlocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const register = mode === 'register';
  const update = (name) => (event) => setForm((value) => ({ ...value, [name]: event.target.value }));

  async function submit(event) {
    event.preventDefault(); setError('');
    try {
      const session = register ? await api.register(form) : await api.login({ username: form.username, password: form.password });
      onAuthenticated(session);
    } catch (requestError) { setError(requestError.message); }
  }
  return <section className="auth-screen"><div className="auth-panel"><a className="brand auth-brand" href="/login" onClick={(e) => { e.preventDefault(); if (back) back(); }}><span className="brand-mark"><BrandLogo size={36} /></span><span>Attendly</span></a>
    <div className="auth-copy"><p className="eyebrow">QR ATTENDANCE SYSTEM</p><h1>{register ? 'Create teacher account' : 'Welcome back'}</h1><p>{register ? 'Create your private dashboard in a few seconds.' : 'Log in to access your private teacher dashboard.'}</p></div>
    <form className="auth-form" onSubmit={submit} autoComplete="off">{register && <label>Full name<input value={form.name} onChange={update('name')} autoComplete="name" required /></label>}<label>Username<input name="attendly-login-username" value={form.username} onFocus={() => setInputsUnlocked(true)} onChange={update('username')} autoComplete={register ? 'username' : 'off'} readOnly={!register && !inputsUnlocked} required /></label>{register && <label>Email<input value={form.email} onChange={update('email')} type="email" autoComplete="email" placeholder="teacher@college.edu" required /></label>}<label>Password<div className="auth-password-wrap"><input name="attendly-login-password" value={form.password} onFocus={() => setInputsUnlocked(true)} onChange={update('password')} type={showPassword ? 'text' : 'password'} autoComplete="new-password" readOnly={!register && !inputsUnlocked} placeholder={register ? 'At least 6 characters' : 'Your password'} required /><button type="button" className="auth-password-toggle" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} tabIndex="-1">{showPassword ? (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>) : (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>)}</button></div></label><button className="primary-btn wide" type="submit">{register ? 'Create teacher account' : 'Log in'} <span>→</span></button></form>
    <p className="auth-error" role="alert">{error}</p><p className="auth-toggle">{register ? 'Already have an account?' : 'New teacher?'} <button type="button" onClick={() => { setMode(register ? 'login' : 'register'); setError(''); setShowPassword(false); }}>{register ? 'Log in' : 'Create an account'}</button></p>{back && <button className="auth-back" type="button" onClick={back}>Back to public QR scanner</button>}
  </div><div className="auth-art"><div className="auth-orbit orbit-a" /><div className="auth-orbit orbit-b" /><div className="auth-qr">⌁</div><p>Your students. Your records.<br /><strong>One secure dashboard.</strong></p></div></section>;
}
