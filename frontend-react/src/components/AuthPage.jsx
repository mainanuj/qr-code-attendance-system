import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import BrandLogo from './BrandLogo.jsx';

export default function AuthPage({ onAuthenticated, back }) {
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', newPassword: '', confirmPassword: '' });
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const register = mode === 'register';
  const forgot = mode === 'forgot';
  const update = (name) => (event) => setForm((value) => ({ ...value, [name]: event.target.value }));

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
    setSuccess('');
    setOtp('');
    setOtpSent(false);
    setOtpCountdown(0);
    setLoading(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowNewPassword(false);
    setForm({ name: '', username: '', email: '', password: '', newPassword: '', confirmPassword: '' });
  }

  async function handleSendRegisterOtp(e) {
    if (e) e.preventDefault();
    setError(''); setSuccess('');
    if (!form.name.trim() || !form.username.trim() || !form.email.trim() || !form.password) {
      setError('Please fill in all registration fields.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Password and confirm password do not match.');
      return;
    }
    try {
      setLoading(true);
      const res = await api.sendRegisterOtp({
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password
      });
      setOtpSent(true);
      setOtpCountdown(60);
      setSuccess(res.message || `Verification code sent to ${form.email.trim()}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendResetOtp(e) {
    if (e) e.preventDefault();
    setError(''); setSuccess('');
    if (!form.username.trim() || !form.email.trim()) {
      setError('Please enter your username and registered email.');
      return;
    }
    try {
      setLoading(true);
      const res = await api.sendResetOtp({
        username: form.username.trim(),
        email: form.email.trim()
      });
      setOtpSent(true);
      setOtpCountdown(60);
      setSuccess(res.message || `Verification code sent to ${form.email.trim()}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault(); setError(''); setSuccess('');

    // RESET PASSWORD
    if (forgot) {
      if (!otpSent) {
        await handleSendResetOtp();
        return;
      }
      if (!otp.trim() || otp.trim().length !== 6) {
        setError('Please enter the 6-digit verification code sent to your email.');
        return;
      }
      if (!form.newPassword || form.newPassword.length < 6) {
        setError('New password must be at least 6 characters.');
        return;
      }
      if (form.newPassword !== form.confirmPassword) {
        setError('New password and confirm password do not match.');
        return;
      }
      try {
        setLoading(true);
        const result = await api.resetPassword({
          username: form.username.trim(),
          email: form.email.trim(),
          otp: otp.trim(),
          newPassword: form.newPassword
        });
        setSuccess(result.message || 'Password reset successfully! Please log in.');
        setMode('login');
        setOtpSent(false);
        setOtp('');
        setForm((prev) => ({ ...prev, password: '', newPassword: '', confirmPassword: '' }));
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // REGISTRATION
    if (register) {
      if (!otpSent) {
        await handleSendRegisterOtp();
        return;
      }
      if (!otp.trim() || otp.trim().length !== 6) {
        setError('Please enter the 6-digit verification code sent to your email.');
        return;
      }
      try {
        setLoading(true);
        const session = await api.register({
          name: form.name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          otp: otp.trim()
        });
        onAuthenticated(session);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // LOGIN
    try {
      setLoading(true);
      const session = await api.login({
        username: form.username.trim(),
        password: form.password
      });
      onAuthenticated(session);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  const title = register
    ? (otpSent ? 'Verify your email' : 'Create teacher account')
    : forgot
      ? (otpSent ? 'Enter verification code' : 'Reset password')
      : 'Welcome back';

  const subtitle = register
    ? (otpSent ? `Enter the 6-digit code sent to ${form.email.trim()}` : 'Create your private dashboard in a few seconds.')
    : forgot
      ? (otpSent ? `Enter the 6-digit code sent to ${form.email.trim()}` : 'Verify your username & email to set a new password.')
      : 'Log in to access your private teacher dashboard.';

  return (
    <section className="auth-screen">
      <div className="auth-panel">
        <a className="brand auth-brand" href="/login" onClick={(e) => { e.preventDefault(); if (back) back(); }}>
          <span className="brand-mark"><BrandLogo size={36} /></span>
          <span>Attendly</span>
        </a>
        <div className="auth-copy">
          <p className="eyebrow">QR ATTENDANCE SYSTEM</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        <form key={mode} className="auth-form" onSubmit={submit} autoComplete="off">
          {/* Decoy trap inputs: intercepts aggressive browser autofill so visible inputs stay clean */}
          <div style={{ position: 'absolute', opacity: 0, height: 0, width: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: -1 }} aria-hidden="true">
            <input type="text" name="chrome_prevent_autofill_username" tabIndex={-1} autoComplete="off" />
            <input type="password" name="chrome_prevent_autofill_password" tabIndex={-1} autoComplete="off" />
          </div>

          {forgot ? (
            /* ================= FORGOT PASSWORD ================= */
            !otpSent ? (
              <>
                <label>Username
                  <input name="attendly_reset_username" value={form.username} onChange={update('username')} placeholder="Your username" autoComplete="off" required disabled={loading} />
                </label>
                <label>Registered Email
                  <input name="attendly_reset_email" value={form.email} onChange={update('email')} type="email" autoComplete="off" placeholder="teacher@college.edu" required disabled={loading} />
                </label>
                <button className="primary-btn wide" type="submit" disabled={loading}>
                  {loading ? 'Sending code...' : 'Send verification code'} <span>→</span>
                </button>
              </>
            ) : (
              <>
                <div className="auth-otp-badge">
                  <span>Code sent to <strong>{form.email.trim()}</strong></span>
                  <button type="button" className="auth-otp-edit-btn" onClick={() => { setOtpSent(false); setOtp(''); }}>Change</button>
                </div>

                <label>6-Digit Verification Code
                  <input
                    className="auth-otp-input"
                    name="attendly_reset_otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                    disabled={loading}
                  />
                </label>

                <div className="auth-resend-row">
                  <span>Didn't receive code?</span>
                  <button
                    type="button"
                    className="auth-resend-btn"
                    disabled={otpCountdown > 0 || loading}
                    onClick={handleSendResetOtp}
                  >
                    {otpCountdown > 0 ? `Resend in ${otpCountdown}s` : 'Resend code'}
                  </button>
                </div>

                <label>New Password
                  <div className="auth-password-wrap">
                    <input
                      name="attendly_reset_new_password"
                      value={form.newPassword}
                      onChange={update('newPassword')}
                      type={showNewPassword ? 'text' : 'password'}
                      minLength={6}
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                      required
                      disabled={loading}
                    />
                    <button type="button" className="auth-password-toggle" onClick={() => setShowNewPassword((prev) => !prev)} aria-label={showNewPassword ? 'Hide password' : 'Show password'} title={showNewPassword ? 'Hide password' : 'Show password'} tabIndex="-1">
                      <EyeIcon visible={showNewPassword} />
                    </button>
                  </div>
                </label>

                <label>Confirm New Password
                  <div className="auth-password-wrap">
                    <input
                      name="attendly_reset_confirm_password"
                      value={form.confirmPassword}
                      onChange={update('confirmPassword')}
                      type={showNewPassword ? 'text' : 'password'}
                      minLength={6}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                      required
                      disabled={loading}
                    />
                  </div>
                </label>

                <button className="primary-btn wide" type="submit" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify & Reset password'} <span>→</span>
                </button>
              </>
            )
          ) : register ? (
            /* ================= REGISTER ================= */
            !otpSent ? (
              <>
                <label>Full name
                  <input name="attendly_register_name" value={form.name} onChange={update('name')} autoComplete="off" placeholder="Prof. Sharma" required disabled={loading} />
                </label>
                <label>Username
                  <input name="attendly_register_username" value={form.username} onChange={update('username')} autoComplete="off" placeholder="Choose a unique username" required disabled={loading} />
                </label>
                <label>Email (for OTP verification)
                  <input name="attendly_register_email" value={form.email} onChange={update('email')} type="email" autoComplete="off" placeholder="teacher@college.edu" required disabled={loading} />
                </label>
                <label>Password
                  <div className="auth-password-wrap">
                    <input name="attendly_register_password" value={form.password} onChange={update('password')} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 6 characters" required disabled={loading} />
                    <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} tabIndex="-1">
                      <EyeIcon visible={showPassword} />
                    </button>
                  </div>
                </label>
                <label>Confirm Password
                  <div className="auth-password-wrap">
                    <input name="attendly_register_confirm_password" value={form.confirmPassword} onChange={update('confirmPassword')} type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Re-enter your password" required disabled={loading} />
                    <button type="button" className="auth-password-toggle" onClick={() => setShowConfirmPassword((prev) => !prev)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} title={showConfirmPassword ? 'Hide password' : 'Show password'} tabIndex="-1">
                      <EyeIcon visible={showConfirmPassword} />
                    </button>
                  </div>
                </label>
                <button className="primary-btn wide" type="submit" disabled={loading}>
                  {loading ? 'Sending code...' : 'Continue to verify email'} <span>→</span>
                </button>
              </>
            ) : (
              <>
                <div className="auth-otp-badge">
                  <span>Code sent to <strong>{form.email.trim()}</strong></span>
                  <button type="button" className="auth-otp-edit-btn" onClick={() => { setOtpSent(false); setOtp(''); }}>Edit details</button>
                </div>

                <label>6-Digit Verification Code
                  <input
                    className="auth-otp-input"
                    name="attendly_register_otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                    disabled={loading}
                  />
                </label>

                <div className="auth-resend-row">
                  <span>Didn't receive code?</span>
                  <button
                    type="button"
                    className="auth-resend-btn"
                    disabled={otpCountdown > 0 || loading}
                    onClick={handleSendRegisterOtp}
                  >
                    {otpCountdown > 0 ? `Resend in ${otpCountdown}s` : 'Resend code'}
                  </button>
                </div>

                <button className="primary-btn wide" type="submit" disabled={loading}>
                  {loading ? 'Creating account...' : 'Verify & Create account'} <span>→</span>
                </button>
              </>
            )
          ) : (
            /* ================= LOGIN ================= */
            <>
              <label>Username or email
                <input name="attendly_login_account" value={form.username} onChange={update('username')} autoComplete="off" placeholder="Username or email" required disabled={loading} />
              </label>
              <label>Password
                <div className="auth-password-wrap">
                  <input name="attendly_login_password" value={form.password} onChange={update('password')} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Your password" required disabled={loading} />
                  <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} tabIndex="-1">
                    <EyeIcon visible={showPassword} />
                  </button>
                </div>
              </label>
              <div className="auth-forgot-row">
                <button type="button" className="auth-forgot-link" onClick={() => switchMode('forgot')}>Forgot password?</button>
              </div>
              <button className="primary-btn wide" type="submit" disabled={loading}>
                {loading ? 'Logging in...' : 'Log in'} <span>→</span>
              </button>
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
      </div>

      <div className="auth-art">
        <div className="auth-orbit orbit-a" />
        <div className="auth-orbit orbit-b" />
        <div className="auth-qr">⌁</div>
        <p>Your students. Your records.<br /><strong>One secure dashboard.</strong></p>
      </div>
    </section>
  );
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
