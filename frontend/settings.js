const settingsList = document.querySelector('#classSettingsList');
const dashboardSettingsForm = document.querySelector('#dashboardSettingsForm');
const escapeSettingHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function formatTime12h(timeStr) {
  if (!timeStr) return '09:30 AM';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}

function updateLateCheckinLabel(timingSettings) {
  const labelEl = document.querySelector('#lateCheckinLabel');
  if (!labelEl || !Array.isArray(timingSettings) || !timingSettings.length) return;
  const firstWithTiming = timingSettings.find(s => s.presentUntil) || timingSettings[0];
  if (firstWithTiming && firstWithTiming.presentUntil) {
    labelEl.textContent = `After ${formatTime12h(firstWithTiming.presentUntil)}`;
  }
}

function renderClassSettings(settings) {
  updateLateCheckinLabel(settings);
  if (!settings.length) {
    settingsList.innerHTML = '<div class="setting-empty"><span>◷</span><h3>No classes yet</h3><p>Add a student first. Their course will appear here for timing setup.</p></div>';
    return;
  }
  settingsList.innerHTML = settings.map((setting) => { const course = escapeSettingHtml(setting.course); return `<form class="class-setting-card" data-course="${course}"><div class="class-setting-course"><h3>Class attendance timing</h3><p>${course} · QR scans for this class follow the timing window below.</p></div><label>Attendance Start<input name="startTime" type="time" required value="${escapeSettingHtml(setting.startTime || '')}" /></label><label>Present Until<input name="presentUntil" type="time" required value="${escapeSettingHtml(setting.presentUntil || '')}" /></label><label>Attendance End<input name="endTime" type="time" required value="${escapeSettingHtml(setting.endTime || '')}" /></label><button class="primary-btn" type="submit">Save timings</button></form>`; }).join('');
}

function renderDashboardSession(settings) {
  document.querySelector('#dashboardCourseLabel').value = settings.courseLabel || '';
  document.querySelector('#dashboardSessionLabel').value = settings.sessionLabel || '';
  document.querySelector('#dashboardYearLabel').value = settings.yearLabel || '';
  document.querySelector('#dashboardSemesterLabel').value = settings.semesterLabel || '';
  window.updateDashboardSession?.(settings);
}

async function loadClassSettings() {
  try {
    const [timingSettings, dashboardSettings] = await Promise.all([
      window.backendApiRequest('/classes/attendance-settings'),
      window.backendApiRequest('/classes/dashboard-settings')
    ]);
    renderClassSettings(timingSettings);
    renderDashboardSession(dashboardSettings);
  } catch (error) {
    settingsList.innerHTML = `<div class="setting-empty"><h3>Unable to load class settings</h3><p>${error.message}</p></div>`;
  }
}

dashboardSettingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = {
    courseLabel: document.querySelector('#dashboardCourseLabel').value.trim(),
    sessionLabel: document.querySelector('#dashboardSessionLabel').value.trim(),
    yearLabel: document.querySelector('#dashboardYearLabel').value.trim(),
    semesterLabel: document.querySelector('#dashboardSemesterLabel').value.trim()
  };
  try {
    const settings = await window.backendApiRequest('/classes/dashboard-settings', { method: 'PUT', body: JSON.stringify(body) });
    renderDashboardSession(settings);
    window.attendlyUI.toast('Dashboard session details saved.');
  } catch (error) { window.attendlyUI.toast(error.message); }
});

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
window.updateLateCheckinLabel = updateLateCheckinLabel;
window.formatTime12h = formatTime12h;
