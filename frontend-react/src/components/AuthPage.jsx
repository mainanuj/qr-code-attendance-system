import { useState } from 'react';
import { api } from '../api/client.js';

export default function AuthPage({ onAuthenticated, back }) {
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });
  const register = mode === 'register';
  const update = (name) => (event) => setForm((value) => ({ ...value, [name]: event.target.value }));

  async function submit(event) {
    event.preventDefault(); setError('');
    try {
      const session = register ? await api.register(form) : await api.login({ username: form.username, password: form.password });
      onAuthenticated(session);
    } catch (requestError) { setError(requestError.message); }
  }
  return <section className="auth-screen"><div className="auth-panel"><a className="brand auth-brand" href="#"><span className="brand-mark">A</span><span>attendly</span></a>
    <div className="auth-copy"><p className="eyebrow">QR ATTENDANCE SYSTEM</p><h1>{register ? 'Create teacher account' : 'Welcome back'}</h1><p>{register ? 'Create your private dashboard in a few seconds.' : 'Log in to access your private teacher dashboard.'}</p></div>
    <form className="auth-form" onSubmit={submit}>{register && <label>Full name<input value={form.name} onChange={update('name')} autoComplete="name" required /></label>}<label>Username<input value={form.username} onChange={update('username')} autoComplete="username" required /></label>{register && <label>Email<input value={form.email} onChange={update('email')} type="email" autoComplete="email" placeholder="teacher@college.edu" required /></label>}<label>Password<input value={form.password} onChange={update('password')} type="password" autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? 'At least 6 characters' : 'Your password'} required /></label><button className="primary-btn wide" type="submit">{register ? 'Create teacher account' : 'Log in'} <span>→</span></button></form>
    <p className="auth-error" role="alert">{error}</p><p className="auth-toggle">{register ? 'Already have an account?' : 'New teacher?'} <button type="button" onClick={() => { setMode(register ? 'login' : 'register'); setError(''); }}>{register ? 'Log in' : 'Create an account'}</button></p><button className="auth-back" type="button" onClick={back}>Back to public QR scanner</button>
  </div><div className="auth-art"><div className="auth-orbit orbit-a" /><div className="auth-orbit orbit-b" /><div className="auth-qr">⌁</div><p>Your students. Your records.<br /><strong>One secure dashboard.</strong></p></div></section>;
}
