import { pool } from './db.js';

try {
  await pool.execute(`CREATE TABLE IF NOT EXISTS teachers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    username VARCHAR(40) NOT NULL UNIQUE,
    email VARCHAR(160) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const [usernameColumns] = await pool.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teachers' AND COLUMN_NAME = 'username'`);
  if (!usernameColumns.length) await pool.execute('ALTER TABLE teachers ADD COLUMN username VARCHAR(40) NULL AFTER name');

  const [teachers] = await pool.query('SELECT id, email, username FROM teachers ORDER BY created_at');
  const usedUsernames = new Set(teachers.map((teacher) => String(teacher.username || '').toLowerCase()).filter(Boolean));
  for (const teacher of teachers.filter((entry) => !entry.username)) {
    const base = (String(teacher.email || 'teacher').split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 34) || 'teacher');
    let username = base;
    let suffix = 2;
    while (usedUsernames.has(username)) username = `${base.slice(0, 34)}_${suffix++}`;
    usedUsernames.add(username);
    await pool.execute('UPDATE teachers SET username = ? WHERE id = ?', [username, teacher.id]);
  }
  await pool.execute('ALTER TABLE teachers MODIFY username VARCHAR(40) NOT NULL');
  const [usernameIndex] = await pool.query(`SELECT INDEX_NAME FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teachers' AND COLUMN_NAME = 'username' AND NON_UNIQUE = 0`);
  if (!usernameIndex.length) await pool.execute('CREATE UNIQUE INDEX unique_teacher_username ON teachers (username)');

  const [columns] = await pool.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'teacher_id'`);
  if (!columns.length) {
    await pool.execute('ALTER TABLE students ADD COLUMN teacher_id CHAR(36) NULL AFTER id');
    await pool.execute('CREATE INDEX idx_students_teacher ON students (teacher_id)');
  }

  const [sectionColumns] = await pool.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'section'`);
  if (!sectionColumns.length) {
    await pool.execute("ALTER TABLE students ADD COLUMN section VARCHAR(20) NOT NULL DEFAULT 'General' AFTER course");
  }

  await pool.execute(`CREATE TABLE IF NOT EXISTS class_attendance_settings (
    id CHAR(36) NOT NULL PRIMARY KEY,
    teacher_id CHAR(36) NOT NULL,
    course VARCHAR(160) NOT NULL,
    start_time TIME NOT NULL,
    present_until TIME NOT NULL,
    end_time TIME NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_teacher_course (teacher_id, course)
  )`);

  console.log('Teacher username, section, and attendance timing migration completed.');
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
