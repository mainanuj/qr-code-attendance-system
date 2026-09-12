import crypto from 'node:crypto';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { databaseFailureDetails, pool, verifyDatabase } from './db.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5000);
const jwtSecret = process.env.JWT_SECRET || 'local-development-secret-change-before-deploying';
if (!process.env.JWT_SECRET) console.warn('JWT_SECRET is not set. Add one to backend/.env before deployment.');
const corsOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

app.use(cors({ origin: corsOrigins.length ? corsOrigins : true }));
app.use(express.json());

const studentFields = 'id, name, roll_number AS roll, course, section, qr_token AS token, created_at AS createdAt';
const attendanceFields = `a.id, a.student_id AS studentId, s.name AS name, s.roll_number AS roll, s.course AS course,
  DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS date, TIME_FORMAT(a.check_in_time, '%h:%i %p') AS time,
  a.status, s.section AS section, UNIX_TIMESTAMP(a.created_at) * 1000 AS createdAt`;

function makeToken() { return `ATD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`; }
function validText(value, limit) { return typeof value === 'string' && value.trim() && value.trim().length <= limit; }
function validUsername(value) { return typeof value === 'string' && /^[a-z0-9_.-]{3,40}$/i.test(value.trim()); }
function isValidTime(value) { return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value); }
function timeToSeconds(value) { const [hours, minutes, seconds = 0] = value.split(':').map(Number); return hours * 3600 + minutes * 60 + seconds; }
const attendanceClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

function attendanceNow(now = new Date()) {
  const parts = Object.fromEntries(
    attendanceClock.formatToParts(now)
      .filter(({ type }) => ['year', 'month', 'day', 'hour', 'minute', 'second'].includes(type))
      .map(({ type, value }) => [type, Number(value)])
  );
  const pad = (value) => String(value).padStart(2, '0');
  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`,
    seconds: parts.hour * 3600 + parts.minute * 60 + parts.second
  };
}

function calculateAttendanceStatus(setting, now = attendanceNow().seconds) {
  const start = timeToSeconds(setting.startTime);
  const presentUntil = timeToSeconds(setting.presentUntil);
  const end = timeToSeconds(setting.endTime);
  if (now < start) return { allowed: false, error: `Attendance has not started. It opens at ${setting.startTime.slice(0, 5)}.` };
  if (now > end) return { allowed: false, error: `Attendance is closed. It ended at ${setting.endTime.slice(0, 5)}.` };
  return { allowed: true, status: now <= presentUntil ? 'Present' : 'Late' };
}

function normalizedHeader(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''); }
function findHeader(headers, names) { return headers.find((header) => names.includes(normalizedHeader(header))); }

function createSession(teacher) {
  return jwt.sign({ teacherId: teacher.id, name: teacher.name, username: teacher.username, email: teacher.email }, jwtSecret, { expiresIn: '8h' });
}

function authenticate(request, response, next) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) { response.status(401).json({ error: 'Please log in first.' }); return; }
  try { request.teacher = jwt.verify(token, jwtSecret); next(); }
  catch { response.status(401).json({ error: 'Your session expired. Please log in again.' }); }
}

app.get('/api/health', async (_request, response) => {
  try { await verifyDatabase(); response.json({ ok: true, database: 'connected' }); }
  catch { response.status(503).json({ ok: false, database: 'unavailable' }); }
});

app.get('/api/public/summary', async (_request, response, next) => {
  try {
    const now = attendanceNow();
    const [[studentCount]] = await pool.query('SELECT COUNT(*) AS totalStudents FROM students');
    const [[todayStats]] = await pool.query(`SELECT
      COUNT(*) AS checkedIn,
      SUM(status = 'Present') AS presentToday,
      SUM(status = 'Late') AS lateCheckins
      FROM attendance WHERE attendance_date = ?`, [now.date]);
    const totalStudents = Number(studentCount.totalStudents || 0);
    const checkedIn = Number(todayStats.checkedIn || 0);
    response.json({
      totalStudents,
      presentToday: Number(todayStats.presentToday || 0),
      lateCheckins: Number(todayStats.lateCheckins || 0),
      attendanceRate: totalStudents ? Math.round((checkedIn / totalStudents) * 100) : 0,
      checkedIn
    });
  } catch (error) { next(error); }
});

app.get('/api/public/session-status', async (_request, response, next) => {
  try {
    const now = attendanceNow();
    const [rows] = await pool.query(`SELECT id, teacher_id AS teacherId, course, section, DATE_FORMAT(session_date, '%Y-%m-%d') AS date, status
      FROM daily_class_sessions WHERE session_date = ? AND status = 'Active'`, [now.date]);
    const token = _request.headers.authorization?.replace(/^Bearer\s+/i, '');
    let teacherId = null;
    try { if (token) teacherId = jwt.verify(token, jwtSecret).teacherId; } catch { /* Public status remains available without a valid login. */ }
    response.json({
      active: rows.length > 0,
      teacherActive: teacherId ? rows.some((row) => row.teacherId === teacherId) : null,
      sessions: rows
    });
  } catch (error) { next(error); }
});

app.post('/api/public/check-in', async (request, response, next) => {
  const code = String(request.body?.code || '').trim();
  if (!code) { response.status(400).json({ error: 'QR token or roll number is required.' }); return; }
  try {
    const now = attendanceNow();
    let student = null;
    const [byToken] = await pool.execute(`SELECT teacher_id AS teacherId, ${studentFields}
      FROM students WHERE qr_token = ? LIMIT 1`, [code]);
    if (byToken.length) {
      student = byToken[0];
    } else {
      const [byRoll] = await pool.execute(`SELECT teacher_id AS teacherId, ${studentFields}
        FROM students WHERE roll_number = ?`, [code]);
      if (byRoll.length === 1) {
        student = byRoll[0];
      } else if (byRoll.length > 1) {
        const [activeSessions] = await pool.execute(`SELECT teacher_id, course, section FROM daily_class_sessions
          WHERE session_date = ? AND status = 'Active'`, [now.date]);
        student = byRoll.find((s) =>
          activeSessions.some((session) =>
            session.teacher_id === s.teacherId &&
            session.course === s.course &&
            (session.section === s.section || session.section === 'General')
          )
        ) || byRoll[0];
      }
    }
    if (!student) { response.status(404).json({ error: 'No student matches this QR token or roll number.' }); return; }
    
    const [activeSessions] = await pool.execute(`SELECT id FROM daily_class_sessions
      WHERE teacher_id = ? AND session_date = ? AND course = ?
        AND (section = ? OR section = 'General') AND status = 'Active' LIMIT 1`,
    [student.teacherId, now.date, student.course, student.section || 'General']);
    if (!activeSessions.length) {
      response.status(409).json({ error: `Today's class session for ${student.course} has not been started yet. Click "Start Today's Class" to begin.` });
      return;
    }

    const [settings] = await pool.execute(`SELECT TIME_FORMAT(start_time, '%H:%i:%s') AS startTime,
      TIME_FORMAT(present_until, '%H:%i:%s') AS presentUntil, TIME_FORMAT(end_time, '%H:%i:%s') AS endTime
      FROM class_attendance_settings WHERE teacher_id = ? AND course = ? LIMIT 1`, [student.teacherId, student.course]);
    if (!settings.length) { response.status(409).json({ error: `Attendance timing is not configured for ${student.course}.` }); return; }
    const timing = calculateAttendanceStatus(settings[0], now.seconds);
    if (!timing.allowed) { response.status(409).json({ error: timing.error }); return; }
    const record = { id: crypto.randomUUID(), studentId: student.id, status: timing.status };
    await pool.execute('INSERT INTO attendance (id, student_id, attendance_date, check_in_time, status) VALUES (?, ?, ?, ?, ?)', [record.id, record.studentId, now.date, now.time, record.status]);
    const [records] = await pool.execute(`SELECT ${attendanceFields} FROM attendance a JOIN students s ON s.id = a.student_id WHERE a.id = ?`, [record.id]);
    Object.assign(record, records[0]);
    response.status(201).json({ record, student: { name: student.name, course: student.course, section: student.section } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') { response.status(409).json({ error: 'This student is already marked today.' }); return; }
    next(error);
  }
});

app.post('/api/auth/register', async (request, response, next) => {
  const { name, username, email, password } = request.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
  if (!validText(name, 120) || !validUsername(normalizedUsername) || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || typeof password !== 'string' || password.length < 6) {
    response.status(400).json({ error: 'Enter a name, unique username (3-40 letters, numbers, ., _, -), valid email, and password of at least 6 characters.' });
    return;
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute('SELECT id FROM teachers WHERE email = ? OR username = ? LIMIT 1', [normalizedEmail, normalizedUsername]);
    if (existing.length) { await connection.rollback(); response.status(409).json({ error: 'This email or username is already in use.' }); return; }
    const [teacherCount] = await connection.query('SELECT COUNT(*) AS count FROM teachers');
    const teacher = { id: crypto.randomUUID(), name: name.trim(), username: normalizedUsername, email: normalizedEmail };
    const passwordHash = await bcrypt.hash(password, 12);
    await connection.execute('INSERT INTO teachers (id, name, username, email, password_hash) VALUES (?, ?, ?, ?, ?)', [teacher.id, teacher.name, teacher.username, teacher.email, passwordHash]);
    if (teacherCount[0].count === 0) await connection.execute(`UPDATE students s
      LEFT JOIN teachers previous_teacher ON previous_teacher.id = s.teacher_id
      SET s.teacher_id = ?
      WHERE s.teacher_id IS NULL OR previous_teacher.id IS NULL`, [teacher.id]);
    await connection.commit();
    response.status(201).json({ teacher, token: createSession(teacher) });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
});

app.post('/api/auth/login', async (request, response, next) => {
  const username = typeof request.body?.username === 'string' ? request.body.username.trim().toLowerCase() : '';
  const password = request.body?.password;
  try {
    const [rows] = await pool.execute('SELECT id, name, username, email, password_hash FROM teachers WHERE username = ? LIMIT 1', [username]);
    const teacher = rows[0];
    if (!teacher || typeof password !== 'string' || !(await bcrypt.compare(password, teacher.password_hash))) {
      response.status(401).json({ error: 'Incorrect email or password.' });
      return;
    }
    response.json({ teacher: { id: teacher.id, name: teacher.name, username: teacher.username, email: teacher.email }, token: createSession(teacher) });
  } catch (error) { next(error); }
});

app.get('/api/auth/me', authenticate, (request, response) => response.json({ teacher: request.teacher }));

app.use('/api/students', authenticate);
app.use('/api/attendance', authenticate);
app.use('/api/classes', authenticate);

app.get('/api/classes/dashboard-settings', async (request, response, next) => {
  try {
    const [[settings]] = await pool.execute(`SELECT course_label AS courseLabel, session_label AS sessionLabel,
      year_label AS yearLabel, semester_label AS semesterLabel
      FROM teacher_dashboard_settings WHERE teacher_id = ? LIMIT 1`, [request.teacher.teacherId]);
    if (settings) { response.json(settings); return; }
    response.json({ courseLabel: '', sessionLabel: '', yearLabel: '', semesterLabel: '' });
  } catch (error) { next(error); }
});

app.put('/api/classes/dashboard-settings', async (request, response, next) => {
  const { courseLabel, sessionLabel, yearLabel, semesterLabel } = request.body || {};
  if (!validText(courseLabel, 160) || !validText(sessionLabel, 80) || !validText(yearLabel, 80) || !validText(semesterLabel, 80)) {
    response.status(400).json({ error: 'Course, session, year, and semester are all required.' });
    return;
  }
  try {
    await pool.execute(`INSERT INTO teacher_dashboard_settings (teacher_id, course_label, session_label, year_label, semester_label)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE course_label = VALUES(course_label), session_label = VALUES(session_label),
        year_label = VALUES(year_label), semester_label = VALUES(semester_label)`,
    [request.teacher.teacherId, courseLabel.trim(), sessionLabel.trim(), yearLabel.trim(), semesterLabel.trim()]);
    response.json({ courseLabel: courseLabel.trim(), sessionLabel: sessionLabel.trim(), yearLabel: yearLabel.trim(), semesterLabel: semesterLabel.trim() });
  } catch (error) { next(error); }
});

app.get('/api/classes/attendance-settings', async (request, response, next) => {
  try {
    const [rows] = await pool.execute(`SELECT courses.course,
      TIME_FORMAT(settings.start_time, '%H:%i') AS startTime,
      TIME_FORMAT(settings.present_until, '%H:%i') AS presentUntil,
      TIME_FORMAT(settings.end_time, '%H:%i') AS endTime
      FROM (SELECT DISTINCT course FROM students WHERE teacher_id = ?) courses
      LEFT JOIN class_attendance_settings settings
        ON settings.teacher_id = ? AND settings.course = courses.course
      ORDER BY courses.course`, [request.teacher.teacherId, request.teacher.teacherId]);
    response.json(rows);
  } catch (error) { next(error); }
});

app.put('/api/classes/attendance-settings', async (request, response, next) => {
  const { course, startTime, presentUntil, endTime } = request.body || {};
  if (!validText(course, 160) || !isValidTime(startTime) || !isValidTime(presentUntil) || !isValidTime(endTime)) {
    response.status(400).json({ error: 'Course and all three valid times are required.' });
    return;
  }
  if (!(timeToSeconds(startTime) < timeToSeconds(presentUntil) && timeToSeconds(presentUntil) < timeToSeconds(endTime))) {
    response.status(400).json({ error: 'Start Time must be before Present Until, which must be before End Time.' });
    return;
  }
  try {
    const [courses] = await pool.execute('SELECT 1 FROM students WHERE teacher_id = ? AND course = ? LIMIT 1', [request.teacher.teacherId, course.trim()]);
    if (!courses.length) { response.status(404).json({ error: 'This class does not belong to your dashboard.' }); return; }
    await pool.execute(`INSERT INTO class_attendance_settings (id, teacher_id, course, start_time, present_until, end_time)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), present_until = VALUES(present_until), end_time = VALUES(end_time)`,
    [crypto.randomUUID(), request.teacher.teacherId, course.trim(), startTime, presentUntil, endTime]);
    response.json({ course: course.trim(), startTime, presentUntil, endTime });
  } catch (error) { next(error); }
});

app.post('/api/classes/start-session', async (request, response, next) => {
  try {
    const now = attendanceNow();
    const teacherId = request.teacher.teacherId;
    let course = String(request.body?.course || '').trim();
    let section = String(request.body?.section || '').trim();
    if (!course) {
      const [[dashSettings]] = await pool.execute('SELECT course_label FROM teacher_dashboard_settings WHERE teacher_id = ? LIMIT 1', [teacherId]);
      course = dashSettings?.course_label || '';
    }
    if (!course) {
      const [[firstStudent]] = await pool.execute('SELECT course, section FROM students WHERE teacher_id = ? ORDER BY created_at LIMIT 1', [teacherId]);
      course = firstStudent?.course || 'General Class';
      if (!section) section = firstStudent?.section || 'General';
    }
    if (!section) section = 'General';

    const [allCourses] = await pool.execute('SELECT DISTINCT course, section FROM students WHERE teacher_id = ?', [teacherId]);
    const targetCourses = allCourses.length ? allCourses : [{ course, section }];

    for (const target of targetCourses) {
      await pool.execute(`INSERT INTO daily_class_sessions (id, teacher_id, course, section, session_date, status)
        VALUES (?, ?, ?, ?, ?, 'Active')
        ON DUPLICATE KEY UPDATE status = 'Active'`, [crypto.randomUUID(), teacherId, target.course, target.section || 'General', now.date]);
    }

    const [sessions] = await pool.execute(`SELECT id, teacher_id AS teacherId, course, section, DATE_FORMAT(session_date, '%Y-%m-%d') AS date, status
      FROM daily_class_sessions WHERE session_date = ? AND teacher_id = ?`, [now.date, teacherId]);

    response.json({ ok: true, message: "Today's class session started successfully!", sessions });
  } catch (error) { next(error); }
});

app.get('/api/students', async (request, response, next) => {
  try {
    const query = String(request.query.q || '').trim();
    const course = String(request.query.course || '').trim();
    const section = String(request.query.section || '').trim();
    const [rows] = await pool.query(`SELECT ${studentFields} FROM students
      WHERE teacher_id = :teacherId
        AND (:query = '' OR name LIKE CONCAT('%', :query, '%') OR roll_number LIKE CONCAT('%', :query, '%'))
        AND (:course = '' OR course = :course)
        AND (:section = '' OR section = :section)
      ORDER BY name`, { query, course, section, teacherId: request.teacher.teacherId });
    response.json(rows);
  } catch (error) { next(error); }
});

app.post('/api/students', async (request, response, next) => {
  const { name, roll, course, section } = request.body || {};
  if (!validText(name, 120) || !validText(roll, 60) || !validText(course, 160) || !validText(section, 20)) {
    response.status(400).json({ error: 'Name, roll number, course, and section are required.' });
    return;
  }
  const student = { id: crypto.randomUUID(), name: name.trim(), roll: roll.trim(), course: course.trim(), section: section.trim(), token: makeToken() };
  try {
    const [[existing]] = await pool.execute('SELECT 1 FROM students WHERE teacher_id = ? AND roll_number = ? LIMIT 1', [request.teacher.teacherId, student.roll]);
    if (existing) { response.status(409).json({ error: 'This roll number already exists.' }); return; }
    await pool.execute('INSERT INTO students (id, teacher_id, name, roll_number, course, section, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?)', [student.id, request.teacher.teacherId, student.name, student.roll, student.course, student.section, student.token]);
    response.status(201).json(student);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') { response.status(409).json({ error: 'This roll number already exists.' }); return; }
    next(error);
  }
});

app.post('/api/students/import', importUpload.single('file'), async (request, response, next) => {
  const file = request.file;
  if (!file) { response.status(400).json({ error: 'Choose a CSV or Excel (.xlsx) file first.' }); return; }
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (!['.csv', '.xlsx'].includes(extension)) { response.status(400).json({ error: 'Only CSV and Excel (.xlsx) files are supported.' }); return; }
  try {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
    if (!rows.length) { response.status(400).json({ error: 'The selected file has no student rows.' }); return; }
    const headers = Object.keys(rows[0]);
    const columnMap = {
      roll: findHeader(headers, ['rollnumber', 'rollno', 'roll']),
      name: findHeader(headers, ['name', 'studentname']),
      course: findHeader(headers, ['course', 'class', 'program']),
      section: findHeader(headers, ['section', 'sec'])
    };
    const missingColumns = Object.entries(columnMap).filter(([, header]) => !header).map(([field]) => ({ roll: 'Roll Number', name: 'Name', course: 'Course', section: 'Section' }[field]));
    if (missingColumns.length) { response.status(400).json({ error: `Missing required column header(s): ${missingColumns.join(', ')}.` }); return; }

    const preparedRows = rows.map((row, index) => ({
      rowNumber: index + 2,
      name: String(row[columnMap.name] || '').trim(),
      roll: String(row[columnMap.roll] || '').trim(),
      course: String(row[columnMap.course] || '').trim(),
      section: String(row[columnMap.section] || '').trim()
    })).filter((row) => row.name || row.roll || row.course || row.section);
    if (!preparedRows.length) { response.status(400).json({ error: 'The selected file has no student rows.' }); return; }

    const rolls = [...new Set(preparedRows.map((row) => row.roll).filter(Boolean))];
    const existingRolls = new Set();
    if (rolls.length) {
      const placeholders = rolls.map(() => '?').join(', ');
      const [existingStudents] = await pool.execute(`SELECT roll_number FROM students WHERE teacher_id = ? AND roll_number IN (${placeholders})`, [request.teacher.teacherId, ...rolls]);
      existingStudents.forEach((student) => existingRolls.add(String(student.roll_number).toLowerCase()));
    }

    const summary = { imported: 0, duplicates: 0, errors: 0, messages: [] };
    const seenRolls = new Set();
    for (const row of preparedRows) {
      if (!validText(row.name, 120) || !validText(row.roll, 60) || !validText(row.course, 160) || !validText(row.section, 20)) {
        summary.errors += 1;
        if (summary.messages.length < 10) summary.messages.push(`Row ${row.rowNumber}: Name, Roll Number, Course, and Section are required.`);
        continue;
      }
      const rollKey = row.roll.toLowerCase();
      if (seenRolls.has(rollKey) || existingRolls.has(rollKey)) {
        summary.duplicates += 1;
        if (summary.messages.length < 10) summary.messages.push(`Row ${row.rowNumber}: Roll Number ${row.roll} already exists.`);
        continue;
      }
      seenRolls.add(rollKey);
      try {
        await pool.execute('INSERT INTO students (id, teacher_id, name, roll_number, course, section, qr_token) VALUES (?, ?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), request.teacher.teacherId, row.name, row.roll, row.course, row.section, makeToken()]);
        summary.imported += 1;
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          summary.duplicates += 1;
          existingRolls.add(rollKey);
          if (summary.messages.length < 10) summary.messages.push(`Row ${row.rowNumber}: Roll Number ${row.roll} already exists.`);
        } else {
          summary.errors += 1;
          if (summary.messages.length < 10) summary.messages.push(`Row ${row.rowNumber}: could not be imported.`);
        }
      }
    }
    response.status(201).json(summary);
  } catch (error) { next(error); }
});

app.put('/api/students/:id', async (request, response, next) => {
  const { name, roll, course, section } = request.body || {};
  if (!validText(name, 120) || !validText(roll, 60) || !validText(course, 160) || !validText(section, 20)) {
    response.status(400).json({ error: 'Name, roll number, course, and section are required.' });
    return;
  }
  try {
    const [[existing]] = await pool.execute(
      'SELECT 1 FROM students WHERE teacher_id = ? AND roll_number = ? AND id != ? LIMIT 1',
      [request.teacher.teacherId, roll.trim(), request.params.id]
    );
    if (existing) { response.status(409).json({ error: 'This roll number already exists.' }); return; }
    const [result] = await pool.execute(`UPDATE students
      SET name = ?, roll_number = ?, course = ?, section = ?
      WHERE id = ? AND teacher_id = ?`, [name.trim(), roll.trim(), course.trim(), section.trim(), request.params.id, request.teacher.teacherId]);
    if (!result.affectedRows) { response.status(404).json({ error: 'Student not found.' }); return; }
    const [rows] = await pool.execute(`SELECT ${studentFields} FROM students WHERE id = ? AND teacher_id = ?`, [request.params.id, request.teacher.teacherId]);
    response.json(rows[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') { response.status(409).json({ error: 'This roll number already exists.' }); return; }
    next(error);
  }
});

app.delete('/api/students/:id', async (request, response, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE a FROM attendance a JOIN students s ON s.id = a.student_id WHERE a.student_id = ? AND s.teacher_id = ?', [request.params.id, request.teacher.teacherId]);
    const [result] = await connection.execute('DELETE FROM students WHERE id = ? AND teacher_id = ?', [request.params.id, request.teacher.teacherId]);
    if (!result.affectedRows) {
      await connection.rollback();
      response.status(404).json({ error: 'Student not found.' });
      return;
    }
    await connection.commit();
    response.status(204).end();
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.get('/api/attendance/student-records', async (request, response, next) => {
  try {
    const studentId = String(request.query.studentId || '').trim();
    const query = String(request.query.q || '').trim();
    const fromDate = String(request.query.fromDate || '').trim();
    const toDate = String(request.query.toDate || '').trim();

    let student = null;
    if (studentId) {
      const [students] = await pool.execute(
        `SELECT ${studentFields} FROM students WHERE id = ? AND teacher_id = ? LIMIT 1`,
        [studentId, request.teacher.teacherId]
      );
      student = students[0] || null;
    } else if (query) {
      const [students] = await pool.execute(
        `SELECT ${studentFields} FROM students
         WHERE teacher_id = ? AND (name LIKE CONCAT('%', ?, '%') OR roll_number LIKE CONCAT('%', ?, '%'))
         ORDER BY name LIMIT 1`,
        [request.teacher.teacherId, query, query]
      );
      student = students[0] || null;
    }

    if (!student) {
      response.json({
        student: null,
        summary: { totalClasses: 0, present: 0, late: 0, absent: 0, attendancePercentage: 0, total: 0 },
        records: []
      });
      return;
    }

    const sessionConditions = ['teacher_id = ?', 'course = ?', '(section = ? OR section = \'General\')'];
    const sessionParams = [request.teacher.teacherId, student.course, student.section || 'General'];

    if (fromDate) {
      sessionConditions.push('session_date >= ?');
      sessionParams.push(fromDate);
    }
    if (toDate) {
      sessionConditions.push('session_date <= ?');
      sessionParams.push(toDate);
    }

    const [[sessionRow]] = await pool.execute(
      `SELECT COUNT(DISTINCT session_date) AS totalClasses
       FROM daily_class_sessions
       WHERE ${sessionConditions.join(' AND ')}`,
      sessionParams
    );
    const totalClasses = Number(sessionRow?.totalClasses || 0);

    const conditions = ['a.student_id = ?', 's.teacher_id = ?'];
    const params = [student.id, request.teacher.teacherId];

    if (fromDate) {
      conditions.push('a.attendance_date >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push('a.attendance_date <= ?');
      params.push(toDate);
    }

    const [records] = await pool.execute(
      `SELECT
        a.id,
        a.student_id AS studentId,
        DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS date,
        DAYNAME(a.attendance_date) AS day,
        TIME_FORMAT(a.check_in_time, '%h:%i %p') AS time,
        a.status,
        UNIX_TIMESTAMP(a.created_at) * 1000 AS createdAt
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.attendance_date DESC, a.check_in_time DESC`,
      params
    );

    const present = records.filter(r => r.status === 'Present').length;
    const late = records.filter(r => r.status === 'Late').length;
    const attended = present + late;
    const absent = Math.max(0, totalClasses - attended);
    const attendancePercentage = totalClasses > 0
      ? Math.round((attended / totalClasses) * 100 * 10) / 10
      : 0;

    response.json({
      student,
      summary: {
        totalClasses,
        present,
        late,
        absent,
        attendancePercentage,
        total: totalClasses
      },
      records
    });
  } catch (error) { next(error); }
});

app.get('/api/attendance', async (request, response, next) => {
  try {
    const date = String(request.query.date || '').trim();
    const year = String(request.query.year || '').trim();
    const status = String(request.query.status || '').trim();
    const query = String(request.query.q || '').trim();
    let rows;
    if (date) {
      const conditions = ['s.teacher_id = ?'];
      const values = [date, date, request.teacher.teacherId];
      if (status === 'Absent') conditions.push('a.id IS NULL');
      else if (status) { conditions.push('a.status = ?'); values.push(status); }
      if (query) { conditions.push("(s.name LIKE CONCAT('%', ?, '%') OR s.roll_number LIKE CONCAT('%', ?, '%'))"); values.push(query, query); }
      const [dateRows] = await pool.execute(`SELECT
        COALESCE(a.id, CONCAT('absent-', s.id, '-', ?)) AS id,
        s.id AS studentId,
        s.name AS name,
        s.roll_number AS roll,
        s.course AS course,
        ? AS date,
        COALESCE(TIME_FORMAT(a.check_in_time, '%h:%i %p'), '—') AS time,
        COALESCE(a.status, 'Absent') AS status,
        s.section AS section,
        COALESCE(UNIX_TIMESTAMP(a.created_at) * 1000, 0) AS createdAt
        FROM students s
        LEFT JOIN attendance a ON a.student_id = s.id AND a.attendance_date = ?
        WHERE ${conditions.join(' AND ')}
        ORDER BY s.name`, [date, date, date, request.teacher.teacherId, ...values.slice(3)]);
      rows = dateRows;
    } else {
      const conditions = ['s.teacher_id = ?'];
      const values = [request.teacher.teacherId];
      if (/^\d{4}$/.test(year)) { conditions.push('YEAR(a.attendance_date) = ?'); values.push(Number(year)); }
      if (status) { conditions.push('a.status = ?'); values.push(status); }
      if (query) { conditions.push("(s.name LIKE CONCAT('%', ?, '%') OR s.roll_number LIKE CONCAT('%', ?, '%'))"); values.push(query, query); }
      const [attendanceRows] = await pool.execute(`SELECT ${attendanceFields} FROM attendance a
        JOIN students s ON s.id = a.student_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY a.created_at DESC`, values);
      rows = attendanceRows;
    }
    response.json(rows);
  } catch (error) { next(error); }
});

app.post('/api/attendance/check-in', async (request, response, next) => {
  const code = String(request.body?.code || '').trim();
  if (!code) { response.status(400).json({ error: 'QR token or roll number is required.' }); return; }
  try {
    const now = attendanceNow();
    const [students] = await pool.execute(`SELECT ${studentFields} FROM students WHERE teacher_id = ? AND (qr_token = ? OR roll_number = ?) LIMIT 1`, [request.teacher.teacherId, code, code]);
    const student = students[0];
    if (!student) { response.status(404).json({ error: 'No student matches this QR token or roll number.' }); return; }
    const [settings] = await pool.execute(`SELECT TIME_FORMAT(start_time, '%H:%i:%s') AS startTime,
      TIME_FORMAT(present_until, '%H:%i:%s') AS presentUntil, TIME_FORMAT(end_time, '%H:%i:%s') AS endTime
      FROM class_attendance_settings WHERE teacher_id = ? AND course = ? LIMIT 1`, [request.teacher.teacherId, student.course]);
    if (!settings.length) { response.status(409).json({ error: `Attendance timing is not configured for ${student.course}.` }); return; }
    const timing = calculateAttendanceStatus(settings[0], now.seconds);
    if (!timing.allowed) { response.status(409).json({ error: timing.error }); return; }
    const record = { id: crypto.randomUUID(), studentId: student.id, status: timing.status };
    await pool.execute('INSERT INTO attendance (id, student_id, attendance_date, check_in_time, status) VALUES (?, ?, ?, ?, ?)', [record.id, record.studentId, now.date, now.time, record.status]);
    const [records] = await pool.execute(`SELECT ${attendanceFields} FROM attendance a JOIN students s ON s.id = a.student_id WHERE a.id = ?`, [record.id]);
    Object.assign(record, records[0]);
    response.status(201).json({ record, student });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') { response.status(409).json({ error: 'This student is already marked present today.' }); return; }
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError) { response.status(400).json({ error: 'Upload a single CSV or Excel file smaller than 5 MB.' }); return; }
  response.status(500).json({ error: 'Server error. Check the backend terminal for details.' });
});

app.listen(port, async () => {
  try { await verifyDatabase(); console.log(`Database connected. API server listening on port ${port}.`); }
  catch (error) {
    console.error('Database connection failed at startup:', databaseFailureDetails(error));
    console.log(`API server listening on port ${port}, but MySQL is not connected yet.`);
  }
});
