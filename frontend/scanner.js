/* QR camera fallback for browsers that do not provide BarcodeDetector. */
let fallbackStream;
let fallbackTimer;
let fallbackDetector;

function stopFallbackScanner() {
  clearInterval(fallbackTimer);
  fallbackTimer = undefined;
  if (fallbackStream) fallbackStream.getTracks().forEach((track) => track.stop());
  fallbackStream = undefined;
}

function showCameraError(message) {
  const result = document.querySelector('#scanResult');
  result.textContent = message;
  result.className = 'scan-result error';
}

async function startReliableScanner() {
  stopFallbackScanner();
  if (!navigator.mediaDevices?.getUserMedia) {
    showCameraError('Camera access is unavailable here. Use Chrome/Edge on localhost or use manual check-in.');
    return;
  }

  try {
    /* Ask the camera for a modest resolution — QR codes don't need 4K, and a
       smaller feed means every frame we process afterwards is already lighter. */
    fallbackStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 800 }, height: { ideal: 600 } }
    });
    const video = document.querySelector('#cameraVideo');
    video.srcObject = fallbackStream;
    video.classList.add('active');
    document.querySelector('#cameraPlaceholder').style.display = 'none';
    await video.play();

    if ('BarcodeDetector' in window) fallbackDetector = new BarcodeDetector({ formats: ['qr_code'] });

    /* Decode a small, fixed-size square instead of the full frame. This matches
       the on-screen scan box, cuts the pixel count jsQR has to read by a lot,
       and drops the extra "mirrored" attempt (only needed for a front camera —
       this app always requests the rear/environment camera). */
    const scanSize = 500;
    const canvas = document.createElement('canvas');
    canvas.width = scanSize;
    canvas.height = scanSize;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    fallbackTimer = setInterval(async () => {
      if (!video.videoWidth || !video.videoHeight) return;
      let value = '';
      try {
        if (fallbackDetector) {
          const detected = await fallbackDetector.detect(video);
          value = detected[0]?.rawValue || '';
        }

        if (!value && window.jsQR) {
          const side = Math.min(video.videoWidth, video.videoHeight);
          const sx = (video.videoWidth - side) / 2;
          const sy = (video.videoHeight - side) / 2;
          context.drawImage(video, sx, sy, side, side, 0, 0, scanSize, scanSize);
          value = window.jsQR(
            context.getImageData(0, 0, scanSize, scanSize).data,
            scanSize,
            scanSize,
            { inversionAttempts: 'dontInvert' }
          )?.data || '';

          /* Many laptop webcams send an already-mirrored raw feed, so also try
             the horizontally flipped version. This runs on the small cropped
             canvas, so it stays cheap even though it's a second decode pass. */
          if (!value) {
            context.save();
            context.translate(scanSize, 0);
            context.scale(-1, 1);
            context.drawImage(video, sx, sy, side, side, 0, 0, scanSize, scanSize);
            context.restore();
            value = window.jsQR(
              context.getImageData(0, 0, scanSize, scanSize).data,
              scanSize,
              scanSize,
              { inversionAttempts: 'dontInvert' }
            )?.data || '';
          }
        } else if (!fallbackDetector) {
          showCameraError('QR decoder could not load. Check your internet connection or use manual check-in.');
          stopFallbackScanner();
          return;
        }
      } catch { return; }

      if (value) {
        const checkedIn = window.submitAttendance ? await window.submitAttendance(value) : checkIn(value);
        if (checkedIn) stopFallbackScanner();
      }
    }, 200);
  } catch {
    showCameraError('Camera permission was denied or no camera was found. Allow camera access, then try again.');
  }
}

document.querySelector('#startCamera').addEventListener('click', (event) => {
  event.stopImmediatePropagation();
  startReliableScanner();
}, true);

document.querySelector('#stopCamera').addEventListener('click', (event) => {
  event.stopImmediatePropagation();
  stopFallbackScanner();
  stopCamera();
}, true);

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.view !== 'scanner') stopFallbackScanner();
}, true));
