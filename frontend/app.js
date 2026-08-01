const STORAGE_KEY = 'attendly-v2';
const initialState = { students: [], attendance: [] };
let state = loadState();
let stream;
let scanTimer;
let selectedStudent;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || initialState; } catch { return initialState; } }
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function today() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
function formatDate(date) { return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`)); }
function initials(name) { return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase(); }
function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
function token() { return `ATD-${Math.random().toString(16).slice(2, 8).toUpperCase()}`; }
function avatar(student, index = 0) { return `<span class="student-avatar ${['', 'alt', 'warm'][index % 3]}">${initials(student.name)}</span>`; }

function render() { renderDashboard(); renderStudents(); renderRecords(); updateCourseFilter(); updateSectionFilters(); updateYearFilter(); }
function renderDashboard() {
  const current = state.attendance.filter(record => record.date === today());
  const present = current.filter(record => record.status !== 'Absent').length;
  const late = current.filter(record => record.status === 'Late').length;
  const percent = state.students.length ? Math.round(present / state.students.length * 100) : 0;
  $('#studentCount').textContent = state.students.length;
  $('#newStudents').textContent = state.students.length;
  $('#presentCount').textContent = present;
  $('#lateCount').textContent = late;
  $('#attendancePercent').textContent = `${percent}%`;
  $('#attendanceProgress').style.width = `${percent}%`;
  $('#presentSummary').textContent = `${present} of ${state.students.length} students checked in`;
  const entries = state.attendance.filter(record => record.status !== 'Absent').sort((a,b) => b.createdAt - a.createdAt).slice(0, 4);
  $('#recentCheckins').innerHTML = entries.length ? entries.map((record, i) => {
    const student = state.students.find(s => s.id === record.studentId) || { name: 'Deleted student', roll: '—' };
    return `<div class="checkin-row">${avatar(student, i)}<div class="checkin-main"><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.roll)} · ${escapeHtml(student.course || '')}</small></div><span class="checkin-time">${record.time}</span><span class="status ${record.status.toLowerCase()}">${record.status.toUpperCase()}</span></div>`;
  }).join('') : '<div class="empty-state"><span>⌁</span><h3>Ready for your first scan</h3><p>Check-ins will appear here live.</p></div>';
}
function renderStudents() {
  const term = $('#studentSearch').value.toLowerCase(); const course = $('#courseFilter').value; const section = $('#sectionFilter').value;
  const students = state.students.filter(s => (!course || s.course === course) && (!section || s.section === section) && `${s.name} ${s.roll}`.toLowerCase().includes(term));
  $('#studentRows').innerHTML = students.map((student, i) => `<tr><td><div class="table-student">${avatar(student,i)}<span>${escapeHtml(student.name)}</span></div></td><td>${escapeHtml(student.roll)}</td><td>${escapeHtml(student.course)}</td><td>${escapeHtml(student.section || 'General')}</td><td><span class="qr-issued">● ISSUED</span></td><td><div class="row-actions"><button class="small-btn" data-card="${student.id}">View QR</button><button class="small-btn danger" data-delete="${student.id}" title="Delete student">×</button></div></td></tr>`).join('');
  $('#studentRows').querySelectorAll('[data-delete]').forEach((deleteButton) => { const editButton=document.createElement('button'); editButton.type='button'; editButton.className='small-btn edit-btn'; editButton.dataset.edit=deleteButton.dataset.delete; editButton.title='Edit student'; editButton.textContent='Edit'; deleteButton.before(editButton); });
  $('#studentsEmpty').style.display = state.students.length ? 'none' : 'block';
}
function renderRecords() {
  const date = $('#recordDate').value; const year = $('#recordYear').value; const section = $('#recordSection').value; const status = $('#recordStatus').value; const term = $('#recordSearch').value.toLowerCase();
  const rows = [...state.attendance].sort((a,b) => b.createdAt-a.createdAt).filter(record => {
    const student = state.students.find(s => s.id === record.studentId) || {}; const recordSection = student.section || record.section || 'General'; return (!date || record.date === date) && (!year || record.date.startsWith(year)) && (!section || recordSection === section) && (!status || record.status === status) && (!term || (student.name || '').toLowerCase().includes(term));
  });
  $('#recordRows').innerHTML = rows.map((record, i) => { const student = state.students.find(s => s.id === record.studentId) || {name:'Deleted student',roll:'—',section:record.section}; return `<tr><td><div class="table-student">${avatar(student,i)}<span>${escapeHtml(student.name)}</span></div></td><td>${escapeHtml(student.roll)}</td><td>${escapeHtml(student.section || record.section || 'General')}</td><td>${formatDate(record.date)}</td><td>${record.time}</td><td><span class="status ${record.status.toLowerCase()}">${record.status.toUpperCase()}</span></td></tr>`; }).join('');
  $('#recordsEmpty').style.display = state.attendance.length ? 'none' : 'block';
}
function updateCourseFilter() {
  const select = $('#courseFilter'); const value = select.value; const courses = [...new Set(state.students.map(s => s.course))]; select.innerHTML = '<option value="">All courses</option>' + courses.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join(''); select.value = value;
}
function updateSectionFilters() { const sections=[...new Set(state.students.map(student=>student.section || 'General'))].sort(); [['#sectionFilter','All sections'],['#recordSection','All sections']].forEach(([selector,label])=>{const select=$(selector);const value=select.value;select.innerHTML=`<option value="">${label}</option>`+sections.map(section=>`<option value="${escapeHtml(section)}">${escapeHtml(section)}</option>`).join('');select.value=value;}); }
function updateYearFilter() { const select=$('#recordYear'); const value=select.value; const years=[...new Set(state.attendance.map(record=>record.date.slice(0,4)))].sort().reverse(); select.innerHTML='<option value="">All years</option>'+years.map(year=>`<option value="${year}">${year}</option>`).join(''); select.value=value; }
function showView(view) { $$('.view').forEach(v => v.classList.toggle('active', v.id === view)); $$('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.view === view)); let teacherName='Teacher'; try { teacherName=JSON.parse(sessionStorage.getItem('attendly-session'))?.teacher?.name || teacherName; } catch {} $('#pageTitle').textContent = view === 'dashboard' ? `Good morning, ${teacherName} ✦` : ({students:'Student roster',scanner:'Scan attendance',records:'Attendance log',settings:'Class settings'})[view]; if (view !== 'scanner') stopCamera(); if (view === 'settings') window.loadClassSettings?.(); }
function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(el.timer); el.timer=setTimeout(()=>el.classList.remove('show'),3200); }
function showCard(student) { selectedStudent = student; $('#qrName').textContent=student.name; $('#qrDetails').textContent=`${student.roll} · ${student.course} · Section ${student.section || 'General'}`; $('#qrToken').textContent=student.token; $('#qrImage').src=`https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&data=${encodeURIComponent(student.token)}`; $('#qrModal').showModal(); }
function addStudent(event) { event.preventDefault(); const student={id:crypto.randomUUID(),name:$('#studentName').value.trim(),roll:$('#studentRoll').value.trim(),course:$('#studentCourse').value.trim(),section:$('#studentSection').value.trim(),token:token()}; if(!student.section){toast('Section is required.');return;} if(state.students.some(s=>s.roll.toLowerCase()===student.roll.toLowerCase())) {toast('That roll number already exists.');return;} state.students.push(student);saveState();$('#studentModal').close();event.target.reset();render();showCard(student);toast(`${student.name} was added and issued a QR card.`); }
function checkIn(input) { const value=input.trim(); const student=state.students.find(s=>s.token.toLowerCase()===value.toLowerCase() || s.roll.toLowerCase()===value.toLowerCase()); if(!student){showScanResult('No student matches this QR token or roll number.','error');return false;} const duplicate=state.attendance.find(a=>a.studentId===student.id&&a.date===today()); if(duplicate){showScanResult(`${student.name} is already marked ${duplicate.status.toLowerCase()} today.`,'error');return false;} const now=new Date(); const isLate=now.getHours()>9||(now.getHours()===9&&now.getMinutes()>10); const record={id:crypto.randomUUID(),studentId:student.id,date:today(),time:now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}),status:isLate?'Late':'Present',createdAt:Date.now()};state.attendance.push(record);saveState();render();showScanResult(`✓ ${student.name} marked ${record.status.toLowerCase()} at ${record.time}.`,'success');toast(`${student.name} checked in successfully.`);return true; }
function showScanResult(message, kind) { const el=$('#scanResult');el.textContent=message;el.className=`scan-result ${kind}`; }
async function startCamera() { if(!navigator.mediaDevices?.getUserMedia){showScanResult('Camera access is not supported in this browser. Use manual check-in.','error');return;} try { stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});const video=$('#cameraVideo');video.srcObject=stream;video.classList.add('active');$('#cameraPlaceholder').style.display='none'; if('BarcodeDetector' in window){const detector=new BarcodeDetector({formats:['qr_code']});scanTimer=setInterval(async()=>{try{const found=await detector.detect(video);if(found[0]&&checkIn(found[0].rawValue)) stopCamera();}catch{}},700);}else showScanResult('Live QR detection is unavailable here. Use the manual check-in field.','error'); } catch { showScanResult('Camera permission was denied or no camera was found.','error'); } }
function stopCamera(){clearInterval(scanTimer);if(stream){stream.getTracks().forEach(t=>t.stop());stream=undefined;}const video=$('#cameraVideo');if(video){video.srcObject=null;video.classList.remove('active');$('#cameraPlaceholder').style.display='block';}}
function exportCsv() { const safeCell=value=>`"${String(value??'').replaceAll('"','""')}"`;const excelText=value=>value?`="${String(value).replaceAll('"','""')}"`:'';const rows=[['Student','Roll Number','Course','Section','Date','Check-in Time','Status'],...state.attendance.map(r=>{const s=state.students.find(x=>x.id===r.studentId)||{};const isAbsent=r.status==='Absent';return[s.name||'Deleted student',excelText(s.roll||''),s.course||'',s.section||r.section||'',r.date,isAbsent?'':r.time,r.status];})];const csv=`\uFEFF${rows.map(row=>row.map(safeCell).join(',')).join('\r\n')}`;const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`attendly-${today()}.csv`;a.click();URL.revokeObjectURL(url);toast('Excel-friendly attendance CSV downloaded.');}
function printCard() { const body=`<style>body{font-family:Arial;text-align:center;padding:40px;color:#172137}img{width:270px}h1{margin-bottom:4px}p{color:#667}</style><h1>${escapeHtml(selectedStudent.name)}</h1><p>${escapeHtml(selectedStudent.roll)} · ${escapeHtml(selectedStudent.course)}</p><img src="${$('#qrImage').src}"><p>${selectedStudent.token}</p>`;const w=window.open('','_blank');w.document.write(body);w.document.close();w.focus();w.print(); }
function printAll(){if(!state.students.length){toast('Add students before printing cards.');return;}const cards=state.students.map(s=>`<section><h2>${escapeHtml(s.name)}</h2><p>${escapeHtml(s.roll)} · ${escapeHtml(s.course)}</p><img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=0&data=${encodeURIComponent(s.token)}"><code>${s.token}</code></section>`).join('');const w=window.open('','_blank');w.document.write(`<style>body{font-family:Arial;display:grid;grid-template-columns:repeat(2,1fr);gap:25px;padding:30px}section{text-align:center;border:1px solid #ddd;padding:20px;border-radius:12px}p,code{color:#667;font-size:12px}img{width:190px;display:block;margin:12px auto}</style>${cards}`);w.document.close();w.print();}

$$('[data-view]').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.view)));
$('#openStudentModal').addEventListener('click',()=>$('#studentModal').showModal());
$('#studentForm').addEventListener('submit',addStudent);
$$('[data-close-student]').forEach(button=>button.addEventListener('click',()=>$('#studentModal').close()));
$('#studentSearch').addEventListener('input',renderStudents);$('#courseFilter').addEventListener('change',renderStudents);$('#sectionFilter').addEventListener('change',renderStudents);
$('#recordDate').value=today();$('#recordDate').addEventListener('change',renderRecords);$('#recordYear').addEventListener('change',()=>{if($('#recordYear').value)$('#recordDate').value='';renderRecords();});$('#recordSection').addEventListener('change',renderRecords);$('#recordStatus').addEventListener('change',renderRecords);$('#recordSearch').addEventListener('input',renderRecords);
$('#studentRows').addEventListener('click',event=>{const card=event.target.dataset.card,remove=event.target.dataset.delete;if(card)showCard(state.students.find(s=>s.id===card));if(remove){const student=state.students.find(s=>s.id===remove);if(confirm(`Remove ${student.name}? Existing attendance records will be retained.`)){state.students=state.students.filter(s=>s.id!==remove);saveState();render();toast('Student removed from roster.');}}});
$('#manualCheckin').addEventListener('click',()=>{checkIn($('#manualToken').value);$('#manualToken').value='';});$('#manualToken').addEventListener('keydown',e=>{if(e.key==='Enter')$('#manualCheckin').click();});
$('#startCamera').addEventListener('click',startCamera);$('#stopCamera').addEventListener('click',stopCamera);$('#exportCsv').addEventListener('click',exportCsv);$('#printCard').addEventListener('click',printCard);$('#printAll').addEventListener('click',printAll);$('.qr-close').addEventListener('click',()=>$('#qrModal').close());
const dateLabel=new Intl.DateTimeFormat('en-US',{weekday:'long',day:'numeric',month:'long'}).format(new Date()).toUpperCase();$('#todayLabel').textContent=dateLabel;
window.attendlyUI={get state(){return state;},setDatabaseState(students,attendance){state.students=students;state.attendance=attendance;saveState();render();},clearDatabaseState(){state.students=[];state.attendance=[];saveState();render();},refresh(){saveState();render();},toast,showCard,showScanResult};
render();
