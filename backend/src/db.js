import mysql from 'mysql2/promise';
import 'dotenv/config';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'qr_attendance',
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true
});

export async function verifyDatabase() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    await connection.execute(`CREATE TABLE IF NOT EXISTS daily_class_sessions (
      id CHAR(36) NOT NULL PRIMARY KEY,
      teacher_id CHAR(36) NOT NULL,
      course VARCHAR(160) NOT NULL,
      section VARCHAR(20) NOT NULL DEFAULT 'General',
      session_date DATE NOT NULL,
      status ENUM('Active', 'Ended') NOT NULL DEFAULT 'Active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_daily_class_session (session_date, course, section),
      INDEX idx_session_date (session_date)
    )`);
  } finally { connection.release(); }
}
