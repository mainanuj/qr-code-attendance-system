import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { initials } from '../utils/format.js';
import QrSvg from './QrSvg.jsx';
import BrandLogo from './BrandLogo.jsx';

const emptyStudent = { name: '', roll: '', course: '', section: '' };

export default function StudentsView({ students, setStudents, reload, toast }) {
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('');
  const [editing, setEditing] = useState(null);
  const [cardStudent, setCardStudent] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importState, setImportState] = useState({ file: null, message: '', busy: false });
  const [printingStudent, setPrintingStudent] = useState(null);
  const sections = useMemo(() => [...new Set(students.map((student) => student.section))].sort(), [students]);
  const filtered = students.filter((student) => (!search || `${student.name} ${student.roll}`.toLowerCase().includes(search.toLowerCase())) && (!section || student.section === section));

  const printAll = () => {
    setPrintingStudent('all');
    setTimeout(() => window.print(), 80);
  };

  const printSingle = (student) => {
    setPrintingStudent(student);
    setTimeout(() => window.print(), 80);
  };

  useEffect(() => {
    const handleAfterPrint = () => setPrintingStudent(null);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const printList = printingStudent && printingStudent !== 'all' ? [printingStudent] : filtered;

  async function saveStudent(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    if (!body.name?.trim() || !body.roll?.trim() || !body.course?.trim() || !body.section?.trim()) return;
    try {
      const student = editing?.id ? await api.updateStudent(editing.id, body) : await api.createStudent(body);
      setStudents((rows) => editing?.id ? rows.map((row) => row.id === student.id ? student : row) : [...rows, student]);
      setEditing(null); if (!editing?.id) setCardStudent(student);
      toast(editing?.id ? `${student.name} was updated.` : `${student.name} was saved and issued a QR card.`);
    } catch (error) { toast(error.message); }
  }
  async function remove(student) {
    if (!window.confirm(`Delete ${student.name} and their attendance records permanently?`)) return;
    try { await api.deleteStudent(student.id); setStudents((rows) => rows.filter((row) => row.id !== student.id)); toast('Student removed from the database.'); }
    catch (error) { toast(error.message); }
  }
  async function importFile(event) {
    event.preventDefault();
    if (!importState.file) return;
    setImportState((state) => ({ ...state, busy: true, message: '' }));
    const formData = new FormData(); formData.append('file', importState.file);
    try { const summary = await api.importStudents(formData); await reload(); setImportState((state) => ({ ...state, busy: false, message: `Imported: ${summary.imported} | Duplicates: ${summary.duplicates} | Errors: ${summary.errors}` })); toast(`${summary.imported} students imported.`); }
    catch (error) { setImportState((state) => ({ ...state, busy: false, message: error.message })); }
  }

  return (
    <section className="view students-view">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ROSTER</p>
          <h2>Students</h2>
          <p className="muted">Add students and issue an individual, secure QR code.</p>
        </div>
        <div className="student-page-actions">
          <button className="outline-btn" type="button" onClick={() => setImportOpen(true)}>Import students</button>
          <button className="primary-btn" type="button" onClick={() => setEditing(emptyStudent)}>+ Add student</button>
        </div>
      </div>
      <div className="toolbar">
        <label className="search-box">⌕ <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or roll number" /></label>
        <select value={section} onChange={(event) => setSection(event.target.value)}>
          <option value="">All sections</option>
          {sections.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <button className="outline-btn" type="button" onClick={printAll}>▣ Print all cards</button>
      </div>
      <section className="panel table-panel"><table><thead><tr><th>No.</th><th>Student</th><th>Roll no.</th><th>Course</th><th>Section</th><th>QR status</th><th /></tr></thead><tbody>{filtered.map((student, index) => <tr key={student.id}><td>{index + 1}</td><td><div className="table-student"><span className="student-avatar tiny-avatar">{initials(student.name)}</span>{student.name}</div></td><td>{student.roll}</td><td>{student.course}</td><td>{student.section}</td><td><span className="qr-issued">● ISSUED</span></td><td className="row-actions table-actions"><button className="small-btn" onClick={() => setCardStudent(student)}>View QR</button><button className="small-btn" onClick={() => setEditing(student)}>Edit</button><button className="small-btn danger" onClick={() => remove(student)}>×</button></td></tr>)}</tbody></table>{!filtered.length && <div className="empty-state"><span>♙</span><h3>No students yet</h3><p>Add your first student to generate a QR card.</p></div>}</section>
    {editing && <StudentModal student={editing} onClose={() => setEditing(null)} onSubmit={saveStudent} />}
    {cardStudent && <QrModal student={cardStudent} onClose={() => setCardStudent(null)} onPrintSingle={printSingle} />}
    {importOpen && <ImportModal state={importState} setState={setImportState} onClose={() => setImportOpen(false)} onSubmit={importFile} />}

    <div className={`printable-cards-sheet ${printList.length === 1 ? 'single-card' : ''}`} aria-hidden="true">
      {printList.map((s) => (
        <div key={s.id} className="printable-qr-card">
          <div className="printable-card-header">
            <div className="printable-card-brand">
              <BrandLogo size={22} />
              <span>Attendly</span>
            </div>
            <span className="printable-card-tag">STUDENT PASS</span>
          </div>
          <div className="printable-card-qr">
            <QrSvg token={s.token} size={140} />
          </div>
          <div className="printable-card-body">
            <code className="printable-card-token">{s.token}</code>
            <h3 className="printable-card-name">{s.name}</h3>
            <div className="printable-card-details">
              <span><strong>Roll:</strong> {s.roll}</span>
              <span><strong>Course:</strong> {s.course}</span>
              <span><strong>Section:</strong> {s.section}</span>
            </div>
          </div>
          <div className="printable-card-footer">Scan QR to mark attendance</div>
        </div>
      ))}
    </div>
  </section>
  );
}

function ModalDialog({ id, onClose, children }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog ref={dialogRef} id={id} onCancel={(event) => { event.preventDefault(); onClose(); }}>{children}</dialog>;
}
function StudentModal({ student, onClose, onSubmit }) {
  const edit = Boolean(student.id);
  const [error, setError] = useState('');
  function submit(event) {
    const form = event.currentTarget;
    const firstMissing = [...form.querySelectorAll('input')].find((input) => !input.value.trim());
    if (!firstMissing) { onSubmit(event); return; }
    event.preventDefault();
    setError('Please enter the student name, roll number, course, and section.');
    firstMissing.focus();
  }
  return <ModalDialog id="studentModal" onClose={onClose}><form id="studentForm" className="modal-form" noValidate onSubmit={submit}><div className="modal-heading"><div><p className="eyebrow">{edit ? 'EDIT ROSTER ENTRY' : 'NEW ROSTER ENTRY'}</p><h2>{edit ? 'Edit student' : 'Add student'}</h2></div><button className="close-btn" type="button" onClick={onClose}>×</button></div><p className="form-intro">{edit ? 'Update the student details. Their existing QR code will continue to work.' : 'Enter the student details to issue their unique QR attendance card.'}</p><div className="form-grid old-popup-fields"><label>Full name<input id="studentName" name="name" placeholder="e.g. Riya Patel" defaultValue={student.name} onInput={() => setError('')} /></label><label>Roll number<input id="studentRoll" name="roll" placeholder="e.g. CS24-018" defaultValue={student.roll} onInput={() => setError('')} /></label><label>Course<input id="studentCourse" name="course" placeholder="e.g. BCA" defaultValue={student.course} onInput={() => setError('')} /></label><label>Section<input id="studentSection" name="section" maxLength="20" placeholder="e.g. A, B, C or D" defaultValue={student.section} onInput={() => setError('')} /></label></div><p className="form-error" role="alert">{error}</p><div className="modal-actions"><button className="outline-btn" type="button" onClick={onClose}>Cancel</button><button className="primary-btn" id="studentSubmitButton" type="submit">{edit ? 'Save changes' : 'Create QR card'}</button></div></form></ModalDialog>;
}
function QrModal({ student, onClose, onPrintSingle }) { return <ModalDialog id="qrModal" onClose={onClose}><div className="qr-modal-content"><button className="close-btn qr-close" type="button" onClick={onClose}>×</button><p className="eyebrow">STUDENT ACCESS CARD</p><h2>{student.name}</h2><p className="muted">{student.roll} · {student.course} · {student.section}</p><div className="qr-image-wrap"><QrSvg token={student.token} size={170} /></div><code>{student.token}</code><button className="primary-btn wide" type="button" onClick={() => onPrintSingle(student)}>▣ Print QR card</button></div></ModalDialog>; }
function ImportModal({ state, setState, onClose, onSubmit }) { return <ModalDialog id="importModal" onClose={onClose}><form id="importStudentsForm" className="modal-form" onSubmit={onSubmit}><div className="modal-heading"><div><p className="eyebrow">BULK ROSTER IMPORT</p><h2>Import students</h2></div><button className="close-btn" type="button" onClick={onClose}>×</button></div><p className="form-intro">Upload a CSV or Excel file. Columns can be in any order.</p><div className="import-guide"><strong>Required column headers</strong><span>Roll Number</span><span>Name</span><span>Course</span><span>Section</span></div><label className="import-file-label">Choose CSV or Excel file<input id="studentImportFile" name="file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required onChange={(event) => setState((value) => ({ ...value, file: event.target.files[0] || null, message: '' }))} /></label><p className="import-file-name">{state.file?.name || 'No file selected'}</p>{state.message && <div className="import-summary show success">{state.message}</div>}<div className="modal-actions"><button className="outline-btn" type="button" onClick={onClose}>Cancel</button><button className="primary-btn" id="importSubmitButton" disabled={state.busy} type="submit">{state.busy ? 'Importing…' : 'Import students'}</button></div></form></ModalDialog>; }
