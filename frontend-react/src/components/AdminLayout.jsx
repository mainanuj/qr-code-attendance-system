import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { dateLabel, initials, localDate } from '../utils/format.js';
import ThemeToggle from './ThemeToggle.jsx';
import StudentsView from './StudentsView.jsx';
import AttendanceView from './AttendanceView.jsx';
import SettingsView from './SettingsView.jsx';

const nav = [['dashboard', '▦', 'Overview'], ['students', '♙', 'Students'], ['records', '▤', 'Attendance log'], ['attendance-records', '📋', 'Attendance Records'], ['settings', '◷', 'Class settings']];

export default function AdminLayout({ session, logout, theme, toggleTheme, toast, openPublicScanner }) {
  const [view, setView] = useState('dashboard');
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [dashboard, setDashboard] = useState({ courseLabel: 'Course', sessionLabel: '2026-27', yearLabel: 'Third Year', semesterLabel: 'Semester 5' });
  const [timings, setTimings] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = localDate();

  const reload = useCallback(async (date = '') => {
    setLoading(true);
    try {
      const [studentRows, attendanceRows, dashboardSettings, timingSettings] = await Promise.all([api.students(), api.attendance(date), api.dashboardSettings(), api.attendanceSettings()]);
      setStudents(studentRows); setAttendance(attendanceRows); setDashboard(dashboardSettings); setTimings(timingSettings);
    } catch (error) { toast(error.message); }
    finally { setLoading(false); }
  }, [toast]);
  // The attendance log must open on today's register, not the entire old
  // attendance history. The date-specific API also creates the Absent rows.
  useEffect(() => { reload(today); }, [reload, today]);
  const todayAttendance = useMemo(() => attendance.filter((item) => item.date === today), [attendance, today]);
  const present = todayAttendance.filter((item) => item.status === 'Present').length;
  const late = todayAttendance.filter((item) => item.status === 'Late').length;
  const rate = students.length ? Math.round(((present + late) / students.length) * 100) : 0;
  const navigate = (next) => { setView(next); if (next === 'settings') api.attendanceSettings().then(setTimings).catch(() => {}); };
  const appTitle = view === 'dashboard' ? `Good morning, ${session.teacher.name} ✦` : ({ students: 'Student roster', records: 'Attendance log', 'attendance-records': 'Attendance Records', settings: 'Class settings' })[view];

  return <div className="app-shell">
    <aside className="sidebar" aria-label="Main navigation"><a className="brand" href="#dashboard"><span className="brand-mark">A</span><span>attendly</span></a><nav className="nav-links">{nav.map(([id, icon, label]) => <button key={id} type="button" className={`nav-link ${view === id ? 'active' : ''}`} onClick={() => navigate(id)}><span>{icon}</span> {label}</button>)}</nav><div className="sidebar-bottom"><div className="teacher-card"><span className="avatar">{initials(session.teacher.name)}</span><div><strong>{session.teacher.name}</strong><small>Instructor</small></div></div><button className="settings-button" type="button" title="Log out" onClick={logout}>↪</button></div></aside>
    <main className="main-content"><header className="topbar"><div><p className="eyebrow">{dateLabel()}</p><h1>{appTitle}</h1></div><div className="top-actions"><ThemeToggle theme={theme} onToggle={toggleTheme} /><button className="icon-button" type="button" title="Notifications">♧<i /></button><button className="primary-btn scan-nav" type="button" onClick={openPublicScanner}>Public scanner <span>↗</span></button></div></header>
      {loading ? <div className="empty-state"><h3>Loading dashboard…</h3></div> : <>
        {view === 'dashboard' && <Dashboard dashboard={dashboard} students={students} attendance={attendance} rate={rate} present={present} late={late} navigate={navigate} />}
        {view === 'students' && <StudentsView students={students} setStudents={setStudents} reload={reload} toast={toast} />}
        {view === 'records' && <AttendanceView mode="log" students={students} attendance={attendance} setAttendance={setAttendance} reload={reload} />}
        {view === 'attendance-records' && <AttendanceView mode="history" students={students} />}
        {view === 'settings' && <SettingsView dashboard={dashboard} setDashboard={setDashboard} timings={timings} setTimings={setTimings} toast={toast} />}
      </>}
    </main>
  </div>;
}

function Dashboard({ dashboard, students, attendance, rate, present, late, navigate }) {
  const recent = attendance.filter((record) => record.status !== 'Absent').slice(0, 4);
  const title = [dashboard.courseLabel, dashboard.sessionLabel].filter(Boolean).join(' ');
  const meta = [dashboard.yearLabel, dashboard.semesterLabel].filter(Boolean).join(' · ');
  return <><section className="hero-grid"><article className="welcome-card"><div><p className="eyebrow">CURRENT SESSION</p><h2>{title || 'Current session'}</h2><p className="muted">{meta}</p><div className="session-meta"><span><b className="dot" /> Live now</span></div></div><div className="orbital"><span className="orb one" /><span className="orb two" /><span className="orb three" /><span className="scan-glyph">⌁</span></div></article><article className="quick-card"><div className="quick-head"><span className="icon-tile">◎</span><span className="pill">Today</span></div><strong>{rate}%</strong><p>attendance rate</p><div className="progress"><span style={{ width: `${rate}%` }} /></div><small>{present + late} of {students.length} students checked in</small></article></section>
  <div className="stat-grid"><Stat icon="♙" type="indigo" value={students.length} label="Total students" extra={`+${students.length} added`} /><Stat icon="✓" type="teal" value={present} label="Present today" extra="● On track" /><Stat icon="◷" type="coral" value={late} label="Late check-ins" extra="After present-until" /></div>
  <div className="content-grid"><section className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow">LIVE FEED</p><h2>Recent check-ins</h2></div><button className="text-btn" onClick={() => navigate('records')}>View all <span>→</span></button></div><div className="checkin-list">{recent.length ? recent.map((record) => <div className="checkin-row" key={record.id}><span className="student-avatar">{initials(record.name || 'S')}</span><div className="checkin-main"><strong>{record.name || 'Student'}</strong><small>{record.roll || ''}</small></div><span className="checkin-time">{record.time}</span><span className={`status ${record.status.toLowerCase()}`}>{record.status}</span></div>) : <div className="empty-state"><h3>Ready for your first scan</h3><p>Check-ins will appear here live.</p></div>}</div></section><section className="panel code-panel"><div className="panel-heading"><div><p className="eyebrow">QUICK ACTION</p><h2>Student QR cards</h2></div></div><p>Give every student their secure QR code for a fast, touch-free check-in.</p><button className="secondary-btn" onClick={() => navigate('students')}>Manage students →</button><div className="mini-qr" /></section></div></>;
}
function Stat({ icon, type, value, label, extra }) { return <article className="stat-card"><span className={`stat-icon ${type}`}>{icon}</span><div><strong>{value}</strong><p>{label}</p></div><span className="stat-trend">{extra}</span></article>; }
