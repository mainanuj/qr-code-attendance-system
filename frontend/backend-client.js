/* Connect the existing UI to the Express/MySQL API when it is available. */
const apiPath = '/api';
let backendOnline = false;
const ui = window.attendlyUI;

async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiPath}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(sessionStorage.getItem('attendly-session') ? { Authorization: `Bearer ${JSON.parse(sessionStorage.getItem('attendly-session')).token}` } : {}), ...(options.headers || {}) },
    ...options
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'The server could not complete that request.');
  return payload;
}

async function loadDatabaseState() {
  backendOnline = false;
  try {
    const health = await apiRequest('/health');
    if (!health.ok) return;
    const [students, attendance] = await Promise.all([apiRequest('/students'), apiRequest('/attendance')]);
    backendOnline = true;
    ui.setDatabaseState(students, attendance);
    ui.toast('Connected to the MySQL attendance database.');
  } catch (error) {
    console.error('Could not load MySQL data:', error);
    /* Static preview remains usable with localStorage until the backend starts. */
  }
}

async function submitDatabaseCheckIn(code) {
  if (!backendOnline) return checkIn(code);
  try {
    const result = await apiRequest('/attendance/check-in', { method: 'POST', body: JSON.stringify({ code }) });
    if (!ui.state.students.some((student) => student.id === result.student.id)) ui.state.students.push(result.student);
    ui.state.attendance.unshift(result.record);
    ui.refresh();
    ui.showScanResult(`✓ ${result.student.name} marked ${result.record.status.toLowerCase()} at ${result.record.time}.`, 'success');
    ui.toast(`${result.student.name} checked in successfully.`);
    return true;
  } catch (error) {
    ui.showScanResult(error.message, 'error');
    return false;
  }
}

window.submitAttendance = submitDatabaseCheckIn;

document.querySelector('#studentForm').addEventListener('submit', async (event) => {
  if (!backendOnline) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const form = event.currentTarget;
  const name = document.querySelector('#studentName').value.trim();
  const roll = document.querySelector('#studentRoll').value.trim();
  const course = document.querySelector('#studentCourse').value.trim();
  const section = document.querySelector('#studentSection').value.trim();
  if (!name || !roll || !course || !section) return;
  try {
    const student = await apiRequest('/students', { method: 'POST', body: JSON.stringify({ name, roll, course, section }) });
    ui.state.students.push(student);
    ui.refresh();
    document.querySelector('#studentModal').close();
    form.reset();
    ui.showCard(student);
    ui.toast(`${student.name} was saved to MySQL and issued a QR card.`);
  } catch (error) {
    document.querySelector('#studentFormError').textContent = error.message;
  }
}, true);

document.querySelector('#openStudentModal').addEventListener('click', () => {
  document.querySelector('#studentForm').reset();
  document.querySelector('#studentFormError').textContent = '';
}, true);

document.querySelector('#studentRows').addEventListener('click', async (event) => {
  const studentId = event.target.dataset.delete;
  if (!studentId || !backendOnline) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const student = ui.state.students.find((entry) => entry.id === studentId);
  if (!student || !confirm(`Delete ${student.name} and their attendance records permanently?`)) return;
  try {
    await apiRequest(`/students/${studentId}`, { method: 'DELETE' });
    ui.state.students = ui.state.students.filter((entry) => entry.id !== studentId);
    ui.refresh();
    ui.toast('Student removed from the database.');
  } catch (error) { ui.toast(error.message); }
}, true);

document.querySelector('#manualCheckin').addEventListener('click', async (event) => {
  if (!backendOnline) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const input = document.querySelector('#manualToken');
  const completed = await submitDatabaseCheckIn(input.value.trim());
  if (completed) input.value = '';
}, true);

loadDatabaseState();
window.loadDatabaseState = loadDatabaseState;
window.clearTeacherDashboard = () => { backendOnline = false; ui.clearDatabaseState(); };
