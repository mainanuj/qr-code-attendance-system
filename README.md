# QR Code Attendance System

Full-stack QR attendance system using a browser frontend, Node.js/Express backend, and MySQL database.

## Project structure

```text
qr code attendance system/
│
├── frontend/                         # Browser UI
│   ├── index.html                    # Dashboard and pages
│   ├── app.js                        # UI, local-preview fallback
│   ├── backend-client.js             # Connects UI actions to Express APIs
│   ├── scanner.js                    # Webcam QR scanner
│   ├── styles.css, modal.css          # Styling
│   └── modal.js                       # Student form validation
│
├── backend/                          # Node.js API server
│   ├── src/
│   │   ├── server.js                 # Express routes and static frontend hosting
│   │   └── db.js                     # MySQL connection pool
│   ├── sql/schema.sql                # Creates database and tables
│   ├── .env.example                  # Database configuration template
│   ├── package.json
│   └── node_modules/                 # Installed backend packages (ignored by Git)
│
├── .gitignore
└── README.md
```

## How it works

```text
Laptop browser → Express backend (localhost:5000) → MySQL (localhost:3306)
```

The same Express server serves the frontend and exposes APIs. When the backend is running, student creation, deletion, QR check-in, and attendance records are saved in MySQL. The old browser `localStorage` behavior remains only as a fallback when using the static preview without the backend.

## Database tables

- `students`: name, roll number, course, unique QR token
- `attendance`: student ID, attendance date, check-in time, Present/Late status

The database prevents one student from being marked more than once on the same day.

## First-time local setup

Node.js and MySQL are already installed on this laptop. MySQL needs its root password before the schema can be created.

1. Create the backend environment file:

   ```powershell
   Copy-Item .\backend\.env.example .\backend\.env
   ```

2. Open `backend/.env` and set `DB_PASSWORD` to the MySQL root password.

3. Create the database and tables. This asks for the same password:

   ```powershell
   mysql -u root -p < .\backend\sql\schema.sql
   ```

4. Start the full app:

   ```powershell
   cd .\backend
   npm.cmd start
   ```

5. Open [http://localhost:5000](http://localhost:5000).

For automatic restart while developing, use `npm.cmd run dev` instead.

## API endpoints

- `GET /api/health`
- `GET /api/students`
- `POST /api/students`
- `DELETE /api/students/:id`
- `GET /api/attendance`
- `POST /api/attendance/check-in`

## Teacher login and separate dashboards

Teacher login is included. Each teacher registers with a name, unique username, email, and password; login uses the username and password. After login, teachers can see only their own students and attendance records. The first teacher account created automatically receives the existing student data. Every teacher created after that starts with a private empty roster.

After updating the project, run this migration once:

```powershell
cd .\backend
npm.cmd run migrate
```

Also add a long random `JWT_SECRET` line to `backend/.env` before deployment:

```env
JWT_SECRET=use_a_long_random_private_value_here
```

Do not upload `backend/.env` to GitHub.

## Class attendance timing

Each teacher configures attendance timing separately for every course in **Class settings**. The backend uses server time, never a status sent by the browser:

- Before **Attendance Start**: scan is rejected
- Start through **Present Until**: `Present`
- Present Until through **Attendance End**: `Late`
- After **Attendance End**: scan is rejected

The server accepts settings only when `Start < Present Until < End`.

## Bulk student import

On the **Students** page, use **Import students** to upload a `.csv` or `.xlsx` file (maximum 5 MB). The import maps columns by header name, so their order does not matter. The required headers are:

```text
Roll Number, Name, Course, Section
```

The import creates normal student records with QR tokens, skips duplicate roll numbers, validates missing fields, and displays Imported, Duplicates, and Errors counts after completion.
