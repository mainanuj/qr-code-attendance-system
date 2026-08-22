import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

export function useCameraScanner(onCode) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const busyRef = useRef(false);
  const scannedCodesRef = useRef(new Set());
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRunning(false);
  }, []);

  const processCode = useCallback(async (code) => {
    if (busyRef.current || scannedCodesRef.current.has(code)) return;
    busyRef.current = true;
    try {
      const marked = await onCode(code);
      if (marked) scannedCodesRef.current.add(code);
    } finally {
      busyRef.current = false;
    }
  }, [onCode]);

  const scanFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current || busyRef.current || video.readyState < 2) return;
    try {
      const Detector = window.BarcodeDetector;
      if (Detector) {
        const detector = new Detector({ formats: ['qr_code'] });
        const codes = await detector.detect(video);
        if (codes[0]?.rawValue) await processCode(codes[0].rawValue);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const code = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
      if (code?.data) await processCode(code.data);
    } catch { busyRef.current = false; }
  }, [processCode]);

  const start = useCallback(async () => {
    stop(); setError(''); scannedCodesRef.current.clear();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      timerRef.current = setInterval(scanFrame, 450);
      setRunning(true);
    } catch { setError('Camera permission was denied or no camera was found.'); }
  }, [scanFrame, stop]);

  useEffect(() => stop, [stop]);
  return { videoRef, running, error, start, stop };
}
