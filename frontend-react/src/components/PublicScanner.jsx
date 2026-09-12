import { useCallback, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useCameraScanner } from '../hooks/useCameraScanner.js';

export default function PublicScanner({
  students = [],
  rate = 0,
  present = 0,
  late = 0,
  dashboard = {},
  sessionActive = false,
  startTodayClass,
  startingSession = false,
  reload
}) {
  const [token, setToken] = useState('');
  const [result, setResult] = useState('');
  const [resultType, setResultType] = useState('');
  const [scanFeedback, setScanFeedback] = useState('');
  const feedbackTimerRef = useRef(null);

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
    if (!value) return false;
    if (!sessionActive) {
      setResult('Today’s class session has not been started yet. Click "Start today’s class" to begin.');
      setResultType('error');
      return false;
    }
    setResult('Checking attendance...');
    setResultType('');
    try {
      const data = await api.checkin(value);
      setResult(`${data.record.status}: ${data.student.name} (${data.student.course} - ${data.student.section})`);
      setResultType('success');
      setToken('');
      showScanFeedback(data.record.status);
      if (reload) reload();
      return true;
    } catch (error) {
      setResult(error.message);
      setResultType('error');
      return false;
    }
  }, [reload, sessionActive, showScanFeedback]);

  const { videoRef, running, error, start, stop } = useCameraScanner(markAttendance);

  const shownResult = error || result || (!sessionActive ? 'Attendance is not active yet. Click "Start today’s class" to begin.' : '');
  const totalCount = students.length;
  const checkedInCount = present + late;
  const sessionTitle = [dashboard?.courseLabel, dashboard?.sessionLabel].filter(Boolean).join(' ');

  return (
    <div className="dashboard-scanner-view">
      <div className="page-heading">
        <div>
          <p className="eyebrow">QR ATTENDANCE SYSTEM</p>
          <h2>Scan QR to mark attendance</h2>
          <p className="muted">Point camera at student QR cards or enter roll number manually.</p>
        </div>
      </div>

      <section className="public-scanner public-scanner-top" id="publicScanner">
        <div className="public-scanner-copy">
          <p className="eyebrow">CHECK-IN</p>
          <h2>Scan student QR</h2>
          <div className="public-session-box" style={{ marginBottom: 14 }}>
            {sessionActive ? (
              <div className="public-live-class-badge public-scanner-ready">
                <b className="dot-active" /> <span>Scanner ready</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                <div className="public-live-class-badge" style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' }}>
                  <span>Class not started yet</span>
                </div>
                {startTodayClass && (
                  <button
                    className="secondary-btn"
                    type="button"
                    disabled={startingSession}
                    onClick={startTodayClass}
                    style={{ padding: '8px 16px', fontSize: '12px' }}
                  >
                    {startingSession ? 'Starting class…' : 'Start today’s class →'}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="scanner-actions">
            <button className="primary-btn" type="button" disabled={!sessionActive} onClick={start}>Start camera</button>
            <button className="outline-btn" type="button" onClick={stop}>Stop</button>
          </div>
          <label className="public-manual-label">
            QR token or roll number
            <input
              value={token}
              disabled={!sessionActive}
              onChange={(event) => setToken(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && markAttendance(token)}
              placeholder={sessionActive ? "e.g. ATD-3A8F12" : "Start today's class first"}
            />
          </label>
          <button className="secondary-btn wide" type="button" disabled={!sessionActive} onClick={() => markAttendance(token)}>
            Mark attendance
          </button>
          <div className={`scan-result ${resultType}`} role="status">{shownResult}</div>
        </div>
        <div className={`camera-frame public-camera-frame ${scanFeedback ? 'scan-confirmed' : ''}`}>
          <video ref={videoRef} className={running ? 'active' : ''} autoPlay muted playsInline />
          <div className="camera-placeholder" hidden={running}>
            <span>QR</span>
            <h3>Camera is off</h3>
            <p>Start the camera to scan a QR code.</p>
          </div>
          <div className="scan-corners" />
          {scanFeedback && (
            <div className="public-scan-confirmation" role="status">
              <span>✓</span>
              <strong>{scanFeedback === 'Late' ? 'Late check-in marked' : 'Attendance marked'}</strong>
            </div>
          )}
        </div>
      </section>

      <div style={{ height: 24 }} aria-hidden="true" />

      <section className="public-hero-grid">
        <article className="public-session-card">
          <div>
            <p className="eyebrow">CURRENT SESSION</p>
            <h2>{sessionTitle || 'QR attendance session'}</h2>
            <p>{sessionActive ? 'Live check-in for today’s scheduled classes' : 'Class session has not been started yet today'}</p>
            {sessionActive ? (
              <span className="public-live">
                <b className="dot-active" /> Live now
              </span>
            ) : (
              <span className="public-live" style={{ color: '#fed7aa' }}>
                ● Session not started
              </span>
            )}
            <button
              className="public-scan-link"
              type="button"
              disabled={startingSession || (sessionActive ? false : false)}
              onClick={sessionActive ? () => document.querySelector('#publicScanner')?.scrollIntoView({ behavior: 'smooth' }) : startTodayClass}
            >
              {sessionActive ? 'Scan QR ↗' : startingSession ? 'Starting class…' : 'Start today’s class →'}
            </button>
          </div>
          <div className="public-orbit" aria-hidden="true">
            <i />
            <i />
            <i />
            <strong>QR</strong>
          </div>
        </article>

        <article className="public-rate-card">
          <div className="quick-head">
            <span className="icon-tile">Rate</span>
            <span className="pill">Today</span>
          </div>
          <strong>{rate}%</strong>
          <p>attendance rate</p>
          <div className="progress">
            <span style={{ width: `${rate}%` }} />
          </div>
          <small>{checkedInCount} of {totalCount} students checked in</small>
        </article>
      </section>
    </div>
  );
}
