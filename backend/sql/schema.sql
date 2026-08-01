CREATE DATABASE IF NOT EXISTS qr_attendance
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE qr_attendance;

CREATE TABLE IF NOT EXISTS students (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  roll_number VARCHAR(60) NOT NULL UNIQUE,
  course VARCHAR(160) NOT NULL,
  section VARCHAR(20) NOT NULL DEFAULT 'General',
  qr_token VARCHAR(32) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance (
  id CHAR(36) NOT NULL PRIMARY KEY,
  student_id CHAR(36) NOT NULL,
  attendance_date DATE NOT NULL,
  check_in_time TIME NOT NULL,
  status ENUM('Present', 'Late') NOT NULL DEFAULT 'Present',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attendance_student
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  CONSTRAINT unique_daily_attendance UNIQUE (student_id, attendance_date),
  INDEX idx_attendance_date (attendance_date)
);

CREATE TABLE IF NOT EXISTS class_attendance_settings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  teacher_id CHAR(36) NOT NULL,
  course VARCHAR(160) NOT NULL,
  start_time TIME NOT NULL,
  present_until TIME NOT NULL,
  end_time TIME NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_teacher_course (teacher_id, course)
);

CREATE TABLE IF NOT EXISTS teacher_dashboard_settings (
  teacher_id CHAR(36) NOT NULL PRIMARY KEY,
  course_label VARCHAR(160) NOT NULL,
  session_label VARCHAR(80) NOT NULL,
  year_label VARCHAR(80) NOT NULL,
  semester_label VARCHAR(80) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
