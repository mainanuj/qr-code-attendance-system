import { useMemo } from 'react';
import QRCode from 'qrcode';

export default function QrSvg({ token, size = 160, className = '' }) {
  const svgData = useMemo(() => {
    if (!token) return null;
    try {
      const qr = QRCode.create(String(token), { errorCorrectionLevel: 'M' });
      const modSize = qr.modules.size;
      const data = qr.modules.data;
      let path = '';
      for (let r = 0; r < modSize; r++) {
        for (let c = 0; c < modSize; c++) {
          if (data[r * modSize + c]) {
            path += `M${c + 1} ${r + 1}h1v1h-1z `;
          }
        }
      }
      return { total: modSize + 2, path: path.trim() };
    } catch {
      return null;
    }
  }, [token]);

  if (!svgData) {
    return <div style={{ width: size, height: size, background: '#f1f5f9' }} className={className} />;
  }

  return (
    <svg
      viewBox={`0 0 ${svgData.total} ${svgData.total}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
    >
      <rect width="100%" height="100%" fill="#ffffff" />
      <path d={svgData.path} fill="#000000" />
    </svg>
  );
}
