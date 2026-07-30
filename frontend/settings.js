const settingsList = document.querySelector('#classSettingsList');
const escapeSettingHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function renderClassSettings(settings) {
  if (!settings.length) {
    settingsList.innerHTML = '<div class="setting-empty"><span>◷</span><h3>No classes yet</h3><p>Add a student first. Their course will appear here for timing setup.</p></div>';
    return;
  }
  settingsList.innerHTML = settings.map((setting) => { const course = escapeSettingHtml(setting.course); return `<form class="class-setting-card" data-course="${course}"><div class="class-setting-course"><h3>${course}</h3><p>QR scans for this class follow the timing window below.</p></div><label>Attendance Start<input name="startTime" type="time" required value="${escapeSettingHtml(setting.startTime || '')}" /></label><label>Present Until<input name="presentUntil" type="time" required value="${escapeSettingHtml(setting.presentUntil || '')}" /></label><label>Attendance End<input name="endTime" type="time" required value="${escapeSettingHtml(setting.endTime || '')}" /></label><button class="primary-btn" type="submit">Save timings</button></form>`; }).join('');
}

async function loadClassSettings() {
  try { renderClassSettings(await window.backendApiRequest('/classes/attendance-settings')); }
  catch (error) { settingsList.innerHTML = `<div class="setting-empty"><h3>Unable to load class settings</h3><p>${error.message}</p></div>`; }
}

settingsList.addEventListener('submit', async (event) => {
  const form = event.target.closest('.class-setting-card');
  if (!form) return;
  event.preventDefault();
  const formData = new FormData(form);
  const body = { course: form.dataset.course, startTime: formData.get('startTime'), presentUntil: formData.get('presentUntil'), endTime: formData.get('endTime') };
  try {
    await window.backendApiRequest('/classes/attendance-settings', { method: 'PUT', body: JSON.stringify(body) });
    window.attendlyUI.toast(`Timing saved for ${body.course}.`);
    await loadClassSettings();
  } catch (error) { window.attendlyUI.toast(error.message); }
});

window.loadClassSettings = loadClassSettings;
