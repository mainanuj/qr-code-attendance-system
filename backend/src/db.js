import mysql from 'mysql2/promise';
import 'dotenv/config';

const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = Number(process.env.DB_PORT || 3306);
const dbName = process.env.DB_NAME || 'qr_attendance';
const dbSslRequested = ['1', 'true', 'yes', 'required'].includes(String(process.env.DB_SSL || '').trim().toLowerCase());
const isTiDBCloudHost = /(^|\.)tidbcloud\.com$/i.test(dbHost);
const useSsl = dbSslRequested || isTiDBCloudHost;
const sslCa = String(process.env.DB_SSL_CA || '').replace(/\\n/g, '\n').trim();

function safeErrorMessage(error) {
  return String(error?.message || 'Unknown database error')
    .replace(/(password\s*[=:]\s*)[^\s,;]+/gi, '$1[redacted]')
    .replace(/(mysqls?:\/\/[^:\/\s]+:)[^@\/\s]+@/gi, '$1[redacted]@')
    .slice(0, 1000);
}

export function databaseFailureDetails(error) {
  return {
    code: error?.code || null,
    errno: error?.errno ?? null,
    sqlState: error?.sqlState || null,
    message: safeErrorMessage(error),
    host: dbHost,
    port: dbPort,
    database: dbName,
    sslEnabled: useSsl,
    sslAutomaticallyEnabledForTiDB: isTiDBCloudHost,
    sslCaConfigured: Boolean(sslCa)
  };
}

export const pool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: dbName,
  // Local MySQL keeps its current non-SSL connection. Set DB_SSL=true on
  // Render for TiDB Cloud's public endpoint.
  ...(useSsl ? {
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      ...(sslCa ? { ca: sslCa } : {})
    }
  } : {}),
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

    // Migrate roll_number unique index from global to composite (teacher_id, roll_number)
    const [rollIndexes] = await connection.query(`
      SELECT INDEX_NAME FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students'
        AND COLUMN_NAME = 'roll_number' AND NON_UNIQUE = 0
        AND INDEX_NAME != 'unique_teacher_student_roll'
    `);
    for (const row of rollIndexes) {
      await connection.query(`ALTER TABLE students DROP INDEX \`${row.INDEX_NAME}\``);
    }
    const [teacherRollIndex] = await connection.query(`
      SELECT INDEX_NAME FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students'
        AND INDEX_NAME = 'unique_teacher_student_roll'
    `);
    if (!teacherRollIndex.length) {
      await connection.query('CREATE UNIQUE INDEX unique_teacher_student_roll ON students (teacher_id, roll_number)');
    }
  } finally { connection.release(); }
}
