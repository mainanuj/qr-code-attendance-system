(() => {
  const $ = (selector) => document.querySelector(selector);
  const video = $('#publicCameraVideo');
  const placeholder = $('#publicCameraPlaceholder');
  const result = $('#publicScanResult');
  let stream = null;
  let scanTimer = null;
  let checking = false;
  let detector = null;

  function setResult(message, type = '') { result.textContent = message; result.className = `scan-result ${type}`; }
  async function publicRequest(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to complete the request.');
    return data;
  }
  async function loadPublicSummary() {
    try {
      const summary = await publicRequest('/api/public/summary');
      $('#publicAttendanceRate').textContent = `${summary.attendanceRate}%`;
      $('#publicAttendanceProgress').style.width = `${summary.attendanceRate}%`;
      $('#publicPresentSummary').textContent = `${summary.checkedIn} of ${summary.totalStudents} students checked in`;
    } catch { setResult('Summary is unavailable while the server is offline.', 'error'); }
  }
  async function markAttendance(code) {
    const value = String(code || '').trim();
    if (!value || checking) return;
    checking = true;
    setResult('Checking attendance...');
    try {
      const data = await publicRequest('/api/public/check-in', { method: 'POST', body: JSON.stringify({ code: value }) });
      setResult(`${data.record.status}: ${data.student.name} (${data.student.course} - ${data.student.section})`, 'success');
      $('#publicManualToken').value = '';
      await loadPublicSummary();
      stopCamera();
    } catch (error) { setResult(error.message, 'error'); }
    finally { checking = false; }
  }
  function stopCamera() {
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
    if (stream) { stream.getTracks().forEach((track) => track.stop()); stream = null; }
    video.classList.remove('active');
    placeholder.hidden = false;
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
  $('#publicStartCamera').addEventListener('click', startCamera);
  $('#publicStopCamera').addEventListener('click', stopCamera);
  $('#publicManualCheckin').addEventListener('click', () => markAttendance($('#publicManualToken').value));
  $('#publicManualToken').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); markAttendance(event.target.value); } });
  $('#scrollToPublicScanner').addEventListener('click', () => $('#publicScanner').scrollIntoView({ behavior: 'smooth', block: 'center' }));
  window.loadPublicSummary = loadPublicSummary;
  loadPublicSummary();
})();
