export default function BrandLogo({ size = 34, className = '' }) {
  return (
    <svg
      className={`brand-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Attendly logo"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="attFrameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00f5d4" />
          <stop offset="60%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id="attAGrad" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="40%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <linearGradient id="attCheckGrad" x1="0%" y1="50%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00f5d4" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id="attBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#101a35" />
          <stop offset="100%" stopColor="#060c1c" />
        </linearGradient>
        <linearGradient id="attBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.3" />
        </linearGradient>
        <filter id="attGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* App Squircle Badge */}
      <rect x="4" y="4" width="112" height="112" rx="26" fill="url(#attBgGrad)" stroke="url(#attBorderGrad)" strokeWidth="2.5" />

      {/* QR Box Frame (Concept 2 background viewfinder) */}
      <rect x="25" y="24" width="62" height="62" rx="9" stroke="url(#attFrameGrad)" strokeWidth="5.5" strokeOpacity="0.85" fill="none" />

      {/* Geometric 'A' Monogram */}
      <path d="M22 86 L56 22 L75 58" stroke="url(#attAGrad)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />

      {/* Verified Attendance Checkmark */}
      <path d="M54 68 L68 82 L98 44" stroke="url(#attCheckGrad)" strokeWidth="10.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#attGlow)" />

      {/* Central QR Target Viewfinder inside 'A' */}
      <path d="M50 50 H47 V53" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M60 50 H63 V53" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M47 59 V62 H50" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M63 59 V62 H60" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="52.5" y="53.5" width="5" height="5" rx="1.2" fill="#22d3ee" />
    </svg>
  );
}
