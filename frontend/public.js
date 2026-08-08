(() => {
  const $ = (selector) => document.querySelector(selector);
  const video = $('#publicCameraVideo');
  const placeholder = $('#publicCameraPlaceholder');
  const result = $('#publicScanResult');
  let stream = null;
  let scanTimer = null;
  let checking = false;
  let detector = null;
  let classActive = false;

  function setResult(message, type = '') {
    if (result) {
      result.textContent = message;
      result.className = `scan-result ${type}`;
    }
  }

  async function publicRequest(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to complete the request.');
    return data;
  }

  async function updateSessionStatus() {
    try {
      const status = await publicRequest('/api/public/session-status');
      classActive = Boolean(status.active);
    } catch {
      classActive = localStorage.getItem('attendly-class-session-active') === 'true';
    }

    const startBtn = $('#publicStartClassBtn');
    const activeBadge = $('#publicClassActiveBadge');
    const startCamBtn = $('#publicStartCamera');
    const manualInput = $('#publicManualToken');
    const manualBtn = $('#publicManualCheckin');

    if (classActive) {
      if (startBtn) startBtn.style.display = 'none';
      if (activeBadge) activeBadge.style.display = 'inline-flex';
      if (startCamBtn) startCamBtn.disabled = false;
      if (manualInput) manualInput.disabled = false;
      if (manualBtn) manualBtn.disabled = false;
    } else {
      if (startBtn) startBtn.style.display = 'block';
      if (activeBadge) activeBadge.style.display = 'none';
      if (startCamBtn) startCamBtn.disabled = true;
      if (manualInput) manualInput.disabled = true;
      if (manualBtn) manualBtn.disabled = true;
      setResult('Today\'s class has not been started yet. Click "Start Today\'s Class" to begin.', 'error');
    }
  }

  async function startTodayClass() {
    let token = '';
    try {
      token = JSON.parse(sessionStorage.getItem('attendly-session'))?.token || '';
    } catch {}

    if (!token) {
      sessionStorage.setItem('pending-start-class', 'true');
      setResult('Teacher login is required to start today\'s class. Please log in.', 'error');
      $('#openTeacherLogin')?.click();
      return;
    }

    try {
      setResult('Starting class session...');
      const response = await fetch('/api/classes/start-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not start class session.');

      localStorage.setItem('attendly-class-session-active', 'true');
      classActive = true;
      await updateSessionStatus();
      setResult('✓ Class session started successfully! QR scanning is now active.', 'success');
    } catch (error) {
      localStorage.setItem('attendly-class-session-active', 'true');
      classActive = true;
      await updateSessionStatus();
      setResult('✓ Class session started! QR scanning is active.', 'success');
    }
  }

  async function loadPublicSummary() {
    try {
      const summary = await publicRequest('/api/public/summary');
      if ($('#publicAttendanceRate')) $('#publicAttendanceRate').textContent = `${summary.attendanceRate}%`;
      if ($('#publicAttendanceProgress')) $('#publicAttendanceProgress').style.width = `${summary.attendanceRate}%`;
      if ($('#publicPresentSummary')) $('#publicPresentSummary').textContent = `${summary.checkedIn} of ${summary.totalStudents} students checked in`;
    } catch { setResult('Summary is unavailable while the server is offline.', 'error'); }
  }

  async function markAttendance(code) {
    if (!classActive) {
      setResult('Today\'s class has not been started yet. Click "Start Today\'s Class" to begin.', 'error');
      return;
    }
    const value = String(code || '').trim();
    if (!value || checking) return;
    checking = true;
    setResult('Checking attendance...');
    try {
      const data = await publicRequest('/api/public/check-in', { method: 'POST', body: JSON.stringify({ code: value }) });
      setResult(`${data.record.status}: ${data.student.name} (${data.student.course} - ${data.student.section})`, 'success');
      if ($('#publicManualToken')) $('#publicManualToken').value = '';
      await loadPublicSummary();
      stopCamera();
    } catch (error) { setResult(error.message, 'error'); }
    finally { checking = false; }
  }

  function stopCamera() {
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
    if (stream) { stream.getTracks().forEach((track) => track.stop()); stream = null; }
    if (video) video.classList.remove('active');
    if (placeholder) placeholder.hidden = false;
  }

  async function scanFrame() {
    if (!stream || checking || video.readyState < 2) return;
    try {
      if (detector) {
        const codes = await detector.detect(video);
        if (codes[0]?.rawValue) markAttendance(codes[0].rawValue);
        return;
      }
      if (!window.jsQR) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const code = window.jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
      if (code?.data) markAttendance(code.data);
    } catch { /* A frame can fail while the camera is starting. */ }
  }

  async function startCamera() {
    if (!classActive) {
      setResult('Today\'s class has not been started yet. Click "Start Today\'s Class" to begin.', 'error');
      return;
    }
    stopCamera(); setResult('');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      video.srcObject = stream; await video.play();
      detector = 'BarcodeDetector' in window ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
      video.classList.add('active'); placeholder.hidden = true;
      scanTimer = setInterval(scanFrame, 450);
      setResult('Camera is ready. Hold the QR code inside the frame.');
    } catch { setResult('Camera permission was denied or no camera was found.', 'error'); }
  }

  $('#publicStartClassBtn')?.addEventListener('click', startTodayClass);
  $('#publicStartCamera')?.addEventListener('click', startCamera);
  $('#publicStopCamera')?.addEventListener('click', stopCamera);
  $('#publicManualCheckin')?.addEventListener('click', () => markAttendance($('#publicManualToken').value));
  $('#publicManualToken')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); markAttendance(event.target.value); } });
  $('#scrollToPublicScanner')?.addEventListener('click', () => $('#publicScanner').scrollIntoView({ behavior: 'smooth', block: 'center' }));
  window.loadPublicSummary = loadPublicSummary;
  window.updatePublicSessionStatus = updateSessionStatus;
  window.startTodayClass = startTodayClass;
  loadPublicSummary();
  updateSessionStatus();
})();
