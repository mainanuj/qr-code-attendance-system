import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useCameraScanner } from '../hooks/useCameraScanner.js';
import ThemeToggle from './ThemeToggle.jsx';

export default function PublicScanner({ theme, toggleTheme, openLogin, openDashboard, isTeacherLoggedIn }) {
  const [summary, setSummary] = useState({ attendanceRate: 0, checkedIn: 0, totalStudents: 0 });
  const [active, setActive] = useState(false);
  const [token, setToken] = useState('');
  const [result, setResult] = useState('');
  const [resultType, setResultType] = useState('');
  const [scanFeedback, setScanFeedback] = useState('');
  const feedbackTimerRef = useRef(null);

  const refresh = useCallback(async () => {
    try { setSummary(await api.publicSummary()); } catch { setResult('Summary is unavailable while the server is offline.'); setResultType('error'); }
    try {
      const sessionStatus = await api.publicSession();
      setActive(Boolean(sessionStatus.active));
    } catch { setActive(false); }
  }, [isTeacherLoggedIn]);
  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 10000);
    return () => { window.clearInterval(interval); window.clearTimeout(feedbackTimerRef.current); };
  }, [refresh]);

  const showScanFeedback = useCallback((status) => {
    window.clearTimeout(feedbackTimerRef.current);
    setScanFeedback('');
    window.requestAnimationFrame(() => {
      setScanFeedback(status);
      feedbackTimerRef.current = window.setTimeout(() => setScanFeedback(''), 1600);
    });
  }, []);

  const markAttendance = useCallback(async (code) => {
    const value = String(code || '').trim();
    if (!value || !active) return false;
    setResult('Checking attendance...'); setResultType('');
    try {
      const data = await api.publicCheckin(value);
      setResult(`${data.record.status}: ${data.student.name} (${data.student.course} - ${data.student.section})`);
      setResultType('success'); setToken(''); showScanFeedback(data.record.status); await refresh();
      return true;
    } catch (error) { setResult(error.message); setResultType('error'); return false; }
  }, [active, refresh, showScanFeedback]);
  const { videoRef, running, error, start, stop } = useCameraScanner(markAttendance);

  const shownResult = error || result || (!active ? 'Attendance is not active yet. Your teacher will start today’s class from the dashboard.' : '');

  return <section className="public-landing" id="publicLanding">
    <header className="public-header"><a className="brand" href="#publicLanding"><span className="brand-mark">A</span><span>attendly</span></a><div className="public-header-actions"><ThemeToggle theme={theme} onToggle={toggleTheme} /><button className="outline-btn" type="button" onClick={isTeacherLoggedIn ? openDashboard : openLogin}>{isTeacherLoggedIn ? 'Teacher dashboard' : 'Teacher login'}</button></div></header>
    <main className="public-main">
      <div className="public-heading"><p className="eyebrow">QR ATTENDANCE SYSTEM</p><h1>Scan QR to mark attendance</h1></div>
      <section className="public-scanner public-scanner-top" id="publicScanner">
        <div className="public-scanner-copy"><p className="eyebrow">PUBLIC CHECK-IN</p><h2>Scan student QR</h2>
          <div className="public-session-box" style={{ marginBottom: 14 }}>
            {active ? <div className="public-live-class-badge public-scanner-ready"><b className="dot-active" /> <span>Scanner ready</span></div> : <p className="muted">Your teacher will start today’s class from their dashboard.</p>}
          </div>
          <div className="scanner-actions"><button className="primary-btn" type="button" disabled={!active} onClick={start}>Start camera</button><button className="outline-btn" type="button" onClick={stop}>Stop</button></div>
          <label className="public-manual-label">QR token or roll number<input value={token} disabled={!active} onChange={(event) => setToken(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && markAttendance(token)} placeholder="e.g. ATD-3A8F12" /></label>
          <button className="secondary-btn wide" type="button" disabled={!active} onClick={() => markAttendance(token)}>Mark attendance</button>
          <div className={`scan-result ${resultType}`} role="status">{shownResult}</div>
        </div>
        <div className={`camera-frame public-camera-frame ${scanFeedback ? 'scan-confirmed' : ''}`}><video ref={videoRef} className={running ? 'active' : ''} autoPlay muted playsInline /><div className="camera-placeholder" hidden={running}><span>QR</span><h3>Camera is off</h3><p>Start the camera to scan a QR code.</p></div><div className="scan-corners" />{scanFeedback && <div className="public-scan-confirmation" role="status"><span>✓</span><strong>{scanFeedback === 'Late' ? 'Late check-in marked' : 'Attendance marked'}</strong></div>}</div>
      </section>
      <div style={{ height: 24 }} aria-hidden="true" />
      <section className="public-hero-grid"><article className="public-session-card"><div><p className="eyebrow">CURRENT SESSION</p><h2>QR attendance session</h2><p>Live check-in for today’s scheduled classes</p><span className="public-live"><b /> Live now</span><button className="public-scan-link" type="button" onClick={() => document.querySelector('#publicScanner')?.scrollIntoView({ behavior: 'smooth' })}>Scan QR <span>Scan</span></button></div><div className="public-orbit" aria-hidden="true"><i /><i /><i /><strong>QR</strong></div></article>
      <article className="public-rate-card"><div className="quick-head"><span className="icon-tile">Rate</span><span className="pill">Today</span></div><strong>{summary.attendanceRate}%</strong><p>attendance rate</p><div className="progress"><span style={{ width: `${summary.attendanceRate}%` }} /></div><small>{summary.checkedIn} of {summary.totalStudents} students checked in</small></article></section>
    </main>
  </section>;
}
