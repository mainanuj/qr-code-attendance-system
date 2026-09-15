# Attendly — QR Code Attendance System

A modern full-stack web application for school and college class attendance, built with **React**, **Node.js/Express**, and **MySQL**. Teachers have isolated accounts to manage their own classes, students, and attendance timings, with QR-based attendance tracking integrated directly inside an authenticated dashboard.

---

## Technology Stack

- **Frontend:** React 19, Vite, React Router v7 (`react-router-dom`)
- **Backend:** Node.js (ES Modules), Express
- **Database:** MySQL 8.x with connection pooling (`mysql2/promise`)
- **Authentication:** JWT (JSON Web Tokens) with `bcryptjs` password hashing
- **QR Code Engine:** Browser camera stream + `jsQR` / Native `BarcodeDetector` API
- **File Processing:** `multer` and `xlsx` for bulk Excel/CSV student roster imports
- **Styling:** Custom CSS with Futuristic Dark and Light mode, Glassmorphism, and responsive drawer navigation

---

## Project Structure

```text
qr code attendance system/
│
├── frontend-react/                    # React frontend (Vite)
│   ├── public/                        # Static assets & icons
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js              # Centralized API client & HTTP interceptors
│   │   ├── components/                # Application views and UI components
│   │   │   ├── AdminLayout.jsx        # Main dashboard shell & responsive sidebar
│   │   │   ├── AttendanceView.jsx     # Daily attendance log & student attendance records
│   │   │   ├── AuthPage.jsx           # Teacher login and registration modal/page
│   │   │   ├── BrandLogo.jsx          # Custom Attendly SVG logo mark
│   │   │   ├── PublicScanner.jsx      # Authenticated QR camera scanner & manual check-in
│   │   │   ├── SettingsView.jsx       # Class configuration and timing rules
│   │   │   ├── StudentsView.jsx       # Student roster management (import, add, edit, print)
│   │   │   ├── ThemeToggle.jsx        # Dark / Light theme toggle switch
│   │   │   └── Toast.jsx              # Status toast notifications
│   │   ├── hooks/
│   │   │   ├── useCameraScanner.js    # Camera stream, barcode detector, & frame loop
│   │   │   └── useTheme.js            # Theme state persistence (dark/light)
│   │   ├── styles/                    # Stylesheets (modern dark, glassmorphism, responsive)
│   │   │   ├── legacy.css             # Main stylesheet combining theme modules
│   │   │   ├── mobile-responsive.css  # Mobile bottom nav & compact layouts
│   │   │   └── react-popups.css       # Dialog and modal styles
│   │   ├── utils/
│   │   │   └── format.js              # Date/time formatters, CSV export helpers
│   │   ├── App.jsx                    # Root component with React Router setup
│   │   └── main.jsx                   # React application entry point
│   ├── dist/                          # Production build output (served by Express)
│   ├── package.json
│   └── vite.config.js
│
├── backend/                           # Node.js + Express backend
│   ├── sql/
│   │   └── schema.sql                 # MySQL schema, table definitions, & indexes
│   ├── src/
│   │   ├── db.js                      # MySQL connection pool & verification
│   │   ├── migrate-auth.js            # Migration script for auth & multi-tenant schema
│   │   └── server.js                  # Express API routes, JWT auth, & static hosting
│   ├── .env.example                   # Environment variable template
│   └── package.json
│
├── run-attendance.bat                 # Windows one-click startup script
└── README.md                          # Project documentation
```

---

## Application URL Routes

The frontend utilizes client-side routing via `react-router-dom`:

| Route | Page / View | Description |
|---|---|---|
| `/` or `/login` | Teacher Login / Signup | Sign in or register a new teacher account |
| `/dashboard` | Teacher Dashboard | Overview statistics, today's attendance rate, & live check-in feed |
| `/scan` | QR Scanner | In-dashboard camera scanner & manual token/roll check-in |
| `/students` | Student Management | Student roster, add/edit/delete, bulk import, & QR card printing |
| `/attendance` | Attendance Log | Daily attendance register with Date, Section, & Status filters + CSV export |
| `/attendance-records` | Attendance Records | Date-wise attendance history and percentage per student |
| `/settings` | Class Settings | Course, academic session, semester, & attendance timing rules |

---

## Key Features

### 1. Teacher Isolation & Fresh Account Setup
- Each teacher has a completely isolated account with their own students, classes, and logs.
- New accounts start with clean, unshared class settings (no pre-filled or cross-account data).

### 2. Teacher-Specific Student Uniqueness
- Student roll numbers are unique **per teacher** (composite `UNIQUE(teacher_id, roll_number)`). Different teachers can have students with Roll No. `101` without collision.
- Student QR access tokens (`ATD-XXXXXX`) remain globally unique across the system.

### 3. Authenticated QR Scanner with Visual Feedback
- Located inside the dashboard at `/scan`.
- Supports live camera scanning with continuous frame processing and manual input fallback.
- Animated green checkmark (`✓`) and status confirmation overlay for instant check-in confirmation.
- Class session validation: attendance can only be recorded after clicking **"Start Today's Class"**.

### 4. Smart Server-Side Timing Rules
- Attendance status (`Present`, `Late`, or scan rejected) is calculated strictly by the server using server time:
  ```text
  [Start Time] ──── Present ──── [Present Until] ──── Late ──── [End Time] ──── (Rejected)
  ```
- Before `Start Time` or after `End Time`, scans are rejected.
- Validates that `Start Time < Present Until < End Time`.

### 5. Student Roster Management & Bulk Import
- Add individual students or bulk-import via `.csv` or `.xlsx` (Excel) spreadsheets.
- Clean toolbar with real-time name/roll search and section filter.
- One-click individual QR card modal and bulk **Print all cards** view.

### 6. Comprehensive Reporting & Logs
- **Attendance Log:** Displays full register for any selected date with Section (`All sections`, `A`, `B`, etc.) and Status filters.
- **Export to CSV:** Downloads attendance registers formatted for Excel/spreadsheets.
- **Student History:** View historical attendance record, total classes held, present/late/absent counts, and calculated attendance percentage for any student.

### 7. Responsive UI with Expandable Side Panel
- On full desktop screens, a 252px sidebar is visible.
- On compact / split screens, the sidebar collapses into a sleek 72px icon rail.
- Clicking the **Attendly logo** smoothly expands the side panel into a floating drawer with full navigation labels and teacher details.
- Toggle between **Futuristic Dark** and **Light** themes.

---

## Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [MySQL Server](https://dev.mysql.com/downloads/mysql/) (v8.x recommended)

---

### Step 1: Clone and Configure Environment

1. Navigate to the project folder.
2. Create your environment file from the template:
   ```powershell
   Copy-Item .\backend\.env.example .\backend\.env
   ```
3. Open `backend/.env` in a text editor and fill in your MySQL root password and a secure JWT secret:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=qr_attendance_system
   JWT_SECRET=your_long_random_secret_key_here
   ```

---

### Step 2: Initialize the Database

1. Open your terminal in the project root and run the SQL schema:
   ```powershell
   mysql -u root -p < .\backend\sql\schema.sql
   ```
   *(Enter your MySQL root password when prompted)*

2. Run the database migration script to ensure all multi-tenant tables and composite constraints are created:
   ```powershell
   cd .\backend
   npm install
   npm run migrate
   ```

---

### Step 3: Install Frontend Dependencies

```powershell
cd ..\frontend-react
npm install
```

---

### Step 4: Run the Application

#### Option A: Quick Start (Batch File)
Double-click `run-attendance.bat` in the project root, or run in PowerShell:
```powershell
.\run-attendance.bat
```
This automatically starts the backend server on port `5000`, the Vite dev server on port `5173`, and opens the browser.

#### Option B: Manual Development Mode
In Terminal 1 (Backend):
```powershell
cd .\backend
npm run dev
```

In Terminal 2 (Frontend):
```powershell
cd .\frontend-react
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

#### Option C: Production Build
Compile the frontend into static assets served directly by Express:
```powershell
cd .\frontend-react
npm run build
cd ..\backend
npm start
```
Access the application at [http://localhost:5000](http://localhost:5000).

---

## Student Import Format

Bulk import accepts `.csv` and `.xlsx` files. Columns can appear in any order, with these exact header names:

| Roll Number | Name | Course | Section |
|---|---|---|---|
| 241013106001 | Aayush | BCA | A |
| 241013106002 | Abhay | BCA | A |
| 241013106056 | Abhay Singh | BCA | B |

Duplicate roll numbers within the same teacher account will be reported during import. Each newly imported student is automatically assigned a unique QR access card.

---

## License & Attribution

Developed with Google DeepMind Antigravity for educational class attendance management.
