import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Rendering once avoids duplicate development-only effects such as refreshing
// dashboard data twice while the teacher is clicking a control.
createRoot(document.getElementById('root')).render(<App />);
