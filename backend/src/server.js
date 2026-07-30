import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool, verifyDatabase } from './db.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5000);
const jwtSecret = process.env.JWT_SECRET || 'local-development-secret-change-before-deploying';
if (!process.env.JWT_SECRET) console.warn('JWT_SECRET is not set. Add one to backend/.env before deployment.');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendPath = path.resolve(__dirname, '../../frontend');

app.use(cors());
app.use(express.json());

const studentFields = 'id, name, roll_number AS roll, course, qr_token AS token, created_at AS createdAt';
const attendanceFields = `a.id, a.student_id AS studentId, DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS date,
  TIME_FORMAT(a.check_in_time, '%h:%i %p') AS time, a.status, UNIX_TIMESTAMP(a.created_at) * 1000 AS createdAt`;

function makeToken() { return `ATD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`; }
function validText(value, limit) { return typeof value === 'string' && value.trim() && value.trim().length <= limit; }
function currentStatus() {
  const [hours, minutes] = (process.env.LATE_AFTER || '09:10').split(':').map(Number);
  const now = new Date();
  return now.getHours() > hours || (now.getHours() === hours && now.getMinutes() > minutes) ? 'Late' : 'Present';
}

function createSession(teacher) {
  return jwt.sign({ teacherId: teacher.id, name: teacher.name, email: teacher.email }, jwtSecret, { expiresIn: '8h' });
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

app.post('/api/auth/register', async (request, response, next) => {
  const { name, email, password } = request.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!validText(name, 120) || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || typeof password !== 'string' || password.length < 6) {
    response.status(400).json({ error: 'Enter a name, valid email, and password of at least 6 characters.' });
    return;
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute('SELECT id FROM teachers WHERE email = ? LIMIT 1', [normalizedEmail]);
    if (existing.length) { await connection.rollback(); response.status(409).json({ error: 'A teacher already uses this email.' }); return; }
    const [teacherCount] = await connection.query('SELECT COUNT(*) AS count FROM teachers');
    const teacher = { id: crypto.randomUUID(), name: name.trim(), email: normalizedEmail };
    const passwordHash = await bcrypt.hash(password, 12);
    await connection.execute('INSERT INTO teachers (id, name, email, password_hash) VALUES (?, ?, ?, ?)', [teacher.id, teacher.name, teacher.email, passwordHash]);
    if (teacherCount[0].count === 0) await connection.execute('UPDATE students SET teacher_id = ? WHERE teacher_id IS NULL', [teacher.id]);
    await connection.commit();
    response.status(201).json({ teacher, token: createSession(teacher) });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
});

app.post('/api/auth/login', async (request, response, next) => {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
  const password = request.body?.password;
  try {
    const [rows] = await pool.execute('SELECT id, name, email, password_hash FROM teachers WHERE email = ? LIMIT 1', [email]);
    const teacher = rows[0];
    if (!teacher || typeof password !== 'string' || !(await bcrypt.compare(password, teacher.password_hash))) {
      response.status(401).json({ error: 'Incorrect email or password.' });
      return;
    }
    response.json({ teacher: { id: teacher.id, name: teacher.name, email: teacher.email }, token: createSession(teacher) });
  } catch (error) { next(error); }
});

app.get('/api/auth/me', authenticate, (request, response) => response.json({ teacher: request.teacher }));

app.use('/api/students', authenticate);
app.use('/api/attendance', authenticate);

app.get('/api/students', async (request, response, next) => {
  try {
    const query = String(request.query.q || '').trim();
    const course = String(request.query.course || '').trim();
    const [rows] = await pool.query(`SELECT ${studentFields} FROM students
      WHERE teacher_id = :teacherId
        AND (:query = '' OR name LIKE CONCAT('%', :query, '%') OR roll_number LIKE CONCAT('%', :query, '%'))
        AND (:course = '' OR course = :course)
      ORDER BY name`, { query, course, teacherId: request.teacher.teacherId });
    response.json(rows);
  } catch (error) { next(error); }
});

app.post('/api/students', async (request, response, next) => {
  const { name, roll, course } = request.body || {};
  if (!validText(name, 120) || !validText(roll, 60) || !validText(course, 160)) {
    response.status(400).json({ error: 'Name, roll number, and course are required.' });
    return;
  }
  const student = { id: crypto.randomUUID(), name: name.trim(), roll: roll.trim(), course: course.trim(), token: makeToken() };
  try {
    await pool.execute('INSERT INTO students (id, teacher_id, name, roll_number, course, qr_token) VALUES (?, ?, ?, ?, ?, ?)', [student.id, request.teacher.teacherId, student.name, student.roll, student.course, student.token]);
    response.status(201).json(student);
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

app.get('/api/attendance', async (request, response, next) => {
  try {
    const date = String(request.query.date || '').trim();
    const year = String(request.query.year || '').trim();
    const status = String(request.query.status || '').trim();
    const query = String(request.query.q || '').trim();
    const conditions = ['s.teacher_id = ?'];
    const values = [request.teacher.teacherId];
    if (date) { conditions.push('a.attendance_date = ?'); values.push(date); }
    if (/^\d{4}$/.test(year)) { conditions.push('YEAR(a.attendance_date) = ?'); values.push(Number(year)); }
    if (status) { conditions.push('a.status = ?'); values.push(status); }
    if (query) { conditions.push("(s.name LIKE CONCAT('%', ?, '%') OR s.roll_number LIKE CONCAT('%', ?, '%'))"); values.push(query, query); }
    const [rows] = await pool.execute(`SELECT ${attendanceFields} FROM attendance a
      JOIN students s ON s.id = a.student_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.created_at DESC`, values);
    response.json(rows);
  } catch (error) { next(error); }
});

app.post('/api/attendance/check-in', async (request, response, next) => {
  const code = String(request.body?.code || '').trim();
  if (!code) { response.status(400).json({ error: 'QR token or roll number is required.' }); return; }
  try {
    const [students] = await pool.execute(`SELECT ${studentFields} FROM students WHERE teacher_id = ? AND (qr_token = ? OR roll_number = ?) LIMIT 1`, [request.teacher.teacherId, code, code]);
    const student = students[0];
    if (!student) { response.status(404).json({ error: 'No student matches this QR token or roll number.' }); return; }
    const record = { id: crypto.randomUUID(), studentId: student.id, status: currentStatus() };
    await pool.execute('INSERT INTO attendance (id, student_id, attendance_date, check_in_time, status) VALUES (?, ?, CURDATE(), CURTIME(), ?)', [record.id, record.studentId, record.status]);
    const [records] = await pool.execute(`SELECT ${attendanceFields} FROM attendance a WHERE a.id = ?`, [record.id]);
    Object.assign(record, records[0]);
    response.status(201).json({ record, student });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') { response.status(409).json({ error: 'This student is already marked present today.' }); return; }
    next(error);
  }
});

app.use(express.static(frontendPath));
app.get(/.*/, (_request, response) => response.sendFile(path.join(frontendPath, 'index.html')));

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Server error. Check the backend terminal for details.' });
});

app.listen(port, async () => {
  try { await verifyDatabase(); console.log(`Database connected. App: http://localhost:${port}`); }
  catch { console.log(`Server started at http://localhost:${port}, but MySQL is not connected yet.`); }
});
