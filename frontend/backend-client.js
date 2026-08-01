/* Connect the existing UI to the Express/MySQL API when it is available. */
const apiPath = '/api';
let backendOnline = false;
let editingStudentId = null;
const ui = window.attendlyUI;

async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${apiPath}${path}`, {
    headers: { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...(sessionStorage.getItem('attendly-session') ? { Authorization: `Bearer ${JSON.parse(sessionStorage.getItem('attendly-session')).token}` } : {}), ...(options.headers || {}) },
    ...options
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'The server could not complete that request.');
  return payload;
}
window.backendApiRequest = apiRequest;

function updateDashboardSession(settings) {
  const title = [settings.courseLabel, settings.sessionLabel].filter(Boolean).join(' ');
  const meta = [settings.yearLabel, settings.semesterLabel].filter(Boolean).join(' · ');
  document.querySelector('#dashboardSessionTitle').textContent = title || 'Current session';
  document.querySelector('#dashboardSessionMeta').textContent = meta || 'Set your session details in Class settings';
}
window.updateDashboardSession = updateDashboardSession;

async function loadDatabaseState() {
  backendOnline = false;
  try {
    const health = await apiRequest('/health');
    if (!health.ok) return;
    const selectedDate = document.querySelector('#recordDate').value;
    const [students, attendance, dashboardSession] = await Promise.all([apiRequest('/students'), apiRequest(`/attendance${selectedDate ? `?date=${encodeURIComponent(selectedDate)}` : ''}`), apiRequest('/classes/dashboard-settings')]);
    backendOnline = true;
    ui.setDatabaseState(students, attendance);
    updateDashboardSession(dashboardSession);
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
    ui.state.attendance = ui.state.attendance.filter((record) => !(record.studentId === result.student.id && record.date === result.record.date && record.status === 'Absent'));
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
    const isEditing = Boolean(editingStudentId);
    const student = await apiRequest(isEditing ? `/students/${editingStudentId}` : '/students', { method: isEditing ? 'PUT' : 'POST', body: JSON.stringify({ name, roll, course, section }) });
    if (isEditing) ui.state.students = ui.state.students.map((entry) => entry.id === student.id ? student : entry);
    else ui.state.students.push(student);
    ui.refresh();
    document.querySelector('#studentModal').close();
    form.reset();
    editingStudentId = null;
    document.querySelector('#studentModalEyebrow').textContent = 'NEW ROSTER ENTRY';
    document.querySelector('#studentModalTitle').textContent = 'Add student';
    document.querySelector('#studentModalIntro').textContent = 'Enter the student\'s details to issue their unique QR attendance card.';
    document.querySelector('#studentSubmitButton').textContent = 'Create QR card';
    if (isEditing) ui.toast(`${student.name} was updated in the database.`);
    else { ui.showCard(student); ui.toast(`${student.name} was saved to MySQL and issued a QR card.`); }
  } catch (error) {
    document.querySelector('#studentFormError').textContent = error.message;
  }
}, true);

document.querySelector('#openStudentModal').addEventListener('click', () => {
  editingStudentId = null;
  document.querySelector('#studentForm').reset();
  document.querySelector('#studentFormError').textContent = '';
  document.querySelector('#studentModalEyebrow').textContent = 'NEW ROSTER ENTRY';
  document.querySelector('#studentModalTitle').textContent = 'Add student';
  document.querySelector('#studentModalIntro').textContent = 'Enter the student\'s details to issue their unique QR attendance card.';
  document.querySelector('#studentSubmitButton').textContent = 'Create QR card';
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

document.querySelector('#studentRows').addEventListener('click', (event) => {
  const studentId = event.target.dataset.edit;
  if (!studentId || !backendOnline) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const student = ui.state.students.find((entry) => entry.id === studentId);
  if (!student) return;
  editingStudentId = student.id;
  document.querySelector('#studentName').value = student.name;
  document.querySelector('#studentRoll').value = student.roll;
  document.querySelector('#studentCourse').value = student.course;
  document.querySelector('#studentSection').value = student.section || '';
  document.querySelector('#studentModalEyebrow').textContent = 'EDIT ROSTER ENTRY';
  document.querySelector('#studentModalTitle').textContent = 'Edit student';
  document.querySelector('#studentModalIntro').textContent = 'Update the student details. Their existing QR code will continue to work.';
  document.querySelector('#studentSubmitButton').textContent = 'Save changes';
  document.querySelector('#studentFormError').textContent = '';
  document.querySelector('#studentModal').showModal();
}, true);

const importModal = document.querySelector('#importModal');
const importForm = document.querySelector('#importStudentsForm');
const importFile = document.querySelector('#studentImportFile');
const importFileName = document.querySelector('#importFileName');
const importSummary = document.querySelector('#importSummary');
const escapeImportText = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

function resetImportDialog() {
  importForm.reset();
  importFileName.textContent = 'No file selected';
  importSummary.className = 'import-summary';
  importSummary.innerHTML = '';
  document.querySelector('#importSubmitButton').disabled = false;
  document.querySelector('#importSubmitButton').textContent = 'Import students';
}

document.querySelector('#openImportModal').addEventListener('click', () => { resetImportDialog(); importModal.showModal(); });
document.querySelectorAll('[data-close-import]').forEach((button) => button.addEventListener('click', () => importModal.close()));
importFile.addEventListener('change', () => { importFileName.textContent = importFile.files[0] ? importFile.files[0].name : 'No file selected'; });
importForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!backendOnline || !importFile.files[0]) return;
  const submitButton = document.querySelector('#importSubmitButton');
  submitButton.disabled = true;
  submitButton.textContent = 'Importing...';
  importSummary.className = 'import-summary';
  importSummary.innerHTML = '';
  try {
    const summary = await apiRequest('/students/import', { method: 'POST', body: new FormData(importForm) });
    importSummary.className = 'import-summary show success';
    importSummary.innerHTML = `<strong>Import complete</strong>Imported: ${summary.imported} &nbsp;|&nbsp; Duplicates: ${summary.duplicates} &nbsp;|&nbsp; Errors: ${summary.errors}${summary.messages.length ? `<ul>${summary.messages.map((message) => `<li>${escapeImportText(message)}</li>`).join('')}</ul>` : ''}`;
    await loadDatabaseState();
    ui.toast(`${summary.imported} student${summary.imported === 1 ? '' : 's'} imported.`);
  } catch (error) {
    importSummary.className = 'import-summary show error';
    importSummary.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Import students';
  }
});

document.querySelector('#manualCheckin').addEventListener('click', async (event) => {
  if (!backendOnline) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const input = document.querySelector('#manualToken');
  const completed = await submitDatabaseCheckIn(input.value.trim());
  if (completed) input.value = '';
}, true);

document.querySelector('#recordDate').addEventListener('change', async () => {
  if (!backendOnline) return;
  try {
    const date = document.querySelector('#recordDate').value;
    ui.state.attendance = await apiRequest(`/attendance${date ? `?date=${encodeURIComponent(date)}` : ''}`);
    ui.refresh();
  } catch (error) { ui.toast(error.message); }
}, true);

loadDatabaseState();
window.loadDatabaseState = loadDatabaseState;
window.clearTeacherDashboard = () => { backendOnline = false; ui.clearDatabaseState(); };
