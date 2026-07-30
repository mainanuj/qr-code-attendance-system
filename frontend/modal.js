const studentForm = document.querySelector('#studentForm');
const studentFormError = document.querySelector('#studentFormError');

studentForm.addEventListener('submit', (event) => {
  const fields = ['#studentName', '#studentRoll', '#studentCourse', '#studentSection'];
  const missing = fields.some((selector) => !document.querySelector(selector).value.trim());
  if (!missing) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  studentFormError.textContent = 'Please enter the student name, roll number, course, and section.';
  document.querySelector(fields.find((selector) => !document.querySelector(selector).value.trim())).focus();
}, true);

studentForm.querySelectorAll('input').forEach((input) => input.addEventListener('input', () => {
  if ([...studentForm.querySelectorAll('input')].every((field) => field.value.trim())) studentFormError.textContent = '';
}));
