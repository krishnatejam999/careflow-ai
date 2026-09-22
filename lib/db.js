/**
 * CareFlow AI — data layer.
 *
 * A tiny document store with an injectable persistence backend, so the exact
 * same module runs in three places:
 *
 *   Node server   → lib/disk.js writes data/db.json
 *   Browser       → public/js/local-backend.js writes localStorage
 *   Tests         → nothing injected, pure in-memory
 *
 * That means the API layer and all five AI agents are isomorphic: the app
 * works with a server, and it works as a static site on GitHub Pages with no
 * server at all.
 *
 * This file imports nothing, so it is safe to load in a browser.
 */
let state = null;
let persist = null;
let warned = false;

/* ------------------------------------------------------------------ utils */

const now = () => new Date().toISOString();

let seq = 1000;
const uid = (prefix = 'id') => `${prefix}_${(++seq).toString(36)}${Date.now().toString(36).slice(-3)}`;

const iso = (dayOffset = 0, hour = 9, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const dateOnly = (dayOffset = 0) => iso(dayOffset).slice(0, 10);

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

/* -------------------------------------------------------------- the seed */

function seed() {
  const agents = [
    { id: 'reception-ai', name: 'Reception AI', tag: 'Front desk', accent: '#0ea5e9', status: 'active', icon: 'door' },
    { id: 'records-ai', name: 'Records AI', tag: 'Clinical data', accent: '#8b5cf6', status: 'active', icon: 'file' },
    { id: 'workflow-ai', name: 'Workflow AI', tag: 'Routing & tasks', accent: '#14b8a6', status: 'active', icon: 'route' },
    { id: 'comm-ai', name: 'Comm. AI', tag: 'Patient comms', accent: '#f59e0b', status: 'active', icon: 'chat' },
    { id: 'coordinator-ai', name: 'Coordinator AI', tag: 'Operations', accent: '#ef4444', status: 'active', icon: 'pulse' },
  ];

  const users = [
    {
      id: 'u_reception', name: 'Ananya Sharma', role: 'reception', title: 'Front Desk Executive',
      email: 'reception@careflow.ai', department: 'OPD Front Desk', shift: 'Morning · 8:00–16:00',
      phone: '+91 98200 11223', status: 'on-shift', load: 62, initials: 'AS',
    },
    {
      id: 'u_doctor', name: 'Dr. Rohan Mehta', role: 'doctor', title: 'Consultant, General Medicine',
      email: 'doctor@careflow.ai', department: 'General Medicine', shift: 'Morning · 9:00–17:00',
      phone: '+91 98200 44551', status: 'on-shift', load: 78, initials: 'RM', regNo: 'MCI-2014-88231',
    },
    {
      id: 'u_doctor2', name: 'Dr. Kavya Rao', role: 'doctor', title: 'Consultant, Cardiology',
      email: 'kavya@careflow.ai', department: 'Cardiology', shift: 'Morning · 9:00–17:00',
      phone: '+91 98200 77812', status: 'in-consult', load: 71, initials: 'KR', regNo: 'MCI-2016-41190',
    },
    {
      id: 'u_nurse', name: 'Priya Nair', role: 'nurse', title: 'Staff Nurse, Ward A',
      email: 'nurse@careflow.ai', department: 'Ward A', shift: 'Morning · 7:00–15:00',
      phone: '+91 98200 33447', status: 'on-shift', load: 84, initials: 'PN',
    },
    {
      id: 'u_nurse2', name: 'Arjun Verma', role: 'nurse', title: 'Staff Nurse, Triage',
      email: 'arjun@careflow.ai', department: 'Emergency', shift: 'Night · 19:00–7:00',
      phone: '+91 98200 66554', status: 'off-shift', load: 24, initials: 'AV',
    },
    {
      id: 'u_admin', name: 'Vikram Iyer', role: 'admin', title: 'Head of Hospital Operations',
      email: 'admin@careflow.ai', department: 'Operations', shift: 'Full day',
      phone: '+91 98200 99001', status: 'on-shift', load: 41, initials: 'VI',
    },
    {
      id: 'u_lab', name: 'Sunita Das', role: 'lab', title: 'Lab Technician',
      email: 'lab@careflow.ai', department: 'Pathology', shift: 'Morning · 8:00–16:00',
      phone: '+91 98200 22119', status: 'on-shift', load: 55, initials: 'SD',
    },
    {
      id: 'u_pharm', name: 'Rahul Kulkarni', role: 'pharmacy', title: 'Chief Pharmacist',
      email: 'pharmacy@careflow.ai', department: 'Pharmacy', shift: 'Morning · 8:00–16:00',
      phone: '+91 98200 55360', status: 'on-shift', load: 48, initials: 'RK',
    },
  ];

  const patients = [
    {
      id: 'p_001', mrn: 'MRN-48210', name: 'Priya Deshmukh', age: 34, gender: 'Female',
      phone: '+91 98765 43210', bloodGroup: 'B+', address: 'Andheri West, Mumbai',
      allergies: ['Penicillin'], conditions: ['Hypothyroidism'],
      medications: ['Levothyroxine 50mcg'],
      insurance: { provider: 'Star Health', policyNo: 'SH-4471-2290', scheme: 'Ayushman Bharat', valid: true },
      symptoms: ['Fatigue', 'Irregular heartbeat'], riskLevel: 'medium', primaryDoctorId: 'u_doctor',
      lastVisit: dateOnly(-42), createdAt: minutesAgo(95),
    },
    {
      id: 'p_002', mrn: 'MRN-48211', name: 'Imran Qureshi', age: 58, gender: 'Male',
      phone: '+91 98200 11908', bloodGroup: 'O+', address: 'Bandra East, Mumbai',
      allergies: [], conditions: ['Type 2 Diabetes', 'Hypertension'],
      medications: ['Metformin 500mg', 'Telmisartan 40mg'],
      insurance: { provider: 'HDFC Ergo', policyNo: 'HE-9921-0034', scheme: 'Cashless', valid: true },
      symptoms: ['Chest tightness', 'Breathlessness on exertion'], riskLevel: 'high', primaryDoctorId: 'u_doctor2',
      lastVisit: dateOnly(-14), createdAt: minutesAgo(70),
    },
    {
      id: 'p_003', mrn: 'MRN-48212', name: 'Meera Krishnan', age: 27, gender: 'Female',
      phone: '+91 90040 55123', bloodGroup: 'A+', address: 'Powai, Mumbai',
      allergies: ['Sulfa drugs'], conditions: [],
      medications: [],
      insurance: { provider: 'Niva Bupa', policyNo: 'NB-3310-7781', scheme: 'Reimbursement', valid: true },
      symptoms: ['Skin rash', 'Itching'], riskLevel: 'low', primaryDoctorId: 'u_doctor',
      lastVisit: null, createdAt: minutesAgo(52),
    },
    {
      id: 'p_004', mrn: 'MRN-48213', name: 'Rakesh Pawar', age: 71, gender: 'Male',
      phone: '+91 99303 88420', bloodGroup: 'AB-', address: 'Dadar, Mumbai',
      allergies: ['Iodine'], conditions: ['COPD', 'Atrial fibrillation'],
      medications: ['Warfarin 5mg', 'Salbutamol inhaler'],
      insurance: { provider: 'Govt. Scheme', policyNo: 'AB-PMJAY-77213', scheme: 'PM-JAY', valid: true },
      symptoms: ['Persistent cough', 'Low oxygen saturation'], riskLevel: 'critical', primaryDoctorId: 'u_doctor2',
      lastVisit: dateOnly(-3), createdAt: minutesAgo(40),
    },
    {
      id: 'p_005', mrn: 'MRN-48214', name: 'Fatima Sheikh', age: 45, gender: 'Female',
      phone: '+91 98191 30022', bloodGroup: 'B-', address: 'Kurla, Mumbai',
      allergies: [], conditions: ['Migraine'],
      medications: ['Sumatriptan 50mg'],
      insurance: { provider: 'ICICI Lombard', policyNo: 'IL-2210-4490', scheme: 'Cashless', valid: true },
      symptoms: ['Severe headache', 'Photophobia'], riskLevel: 'medium', primaryDoctorId: 'u_doctor',
      lastVisit: dateOnly(-30), createdAt: minutesAgo(28),
    },
    {
      id: 'p_006', mrn: 'MRN-48215', name: 'Aditya Rane', age: 8, gender: 'Male',
      phone: '+91 98211 77430', bloodGroup: 'O-', address: 'Ghatkopar, Mumbai',
      allergies: ['Peanuts'], conditions: ['Asthma'],
      medications: ['Montelukast 4mg'],
      insurance: { provider: 'Star Health', policyNo: 'SH-8891-1120', scheme: 'Family floater', valid: true },
      symptoms: ['Fever', 'Throat pain'], riskLevel: 'low', primaryDoctorId: 'u_doctor',
      lastVisit: dateOnly(-60), createdAt: minutesAgo(19),
    },
    {
      id: 'p_007', mrn: 'MRN-48216', name: 'Sunita Joshi', age: 62, gender: 'Female',
      phone: '+91 98207 66541', bloodGroup: 'A-', address: 'Chembur, Mumbai',
      allergies: ['Aspirin'], conditions: ['Osteoarthritis', 'Anaemia'],
      medications: ['Ferrous ascorbate', 'Calcium + D3'],
      insurance: { provider: 'Ayushman Bharat', policyNo: 'AB-9912-3345', scheme: 'PM-JAY', valid: true },
      symptoms: ['Knee pain', 'Giddiness'], riskLevel: 'medium', primaryDoctorId: 'u_doctor',
      lastVisit: dateOnly(-21), createdAt: minutesAgo(12),
    },
    {
      id: 'p_008', mrn: 'MRN-48217', name: 'Devansh Gupta', age: 39, gender: 'Male',
      phone: '+91 98670 21345', bloodGroup: 'B+', address: 'Malad, Mumbai',
      allergies: [], conditions: ['Hyperlipidaemia'],
      medications: ['Atorvastatin 10mg'],
      insurance: { provider: 'HDFC Ergo', policyNo: 'HE-1188-9021', scheme: 'Corporate', valid: true },
      symptoms: ['Routine follow-up', 'Weight gain'], riskLevel: 'low', primaryDoctorId: 'u_doctor',
      lastVisit: dateOnly(-90), createdAt: minutesAgo(6),
    },
  ];

  const queue = [
    { id: 'q_01', token: 'OPD-101', patientId: 'p_004', department: 'Cardiology', doctorId: 'u_doctor2', status: 'in-consult', priority: 'critical', source: 'Reception AI', checkedInAt: minutesAgo(40), calledAt: minutesAgo(18), waitMinutes: 22, triageScore: 92 },
    { id: 'q_02', token: 'OPD-102', patientId: 'p_002', department: 'Cardiology', doctorId: 'u_doctor2', status: 'waiting', priority: 'high', source: 'Reception AI', checkedInAt: minutesAgo(70), calledAt: null, waitMinutes: 70, triageScore: 78 },
    { id: 'q_03', token: 'OPD-103', patientId: 'p_001', department: 'General Medicine', doctorId: 'u_doctor', status: 'waiting', priority: 'medium', source: 'Web booking', checkedInAt: minutesAgo(52), calledAt: null, waitMinutes: 52, triageScore: 54 },
    { id: 'q_04', token: 'OPD-104', patientId: 'p_005', department: 'General Medicine', doctorId: 'u_doctor', status: 'waiting', priority: 'medium', source: 'Reception AI', checkedInAt: minutesAgo(28), calledAt: null, waitMinutes: 28, triageScore: 48 },
    { id: 'q_05', token: 'OPD-105', patientId: 'p_007', department: 'General Medicine', doctorId: 'u_doctor', status: 'waiting', priority: 'medium', source: 'Walk-in', checkedInAt: minutesAgo(12), calledAt: null, waitMinutes: 12, triageScore: 41 },
    { id: 'q_06', token: 'OPD-106', patientId: 'p_006', department: 'Paediatrics', doctorId: 'u_doctor', status: 'waiting', priority: 'low', source: 'Reception AI', checkedInAt: minutesAgo(19), calledAt: null, waitMinutes: 19, triageScore: 26 },
    { id: 'q_07', token: 'OPD-107', patientId: 'p_008', department: 'General Medicine', doctorId: 'u_doctor', status: 'waiting', priority: 'low', source: 'Web booking', checkedInAt: minutesAgo(6), calledAt: null, waitMinutes: 6, triageScore: 18 },
    { id: 'q_08', token: 'OPD-098', patientId: 'p_003', department: 'Dermatology', doctorId: 'u_doctor', status: 'completed', priority: 'low', source: 'Reception AI', checkedInAt: minutesAgo(115), calledAt: minutesAgo(100), waitMinutes: 15, triageScore: 12, completedAt: minutesAgo(78) },
  ];

  const appointments = [
    { id: 'a_01', patientId: 'p_001', doctorId: 'u_doctor', department: 'General Medicine', datetime: iso(0, 11, 30), type: 'Follow-up', status: 'confirmed', notes: 'Thyroid review' },
    { id: 'a_02', patientId: 'p_002', doctorId: 'u_doctor2', department: 'Cardiology', datetime: iso(0, 10, 0), type: 'Consultation', status: 'checked-in', notes: 'ECG + lipid profile' },
    { id: 'a_03', patientId: 'p_006', doctorId: 'u_doctor', department: 'Paediatrics', datetime: iso(0, 12, 15), type: 'Consultation', status: 'confirmed', notes: 'Fever since 2 days' },
    { id: 'a_04', patientId: 'p_005', doctorId: 'u_doctor', department: 'General Medicine', datetime: iso(1, 9, 45), type: 'Consultation', status: 'confirmed', notes: 'Migraine review' },
    { id: 'a_05', patientId: 'p_004', doctorId: 'u_doctor2', department: 'Cardiology', datetime: iso(1, 10, 30), type: 'Follow-up', status: 'confirmed', notes: 'Post-discharge review' },
    { id: 'a_06', patientId: 'p_007', doctorId: 'u_doctor', department: 'Orthopaedics', datetime: iso(2, 15, 0), type: 'Consultation', status: 'confirmed', notes: 'Knee X-ray' },
    { id: 'a_07', patientId: 'p_003', doctorId: 'u_doctor', department: 'Dermatology', datetime: iso(0, 16, 45), type: 'Consultation', status: 'pending', notes: 'Allergy panel' },
  ];

  const tasks = [
    { id: 't_01', title: 'Obtain 12-lead ECG and attach to chart', patientId: 'p_004', assignedTo: 'u_nurse', priority: 'critical', status: 'in-progress', category: 'Emergency', dueAt: minutesAgo(-5), source: 'Workflow AI', createdAt: minutesAgo(35) },
    { id: 't_02', title: 'Start oxygen support, titrate to SpO2 94–98%', patientId: 'p_004', assignedTo: 'u_nurse', priority: 'critical', status: 'todo', category: 'Emergency', dueAt: minutesAgo(-2), source: 'Workflow AI', createdAt: minutesAgo(34) },
    { id: 't_03', title: 'Record baseline vitals before consult', patientId: 'p_002', assignedTo: 'u_nurse', priority: 'high', status: 'todo', category: 'Vitals', dueAt: minutesAgo(-10), source: 'Workflow AI', createdAt: minutesAgo(50) },
    { id: 't_04', title: 'Draw blood for lipid profile + HbA1c', patientId: 'p_002', assignedTo: 'u_lab', priority: 'high', status: 'in-progress', category: 'Labs', dueAt: minutesAgo(-20), source: 'Workflow AI', createdAt: minutesAgo(60) },
    { id: 't_05', title: 'Administer Levothyroxine 50mcg — confirm fasting', patientId: 'p_001', assignedTo: 'u_nurse', priority: 'medium', status: 'todo', category: 'Medication', dueAt: minutesAgo(-25), source: 'Workflow AI', createdAt: minutesAgo(45) },
    { id: 't_06', title: 'Paediatric weight check + temperature log', patientId: 'p_006', assignedTo: 'u_nurse2', priority: 'medium', status: 'todo', category: 'Vitals', dueAt: minutesAgo(-30), source: 'Workflow AI', createdAt: minutesAgo(20) },
    { id: 't_07', title: 'Prepare and dispatch discharge summary', patientId: 'p_003', assignedTo: 'u_reception', priority: 'low', status: 'done', category: 'Documents', dueAt: minutesAgo(60), source: 'Records AI', createdAt: minutesAgo(80), completedAt: minutesAgo(62) },
    { id: 't_08', title: 'Verify PM-JAY eligibility before billing', patientId: 'p_004', assignedTo: 'u_reception', priority: 'high', status: 'todo', category: 'Insurance', dueAt: minutesAgo(-40), source: 'Records AI', createdAt: minutesAgo(38) },
    { id: 't_09', title: 'Physiotherapy referral note for knee OA', patientId: 'p_007', assignedTo: 'u_nurse', priority: 'low', status: 'todo', category: 'Care plan', dueAt: minutesAgo(-90), source: 'Workflow AI', createdAt: minutesAgo(13) },
    { id: 't_10', title: 'Restock Ward A emergency trolley', patientId: null, assignedTo: 'u_pharm', priority: 'medium', status: 'todo', category: 'Inventory', dueAt: minutesAgo(-45), source: 'Coordinator AI', createdAt: minutesAgo(70) },
  ];

  const vitals = [
    { id: 'v_01', patientId: 'p_004', recordedBy: 'u_nurse', recordedAt: minutesAgo(32), hr: 112, bpSys: 158, bpDia: 94, temp: 37.4, spo2: 89, rr: 24, pain: 4, flag: 'critical', note: 'Tachypnoeic, on 2L O2' },
    { id: 'v_02', patientId: 'p_002', recordedBy: 'u_nurse', recordedAt: minutesAgo(60), hr: 96, bpSys: 148, bpDia: 92, temp: 36.9, spo2: 96, rr: 19, pain: 3, flag: 'high', note: 'BP above target range' },
    { id: 'v_03', patientId: 'p_001', recordedBy: 'u_nurse', recordedAt: minutesAgo(48), hr: 88, bpSys: 118, bpDia: 76, temp: 36.7, spo2: 98, rr: 17, pain: 1, flag: 'normal', note: '' },
    { id: 'v_04', patientId: 'p_006', recordedBy: 'u_nurse2', recordedAt: minutesAgo(17), hr: 104, bpSys: 100, bpDia: 64, temp: 38.6, spo2: 97, rr: 22, pain: 2, flag: 'medium', note: 'Febrile, paediatric dose paracetamol given' },
  ];

  const labs = [
    { id: 'l_01', patientId: 'p_004', orderedBy: 'u_doctor2', test: 'BNP (NT-proBNP)', result: '1840', unit: 'pg/mL', range: '< 125', status: 'reported', reportedAt: minutesAgo(26), flag: 'critical' },
    { id: 'l_02', patientId: 'p_004', orderedBy: 'u_doctor2', test: 'Troponin I', result: '0.04', unit: 'ng/mL', range: '< 0.04', status: 'reported', reportedAt: minutesAgo(30), flag: 'high' },
    { id: 'l_03', patientId: 'p_002', orderedBy: 'u_doctor2', test: 'HbA1c', result: '8.9', unit: '%', range: '4.0 – 5.6', status: 'processing', reportedAt: null, flag: 'high' },
    { id: 'l_04', patientId: 'p_002', orderedBy: 'u_doctor2', test: 'LDL Cholesterol', result: '168', unit: 'mg/dL', range: '< 100', status: 'reported', reportedAt: minutesAgo(44), flag: 'high' },
    { id: 'l_05', patientId: 'p_001', orderedBy: 'u_doctor', test: 'TSH', result: '6.4', unit: 'µIU/mL', range: '0.4 – 4.0', status: 'reported', reportedAt: minutesAgo(70), flag: 'medium' },
    { id: 'l_06', patientId: 'p_001', orderedBy: 'u_doctor', test: 'Serum Creatinine', result: '0.8', unit: 'mg/dL', range: '0.6 – 1.1', status: 'reported', reportedAt: minutesAgo(72), flag: 'normal' },
    { id: 'l_07', patientId: 'p_006', orderedBy: 'u_doctor', test: 'CBC — WBC', result: '13.2', unit: '10³/µL', range: '4.5 – 11.0', status: 'reported', reportedAt: minutesAgo(11), flag: 'medium' },
    { id: 'l_08', patientId: 'p_007', orderedBy: 'u_doctor', test: 'Haemoglobin', result: '9.1', unit: 'g/dL', range: '12.0 – 15.0', status: 'reported', reportedAt: minutesAgo(88), flag: 'medium' },
  ];

  const prescriptions = [
    { id: 'rx_01', patientId: 'p_004', doctorId: 'u_doctor2', status: 'active', createdAt: minutesAgo(20), items: [
      { drug: 'Furosemide 40mg', dose: '1 tablet', freq: 'Once daily · morning', duration: '7 days' },
      { drug: 'Oxygen therapy', dose: '2 L/min', freq: 'Continuous — titrate to SpO2', duration: 'Until stable' },
    ] },
    { id: 'rx_02', patientId: 'p_001', doctorId: 'u_doctor', status: 'active', createdAt: minutesAgo(46), items: [
      { drug: 'Levothyroxine 50mcg', dose: '1 tablet', freq: 'Once daily · empty stomach', duration: '30 days' },
    ] },
  ];

  const notes = [
    { id: 'n_01', patientId: 'p_004', doctorId: 'u_doctor2', createdAt: minutesAgo(16), aiGenerated: true,
      chiefComplaint: 'Breathlessness and dry cough for 3 days',
      subjective: '71M, known COPD with atrial fibrillation on warfarin. Reports worsening dyspnoea on minimal exertion, orthopnoea, dry cough. No fever or chest pain.',
      objective: 'HR 112, BP 158/94, RR 24, SpO2 89% on room air. Bilateral basal crepitations. JVP mildly raised.',
      assessment: 'Acute decompensated heart failure (NYHA III) with COPD exacerbation. High bleeding risk on warfarin.',
      plan: 'IV furosemide, oxygen to target SpO2 94–98%, serial troponin and NT-proBNP, strict fluid balance chart, cardiology review within 24h. Flag iodine allergy — contrast imaging contraindicated.' },
  ];

  const activity = [
    { id: 'ac_01', ts: minutesAgo(2), agent: 'Workflow AI', level: 'critical', message: 'Escalated Rakesh Pawar (OPD-101) to Cardiology — triage score 92/100.', role: 'all' },
    { id: 'ac_02', ts: minutesAgo(6), agent: 'Comm. AI', level: 'info', message: 'Sent WhatsApp check-in confirmation and token OPD-107 to Devansh Gupta.', role: 'all' },
    { id: 'ac_03', ts: minutesAgo(11), agent: 'Records AI', level: 'info', message: 'Pulled 3 prior records for Meera Krishnan and de-duplicated intake data.', role: 'all' },
    { id: 'ac_04', ts: minutesAgo(16), agent: 'Coordinator AI', level: 'warning', message: 'Cardiology wait time trending +14 min. Suggested re-balancing Dr. Rao’s slot load.', role: 'all' },
    { id: 'ac_05', ts: minutesAgo(26), agent: 'Records AI', level: 'warning', message: 'Critical lab value: NT-proBNP 1840 pg/mL for Rakesh Pawar. Notified Dr. Kavya Rao.', role: 'all' },
    { id: 'ac_06', ts: minutesAgo(34), agent: 'Reception AI', level: 'info', message: 'OCR check-in complete for Rakesh Pawar — 11 fields extracted, 0 manual edits.', role: 'all' },
  ];

  const beds = [
    { ward: 'Ward A — General', total: 42, occupied: 31 },
    { ward: 'Ward B — Surgical', total: 28, occupied: 22 },
    { ward: 'ICU', total: 16, occupied: 13 },
    { ward: 'NICU / Paediatric', total: 18, occupied: 7 },
    { ward: 'Cardiac Care', total: 12, occupied: 11 },
    { ward: 'Emergency / Triage', total: 20, occupied: 12 },
  ];

  const revenue = [
    { month: 'Apr', opd: 4.2, ipd: 8.1, pharmacy: 2.4, insurance: 9.6 },
    { month: 'May', opd: 4.6, ipd: 8.4, pharmacy: 2.6, insurance: 10.1 },
    { month: 'Jun', opd: 4.1, ipd: 7.9, pharmacy: 2.2, insurance: 9.2 },
    { month: 'Jul', opd: 5.0, ipd: 8.9, pharmacy: 2.9, insurance: 11.0 },
    { month: 'Aug', opd: 5.4, ipd: 9.2, pharmacy: 3.1, insurance: 11.7 },
    { month: 'Sep', opd: 5.1, ipd: 9.0, pharmacy: 3.0, insurance: 11.4 },
  ];

  const throughput = [
    { hour: '08:00', seen: 12, waiting: 3 },
    { hour: '09:00', seen: 21, waiting: 7 },
    { hour: '10:00', seen: 34, waiting: 14 },
    { hour: '11:00', seen: 41, waiting: 11 },
    { hour: '12:00', seen: 38, waiting: 8 },
    { hour: '13:00', seen: 26, waiting: 5 },
    { hour: '14:00', seen: 30, waiting: 6 },
    { hour: '15:00', seen: 24, waiting: 4 },
  ];

  const insights = [
    { id: 'i_01', agent: 'Coordinator AI', severity: 'critical', title: 'Cardiology is the bottleneck',
      detail: 'Average consult wait has climbed to 70 minutes against a 35-minute target. 2 of 4 active queue tokens sit in Cardiology.',
      action: 'Open 2 express slots on Dr. Rao’s list and route stable follow-ups to General Medicine.' },
    { id: 'i_02', agent: 'Coordinator AI', severity: 'warning', title: 'ICU at 81% occupancy',
      detail: '13 of 16 ICU beds occupied with 2 predicted admissions within 6 hours based on triage scores.',
      action: 'Prepare 2 step-down transfers from Cardiac Care to free surge capacity.' },
    { id: 'i_03', agent: 'Coordinator AI', severity: 'warning', title: 'Nursing load imbalance',
      detail: 'Priya Nair is carrying 84% load across 5 open tasks while Arjun Verma sits at 24%.',
      action: 'Reassign 2 low-acuity vitals tasks to Arjun Verma before the evening shift.' },
    { id: 'i_04', agent: 'Coordinator AI', severity: 'info', title: 'Documentation time down',
      detail: 'AI-drafted notes cut average documentation time from 13.5 hrs/week to an estimated 4.8 hrs/week.',
      action: 'Enable auto-summary for all OPD consults to extend the saving.' },
  ];

  const notifications = [
    { id: 'nt_01', ts: minutesAgo(6), patientId: 'p_008', channel: 'WhatsApp', status: 'delivered', template: 'Check-in confirmed', body: 'Your token is OPD-107. Estimated wait 12 min. Please proceed to Block B, Level 2.' },
    { id: 'nt_02', ts: minutesAgo(18), patientId: 'p_004', channel: 'SMS', status: 'delivered', template: 'Queue called', body: 'Token OPD-101, please proceed to Cardiology Room 04. Dr. Kavya Rao is ready.' },
    { id: 'nt_03', ts: minutesAgo(26), patientId: 'p_002', channel: 'WhatsApp', status: 'delivered', template: 'Lab reminder', body: 'Your lipid profile and HbA1c are in progress. Report will be shared in-app within 40 min.' },
    { id: 'nt_04', ts: minutesAgo(62), patientId: 'p_003', channel: 'Email', status: 'opened', template: 'Discharge summary', body: 'Your discharge summary and prescription are attached. Follow-up in 7 days.' },
  ];

  const payments = [
    { id: 'py_01', patientId: 'p_002', amount: 8450, method: 'Insurance — HDFC Ergo', status: 'settled', ts: minutesAgo(50) },
    { id: 'py_02', patientId: 'p_001', amount: 1200, method: 'UPI', status: 'settled', ts: minutesAgo(44) },
    { id: 'py_03', patientId: 'p_004', amount: 24600, method: 'PM-JAY (govt.)', status: 'pending', ts: minutesAgo(30) },
    { id: 'py_04', patientId: 'p_006', amount: 950, method: 'Cash', status: 'settled', ts: minutesAgo(14) },
    { id: 'py_05', patientId: 'p_007', amount: 4300, method: 'Insurance — Ayushman', status: 'processing', ts: minutesAgo(9) },
  ];

  const audit = [
    { id: 'au_01', ts: minutesAgo(95), actor: 'Reception AI', action: 'Created patient record MRN-48210', entity: 'MRN-48210' },
    { id: 'au_02', ts: minutesAgo(70), actor: 'Reception AI', action: 'Created patient record MRN-48211', entity: 'MRN-48211' },
    { id: 'au_03', ts: minutesAgo(34), actor: 'Records AI', action: 'Extracted 11 fields from intake form', entity: 'MRN-48213' },
    { id: 'au_04', ts: minutesAgo(26), actor: 'Records AI', action: 'Flagged critical lab value', entity: 'NT-proBNP' },
    { id: 'au_05', ts: minutesAgo(16), actor: 'Dr. Kavya Rao', action: 'Signed AI-drafted consultation note', entity: 'MRN-48213' },
  ];

  return {
    seededAt: now(),
    agents,
    users,
    patients,
    queue,
    appointments,
    tasks,
    vitals,
    labs,
    prescriptions,
    notes,
    activity,
    beds,
    revenue,
    throughput,
    insights,
    notifications,
    payments,
    audit,
    counters: { token: 107, mrn: 48217, rx: 2 },
  };
}

/* --------------------------------------------------------------- loading */

/**
 * Register where committed state goes. Node passes a disk writer, the browser
 * passes a localStorage writer. Called once per environment at startup.
 */
export function setPersistence(fn) {
  persist = typeof fn === 'function' ? fn : null;
}

/** Replace state with a previously persisted snapshot, backfilling any keys
 *  that a newer build added (so old saved data still boots). */
export function hydrate(raw) {
  if (!raw || typeof raw !== 'object') return resetDb();
  state = raw;
  const fresh = seed();
  for (const key of Object.keys(fresh)) {
    if (state[key] === undefined) state[key] = fresh[key];
  }
  return state;
}

function save() {
  if (!persist) return;
  try {
    persist(state);
  } catch (err) {
    if (!warned) {
      warned = true;
      console.warn(`  !  persistence unavailable (${err.code || err.message}). Running in memory only — state resets on restart.`);
    }
  }
}

export function db() {
  if (!state) state = seed();
  return state;
}

export function commit() {
  save();
  return state;
}

export function resetDb() {
  state = seed();
  save();
  return state;
}

export { uid, now, iso, dateOnly, minutesAgo };
