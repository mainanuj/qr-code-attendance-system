const SESSION_KEY = 'attendly-session';
// Empty locally: requests stay relative (/api/...) and Vite proxies them to
// localhost:5000. Vercel supplies VITE_API_URL for the Render API origin.
const apiOrigin = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}

export function saveSession(session) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
export function clearSession() { sessionStorage.removeItem(SESSION_KEY); }

export async function request(path, options = {}) {
  const session = getSession();
  const formData = options.body instanceof FormData;
  const response = await fetch(`${apiOrigin}/api${path}`, {
    ...options,
    headers: {
      ...(formData ? {} : { 'Content-Type': 'application/json' }),
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The server could not complete that request.');
  return data;
}

export const api = {
  health: () => request('/health'),
  publicSummary: () => request('/public/summary'),
  publicSession: () => request('/public/session-status'),
  publicCheckin: (code) => request('/public/check-in', { method: 'POST', body: JSON.stringify({ code }) }),
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  students: () => request('/students'),
  createStudent: (body) => request('/students', { method: 'POST', body: JSON.stringify(body) }),
  updateStudent: (id, body) => request(`/students/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteStudent: (id) => request(`/students/${id}`, { method: 'DELETE' }),
  importStudents: (formData) => request('/students/import', { method: 'POST', body: formData }),
  attendance: (date = '') => request(`/attendance${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  checkin: (code) => request('/attendance/check-in', { method: 'POST', body: JSON.stringify({ code }) }),
  studentRecords: (params) => request(`/attendance/student-records?${new URLSearchParams(params)}`),
  dashboardSettings: () => request('/classes/dashboard-settings'),
  saveDashboardSettings: (body) => request('/classes/dashboard-settings', { method: 'PUT', body: JSON.stringify(body) }),
  attendanceSettings: () => request('/classes/attendance-settings'),
  saveAttendanceSettings: (body) => request('/classes/attendance-settings', { method: 'PUT', body: JSON.stringify(body) }),
  startSession: () => request('/classes/start-session', { method: 'POST', body: JSON.stringify({}) })
};
