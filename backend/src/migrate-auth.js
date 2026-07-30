import { pool } from './db.js';

try {
  await pool.execute(`CREATE TABLE IF NOT EXISTS teachers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

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

  console.log('Teacher authentication and section migration completed.');
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
