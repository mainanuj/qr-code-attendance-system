const SESSION_KEY = 'attendly-session';
const authScreen = document.querySelector('#authScreen');
const loginForm = document.querySelector('#loginForm');
const registerForm = document.querySelector('#registerForm');
const authError = document.querySelector('#authError');
const authToggle = document.querySelector('#authToggle');

function initialsFromName(name) { return name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase(); }
function currentSession() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } }
function activateSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  document.body.classList.remove('auth-mode');
  document.body.classList.add('authenticated');
  document.querySelector('#teacherName').textContent = session.teacher.name;
  document.querySelector('#teacherAvatar').textContent = initialsFromName(session.teacher.name);
  document.querySelector('#pageTitle').textContent = `Good morning, ${session.teacher.name} ✦`;
  window.clearTeacherDashboard();
  window.loadDatabaseState();

  if (sessionStorage.getItem('pending-start-class') === 'true') {
    sessionStorage.removeItem('pending-start-class');
    setTimeout(() => {
      if (window.startTodayClass) window.startTodayClass();
    }, 150);
  }
}
async function authRequest(path, body) {
  const response = await fetch(`/api/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Unable to complete the request.');
  return data;
}
function switchAuth(mode) {
  const register = mode === 'register';
  loginForm.classList.toggle('hidden', register);
  registerForm.classList.toggle('hidden', !register);
  document.querySelector('#authTitle').textContent = register ? 'Create teacher account' : 'Welcome back';
  document.querySelector('#authSubtitle').textContent = register ? 'Create your private dashboard in a few seconds.' : 'Log in to access your private teacher dashboard.';
  authToggle.innerHTML = register ? 'Already have an account? <button type="button" data-auth-mode="login">Log in</button>' : 'New teacher? <button type="button" data-auth-mode="register">Create an account</button>';
  authError.textContent = '';
}
loginForm.addEventListener('submit', async (event) => { event.preventDefault(); authError.textContent = ''; try { activateSession(await authRequest('login', { username: document.querySelector('#loginUsername').value.trim(), password: document.querySelector('#loginPassword').value })); } catch (error) { authError.textContent = error.message; } });
registerForm.addEventListener('submit', async (event) => { event.preventDefault(); authError.textContent = ''; try { activateSession(await authRequest('register', { name: document.querySelector('#registerName').value.trim(), username: document.querySelector('#registerUsername').value.trim(), email: document.querySelector('#registerEmail').value.trim(), password: document.querySelector('#registerPassword').value })); } catch (error) { authError.textContent = error.message; } });
authToggle.addEventListener('click', (event) => { if (event.target.dataset.authMode) switchAuth(event.target.dataset.authMode); });
document.querySelector('#logoutButton').addEventListener('click', () => { sessionStorage.removeItem(SESSION_KEY); window.clearTeacherDashboard(); document.body.classList.remove('authenticated'); window.loadPublicSummary?.(); authScreen.scrollTop = 0; });
document.querySelector('#openTeacherLogin').addEventListener('click', () => { document.body.classList.add('auth-mode'); switchAuth('login'); loginForm.reset(); setTimeout(() => loginForm.reset(), 100); authScreen.scrollTop = 0; });
document.querySelector('#backToPublic').addEventListener('click', () => { document.body.classList.remove('auth-mode'); });

const existingSession = currentSession();
if (existingSession?.token && existingSession?.teacher) activateSession(existingSession);
