import { useCallback, useState } from 'react';
import { useCameraScanner } from '../hooks/useCameraScanner.js';

export default function ScannerView({ onCheckin }) {
  const [token, setToken] = useState('');
  const [result, setResult] = useState({ text: '', type: '' });
  const checkin = useCallback(async (code) => {
    const value = String(code || '').trim(); if (!value) return;
    setResult({ text: 'Checking attendance...', type: '' });
    try { const response = await onCheckin(value); setResult({ text: `✓ ${response.student.name} marked ${response.record.status.toLowerCase()} at ${response.record.time}.`, type: 'success' }); setToken(''); stop(); }
    catch (error) { setResult({ text: error.message, type: 'error' }); }
  }, [onCheckin]);
  const { videoRef, running, error, start, stop } = useCameraScanner(checkin);
  return <section><div className="page-heading"><div><p className="eyebrow">LIVE SESSION</p><h2>Scan attendance</h2><p className="muted">Point the camera at a student’s Attendly QR card.</p></div><span className="live-badge"><b /> Ready to scan</span></div><div className="scanner-layout"><section className="scanner-card"><div className="camera-frame"><video ref={videoRef} className={running ? 'active' : ''} autoPlay muted playsInline /><div className="camera-placeholder" hidden={running}><span>⌁</span><h3>Camera is off</h3><p>Start the camera to scan a QR code.</p></div><div className="scan-corners" /></div><div className="scanner-actions"><button className="primary-btn" onClick={start}>Start camera</button><button className="outline-btn" onClick={stop}>Stop</button></div><p className="camera-note">Camera scanning uses your browser’s QR detector when available.</p></section><section className="manual-card"><span className="manual-icon">⌁</span><h3>Manual check-in</h3><p>Use this if the camera is unavailable, or paste a QR token.</p><label>QR token or roll number<input value={token} onChange={(event) => setToken(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && checkin(token)} placeholder="e.g. ATD-3A8F12" /></label><button className="secondary-btn wide" onClick={() => checkin(token)}>Mark present →</button><div className={`scan-result ${error ? 'error' : result.type}`} role="status">{error || result.text}</div></section></div></section>;
}
