import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { dateLabel, initials, localDate } from '../utils/format.js';
import ThemeToggle from './ThemeToggle.jsx';
import StudentsView from './StudentsView.jsx';
import AttendanceView from './AttendanceView.jsx';
import SettingsView from './SettingsView.jsx';
import BrandLogo from './BrandLogo.jsx';
import PublicScanner from './PublicScanner.jsx';

const nav = [
  { id: 'dashboard', path: '/dashboard', icon: '▦', label: 'Overview' },
  { id: 'scan', path: '/scan', icon: '⌁', label: 'Scan QR' },
  { id: 'students', path: '/students', icon: '♙', label: 'Students' },
  { id: 'attendance', path: '/attendance', icon: '▤', label: 'Attendance log' },
  { id: 'attendance-records', path: '/attendance-records', icon: '📋', label: 'Attendance Records' },
  { id: 'settings', path: '/settings', icon: '◷', label: 'Class settings' }
];

const pathToView = {
  '/dashboard': 'dashboard',
  '/scan': 'scan',
  '/students': 'students',
  '/attendance': 'records',
  '/attendance-records': 'attendance-records',
  '/settings': 'settings'
};

export default function AdminLayout({ session, logout, theme, toggleTheme, toast }) {
  const location = useLocation();
  const navigate = useNavigate();
  const view = pathToView[location.pathname] || 'dashboard';

  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [dashboard, setDashboard] = useState({ courseLabel: '', sessionLabel: '', yearLabel: '', semesterLabel: '' });
  const [timings, setTimings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingSession, setStartingSession] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const today = localDate();

  const reload = useCallback(async (date = today, showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const targetDate = date || today;
      const [studentRows, attendanceRows, dashboardSettings, timingSettings, sessionStatus] = await Promise.all([
        api.students(),
        api.attendance(targetDate),
        api.dashboardSettings(),
        api.attendanceSettings(),
        api.publicSession()
      ]);
      setStudents(studentRows);
      setAttendance(attendanceRows);
      setDashboard(dashboardSettings);
      setTimings(timingSettings);
      setSessionActive(Boolean(sessionStatus.teacherActive));
    } catch (error) { toast(error.message); }
    finally { setLoading(false); }
  }, [toast, today]);

  // The attendance log must open on today's register, not the entire old
  // attendance history. The date-specific API also creates the Absent rows.
  useEffect(() => { reload(today); }, [reload, today]);

  useEffect(() => {
    if (location.pathname === '/settings') {
      api.attendanceSettings().then(setTimings).catch(() => {});
      api.dashboardSettings().then(setDashboard).catch(() => {});
    }
    if (location.pathname === '/attendance') {
      api.attendance(today).then(setAttendance).catch(() => {});
    }
  }, [location.pathname, today]);

  const todayAttendance = useMemo(() => attendance.filter((item) => item.date === today), [attendance, today]);
  const present = todayAttendance.filter((item) => item.status === 'Present').length;
  const late = todayAttendance.filter((item) => item.status === 'Late').length;
  const rate = students.length ? Math.round(((present + late) / students.length) * 100) : 0;
  const appTitle = view === 'dashboard' ? `Good morning, ${session.teacher.name} ✦` : ({ scan: 'Scan QR attendance', students: 'Student roster', records: 'Attendance log', 'attendance-records': 'Attendance Records', settings: 'Class settings' })[view];
  const startTodayClass = async () => {
    setStartingSession(true);
    try {
      await api.startSession();
      setSessionActive(true);
      toast('Today’s class is active. QR attendance is now open.');
      reload(today);
    } catch (error) { toast(error.message); }
    finally { setStartingSession(false); }
  };

  return <div className="app-shell">
    <aside className="sidebar" aria-label="Main navigation"><a className="brand" href="/dashboard" onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }}><span className="brand-mark"><BrandLogo size={32} /></span><span>Attendly</span></a><nav className="nav-links">{nav.map(({ id, path, icon, label }) => <button key={id} type="button" className={`nav-link ${location.pathname === path ? 'active' : ''}`} aria-current={location.pathname === path ? 'page' : undefined} onClick={() => navigate(path)}><span>{icon}</span> {label}</button>)}</nav><div className="sidebar-bottom"><div className="teacher-card"><span className="avatar">{initials(session.teacher.name)}</span><div><strong>{session.teacher.name}</strong><small>Instructor</small></div></div><button className="settings-button" type="button" title="Log out" onClick={logout}>↪</button></div></aside>
    <main className="main-content"><header className="topbar"><div><p className="eyebrow">{dateLabel()}</p><h1>{appTitle}</h1></div><div className="top-actions"><ThemeToggle theme={theme} onToggle={toggleTheme} /><button className="icon-button" type="button" title="Notifications">♧<i /></button><button className="primary-btn scan-nav" type="button" onClick={() => navigate('/scan')}>Scan QR <span>↗</span></button><button className="mobile-logout" type="button" onClick={logout}>Log out</button></div></header>
      {loading ? <div className="empty-state"><h3>Loading dashboard…</h3></div> : <>
        {view === 'dashboard' && <Dashboard dashboard={dashboard} students={students} attendance={attendance} rate={rate} present={present} late={late} navigate={navigate} startTodayClass={startTodayClass} startingSession={startingSession} sessionActive={sessionActive} />}
        {view === 'scan' && <PublicScanner reload={reload} students={students} attendance={attendance} rate={rate} present={present} late={late} dashboard={dashboard} sessionActive={sessionActive} startTodayClass={startTodayClass} startingSession={startingSession} navigate={navigate} />}
        {view === 'students' && <StudentsView students={students} setStudents={setStudents} reload={reload} toast={toast} />}
        {view === 'records' && <AttendanceView mode="log" students={students} attendance={attendance} setAttendance={setAttendance} reload={reload} />}
        {view === 'attendance-records' && <AttendanceView mode="history" students={students} />}
        {view === 'settings' && <SettingsView dashboard={dashboard} setDashboard={setDashboard} timings={timings} setTimings={setTimings} toast={toast} />}
      </>}
    </main>
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{nav.map(({ id, path, icon, label }) => <button key={id} type="button" className={location.pathname === path ? 'active' : ''} aria-current={location.pathname === path ? 'page' : undefined} onClick={() => navigate(path)}><span aria-hidden="true">{icon}</span><small>{label === 'Attendance Records' ? 'Records' : label}</small></button>)}</nav>
  </div>;
}

function Dashboard({ dashboard, students, attendance, rate, present, late, navigate, startTodayClass, startingSession, sessionActive }) {
  const recent = attendance.filter((record) => record.status !== 'Absent').slice(0, 4);
  const title = [dashboard.courseLabel, dashboard.sessionLabel].filter(Boolean).join(' ');
  const meta = [dashboard.yearLabel, dashboard.semesterLabel].filter(Boolean).join(' · ');
  return <><section className="hero-grid"><article className="welcome-card"><div><p className="eyebrow">CURRENT SESSION</p><h2>{title || 'Current session'}</h2><p className="muted">{meta}</p><button className="secondary-btn" type="button" disabled={startingSession || sessionActive} onClick={startTodayClass}>{sessionActive ? 'Class active ✓' : startingSession ? 'Starting class…' : 'Start today’s class →'}</button></div><div className="orbital"><span className="orb one" /><span className="orb two" /><span className="orb three" /><span className="scan-glyph">⌁</span></div></article><article className="quick-card"><div className="quick-head"><span className="icon-tile">◎</span><span className="pill">Today</span></div><strong>{rate}%</strong><p>attendance rate</p><div className="progress"><span style={{ width: `${rate}%` }} /></div><small>{present + late} of {students.length} students checked in</small></article></section>
  <div className="stat-grid"><Stat icon="♙" type="indigo" value={students.length} label="Total students" extra={`+${students.length} added`} /><Stat icon="✓" type="teal" value={present} label="Present today" extra="● On track" /><Stat icon="◷" type="coral" value={late} label="Late check-ins" extra="After present-until" /></div>
  <div className="content-grid"><section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow">LIVE FEED</p><h2>Recent check-ins</h2></div><button className="text-btn" onClick={() => navigate('/attendance')}>View all <span>→</span></button></div><div className="checkin-list">{recent.length ? recent.map((record) => <div className="checkin-row" key={record.id}><span className="student-avatar">{initials(record.name || 'S')}</span><div className="checkin-main"><strong>{record.name || 'Student'}</strong><small>{record.roll || ''}</small></div><span className="checkin-time">{record.time}</span><span className={`status ${record.status.toLowerCase()}`}>{record.status}</span></div>) : <div className="empty-state"><h3>Ready for your first scan</h3><p>Check-ins will appear here live.</p></div>}</div></section><section className="panel code-panel"><div className="panel-heading"><div><p className="eyebrow">QUICK ACTION</p><h2>Student QR cards</h2></div></div><p>Give every student their secure QR code for a fast, touch-free check-in.</p><button className="secondary-btn" onClick={() => navigate('/students')}>Manage students →</button><div className="mini-qr" /></section></div></>;
}
function Stat({ icon, type, value, label, extra }) { return <article className="stat-card"><span className={`stat-icon ${type}`}>{icon}</span><div><strong>{value}</strong><p>{label}</p></div><span className="stat-trend">{extra}</span></article>; }
