import { useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { escapeCsv, formatDate, localDate } from '../utils/format.js';

export default function AttendanceView({ mode, students, attendance, setAttendance, reload }) {
  return mode === 'history' ? <History students={students} /> : <Log students={students} attendance={attendance} setAttendance={setAttendance} reload={reload} />;
}
function Log({ students = [], attendance = [], setAttendance, reload }) {
  const [date, setDate] = useState(localDate);
  const [status, setStatus] = useState('');
  const [section, setSection] = useState('');
  const [search, setSearch] = useState('');
  const sections = useMemo(() => {
    const fromAttendance = (attendance || []).map((row) => row.section);
    const fromStudents = (students || []).map((s) => s.section);
    return [...new Set([...fromAttendance, ...fromStudents].filter(Boolean))].sort();
  }, [attendance, students]);
  const rows = useMemo(() => {
    return attendance
      .filter((row) => (!date || row.date === date))
      .filter((row) => (!status || row.status === status))
      .filter((row) => (!section || (row.section || '') === section))
      .filter((row) => (!search || `${row.name || ''} ${row.roll || ''}`.toLowerCase().includes(search.toLowerCase())));
  }, [attendance, date, status, section, search]);
  async function changeDate(value) { setDate(value); const data = await api.attendance(value); setAttendance(data); }
  function exportCsv() { const csv = ['Student,Roll number,Course,Section,Date,Check-in time,Status', ...rows.map((row) => [row.name || '', row.roll || '', row.course || '', row.section || '', row.date, row.time, row.status].map(escapeCsv).join(','))].join('\n'); const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `attendly-${date}.csv`; link.click(); URL.revokeObjectURL(link.href); }
  return <section><div className="page-heading"><div><p className="eyebrow">REGISTER</p><h2>Attendance log</h2><p className="muted">A complete record of your student check-ins.</p></div><button className="primary-btn" onClick={exportCsv}>⇩ Export CSV</button></div><div className="toolbar"><label className="field-label">Date<input type="date" value={date} onChange={(event) => changeDate(event.target.value)} /></label><select value={section} onChange={(event) => setSection(event.target.value)}><option value="">All sections</option>{sections.map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option>Present</option><option>Late</option><option>Absent</option></select><label className="search-box">⌕ <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student" /></label></div><section className="panel table-panel"><table><thead><tr><th>No.</th><th>Student</th><th>Roll no.</th><th>Section</th><th>Date</th><th>Check-in time</th><th>Status</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{row.name || 'Student'}</td><td>{row.roll || '—'}</td><td>{row.section || '—'}</td><td>{formatDate(row.date)}</td><td>{row.time}</td><td><span className={`status ${row.status.toLowerCase()}`}>{row.status}</span></td></tr>)}</tbody></table>{!rows.length && <div className="empty-state"><span>▤</span><h3>No attendance records</h3><p>Scan a student QR code to begin.</p></div>}</section></section>;
}
function History({ students }) {
  const [studentId, setStudentId] = useState(''); const [data, setData] = useState(null); const [fromDate, setFromDate] = useState(''); const [toDate, setToDate] = useState(''); const [search, setSearch] = useState('');
  const visibleStudents = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return students;
    return students.filter((student) => `${student.name} ${student.roll}`.toLowerCase().includes(value));
  }, [students, search]);
  async function fetchHistory(id = studentId) { if (!id) return; setStudentId(id); try { setData(await api.studentRecords({ studentId: id, fromDate, toDate })); } catch { setData(null); } }
  function updateSearch(value) {
    setSearch(value);
    const matches = students.filter((student) => `${student.name} ${student.roll}`.toLowerCase().includes(value.trim().toLowerCase()));
    if (value.trim() && matches.length === 1) fetchHistory(matches[0].id);
  }
  function resetFilters() { setStudentId(''); setSearch(''); setFromDate(''); setToDate(''); setData(null); }
  const summary = data?.summary;
  return <section><div className="page-heading"><div><p className="eyebrow">STUDENT HISTORY</p><h2>Attendance Records</h2><p className="muted">View complete date-wise attendance history and summary for any student.</p></div></div><div className="toolbar att-record-toolbar"><select value={studentId} onChange={(event) => fetchHistory(event.target.value)}><option value="">Select Student (Name / Roll No)</option>{visibleStudents.map((student) => <option key={student.id} value={student.id}>{student.name} ({student.roll} - {student.course})</option>)}</select><label className="search-box">⌕ <input value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Search student name or roll number..." /></label><label className="field-label">Date From<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label className="field-label">Date To<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label><button className="outline-btn" type="button" onClick={resetFilters}>Reset filters</button><button className="primary-btn" type="button" disabled={!studentId} onClick={() => fetchHistory()}>Apply filters</button></div>{search.trim() && visibleStudents.length > 1 && <p className="muted" style={{ margin: '-6px 0 16px' }}>{visibleStudents.length} matching students — choose one from the dropdown.</p>}{data?.student && <><div className="panel" style={{ padding: '18px 24px', marginBottom: 20 }}><h3 style={{ margin: '0 0 4px', fontSize: 18, letterSpacing: '-0.4px' }}>{data.student.name}</h3><p className="muted" style={{ margin: 0, fontSize: 12 }}>Roll: {data.student.roll} · Course: {data.student.course} · Section: {data.student.section}</p></div><div className="stat-grid attendance-summary"><Summary icon="📅" type="indigo" value={summary.totalClasses} label="Total Classes" /><Summary icon="✓" type="teal" value={summary.present} label="Present" /><Summary icon="◷" type="coral" value={summary.late} label="Late" /><Summary icon="✕" type="rose" value={summary.absent} label="Absent" /><Summary icon="%" type="purple" value={`${summary.attendancePercentage}%`} label="Attendance %" /></div></>}<section className="panel table-panel"><table><thead><tr><th>No.</th><th>Date</th><th>Day</th><th>Check-in Time</th><th>Status</th></tr></thead><tbody>{data?.records?.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{formatDate(row.date)}</td><td>{row.day}</td><td>{row.time}</td><td><span className={`status ${row.status.toLowerCase()}`}>{row.status}</span></td></tr>)}</tbody></table>{(!data || !data.records?.length) && <div className="empty-state"><span>📋</span><h3>{studentId ? 'No attendance records' : 'Select a student'}</h3><p>{studentId ? 'No records found for this student in the selected date range.' : 'Search by student name or roll number, then select the student.'}</p></div>}</section></section>;
}
function Summary({ icon, type, value, label }) { return <article className="stat-card"><span className={`stat-icon ${type}`}>{icon}</span><div><strong>{value}</strong><p>{label}</p></div></article>; }
