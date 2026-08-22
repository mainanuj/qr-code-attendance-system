# QR Code Attendance System

A full-stack attendance system built with **React**, **Node.js/Express**, and **MySQL**. Teachers manage their own students and class settings, while students can mark attendance from a public QR scanner page.

## Technology used

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MySQL
- QR scanning: Browser camera + `jsQR`
- Authentication: JWT teacher login

## Project structure

```text
qr code attendance system/
│
├── frontend-react/                 # Active React frontend
│   ├── src/
│   │   ├── components/             # Pages and reusable UI components
│   │   ├── api/client.js           # Calls backend APIs
│   │   ├── hooks/                  # Camera scanner and theme hooks
│   │   └── styles/                 # Light/dark theme styles
│   ├── dist/                       # React production build (generated)
│   └── package.json
│
├── backend/                        # Node.js + Express server
│   ├── src/server.js               # APIs and React static hosting
│   ├── src/db.js                   # MySQL connection pool
│   ├── src/migrate-auth.js         # Teacher/login database migration
│   ├── sql/schema.sql              # Database tables
│   ├── .env.example                # Environment variable template
│   └── package.json
│
├── run-attendance.bat              # Starts backend on Windows
└── README.md
```

## How it works

```text
Browser → Express server (localhost:5000) → MySQL database (localhost:3306)
```

The Express server serves the compiled React app and its API from the same address. All student, attendance, teacher, timing, and session data is stored in MySQL.

## Features

- Public QR scanner page without login
- Teacher login with separate private dashboards
- Student add, edit, delete, search, filter, and QR card generation
- CSV and Excel student import
- Attendance log with Present, Late, and Absent status
- Per-student attendance history
- Attendance CSV export
- Class settings: course, academic session, year, semester
- Attendance time rules: Start → Present Until → End
- Light and dark mode

## First-time setup

### 1. Create the environment file

```powershell
Copy-Item .\backend\.env.example .\backend\.env
```

Open `backend/.env` and enter your MySQL password:

```env
DB_PASSWORD=your_mysql_password
JWT_SECRET=use_a_long_random_private_value_here
```

Do not upload `.env` to GitHub.

### 2. Create the database tables

Run this from the main project folder. MySQL will ask for your MySQL root password.

```powershell
mysql -u root -p < .\backend\sql\schema.sql
```

### 3. Run the teacher/login migration

This creates or updates the teacher, username, section, and class-settings tables.

```powershell
cd .\backend
npm.cmd run migrate
```

### 4. Install packages

Only needed on a new laptop or after cloning from GitHub:

```powershell
cd .\backend
npm.cmd install
cd ..\frontend-react
npm.cmd install
```

### 5. Build the React frontend

```powershell
cd .\frontend-react
npm.cmd run build
```

### 6. Start the application

```powershell
cd ..\backend
npm.cmd start
```

Open [http://localhost:5000](http://localhost:5000).

## Daily use

1. Open `http://localhost:5000` for the public QR scanner.
2. Use **Teacher login** to open the private dashboard.
3. Add/import students and configure class timings in **Class settings**.
4. From the public scanner, a logged-in teacher can click **Start Today’s Class**.
5. Students scan their QR cards. The server decides whether the scan is Present, Late, or rejected.

## Attendance timing rules

The frontend never sends an attendance status. The backend calculates it using server time.

- Before Attendance Start: scan is rejected
- Attendance Start to Present Until: `Present`
- Present Until to Attendance End: `Late`
- After Attendance End: scan is rejected

The backend accepts a timing configuration only when:

```text
Start Time < Present Until < Attendance End Time
```

## Student import format

Students can be imported from `.csv` or `.xlsx` files. Column order does not matter, but these headers are required:

```text
Roll Number, Name, Course, Section
```

Duplicate roll numbers are skipped. Each new imported student receives a normal secure QR token.

## Development mode

For automatic React refresh while changing UI code, keep the backend running in one terminal:

```powershell
cd .\backend
npm.cmd run dev
```

Then, in a second terminal:

```powershell
cd .\frontend-react
npm.cmd run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite server forwards API requests to the backend at port 5000.

For normal usage, always use `http://localhost:5000`.

## Build after frontend changes

Whenever a React file is changed, create a new production build:

```powershell
cd .\frontend-react
npm.cmd run build
```

Then refresh the browser with `Ctrl + Shift + R`.
