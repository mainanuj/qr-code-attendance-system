import { useEffect } from 'react';

export default function Toast({ message, clear }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(clear, 3000);
    return () => clearTimeout(timer);
  }, [message, clear]);
  return <div className={`toast ${message ? 'show' : ''}`} role="status">{message}</div>;
}
