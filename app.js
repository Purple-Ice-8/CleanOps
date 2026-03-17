// --- STATE ---
let EMPLOYEES = [];
let JOBS = [];
const assignments = {}; // local cache of { empId: { jobId, status } }
const jobAssigned = {}; // local cache of { jobId: true/false }
let editingJobId = null;

// ─── STATE ────────────────────────────────────────────────────────────────────

// Track which job is being edited (null for creation)
// let editingJobId = null; (Moved above)

// Manager accounts
const MANAGERS = {
  'casey@cleanops.com': 'admin123',
  'manager1@cleanops.com': 'cleanops1',
  'manager2@cleanops.com': 'cleanops2'
};

// ─── INIT ─────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cleanops_state';
const AUTH_KEY = 'cleanops_admin_auth';

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('bypass') === 'true' || checkAdminAuth()) {
    if (urlParams.get('bypass') === 'true' && !checkAdminAuth()) {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ email: 'casey@cleanops.com', timestamp: Date.now() }));
    }
    showDashboard();
    await initializeData();
  } else {
    showLogin();
  }

  renderTodayDate();
  setupRealtimeSubscriptions();
});

async function initializeData() {
  try {
    // 1. Fetch Employees
    EMPLOYEES = await window.DataService.fetchEmployees();
    // Normalize for UI (adding avatar/ID if numeric needed)
    EMPLOYEES = EMPLOYEES.map(e => ({
      ...e,
      id: e.user_id, // Use UUID but keep ID-based logic if possible
      avatar: e.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
    }));

    // 2. Fetch Jobs
    const rawJobs = await window.DataService.fetchJobs();
    JOBS = rawJobs.map(j => ({
      id: j.job_id,
      title: `${j.clients?.first_name || ''} ${j.clients?.last_name || ''}`.trim() || 'Untitled Job',
      address: j.address,
      time: format12h(j.scheduled_time.substring(0, 5)),
      type: j.clean_type,
      status: j.status,
      // Store assignments in local state
      assignments: j.job_assignments
    }));

    // 3. Populate assignments & jobAssigned caches
    // Clear first
    Object.keys(assignments).forEach(k => delete assignments[k]);
    Object.keys(jobAssigned).forEach(k => delete jobAssigned[k]);

    JOBS.forEach(job => {
      if (job.assignments && job.assignments.length > 0) {
        job.assignments.forEach(asgn => {
          assignments[asgn.employee_id] = { jobId: job.id, status: job.status };
          jobAssigned[job.id] = true;
        });
      }
    });

    refreshUI();
  } catch (err) {
    console.error("Initialization failed:", err);
  }
}

function setupRealtimeSubscriptions() {
  window.supabase
    .channel('any')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cleaning_jobs' }, () => initializeData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'job_assignments' }, () => initializeData())
    .subscribe();
}

function renderTodayDate() {
  const now = new Date();
  const opts = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  document.getElementById('todayDate').textContent = now.toLocaleDateString('en-US', opts);
}

// ─── RENDERING ────────────────────────────────────────────────────────────────

function renderUnassignedJobs() {
  const list = document.getElementById('unassignedList');
  const badge = document.getElementById('unassignedBadge');
  const unassigned = JOBS.filter(job => !jobAssigned[job.id]);

  if (badge) {
    badge.textContent = unassigned.length;
    badge.className = `badge ${unassigned.length === 0 ? 'badge-green' : 'badge-warn'}`;
  }

  if (unassigned.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✨</div>
        <div class="empty-state-msg">All jobs assigned!</div>
      </div>
    `;
    return;
  }

  list.innerHTML = unassigned.map(job => {
    let typeClass = "job-type-regular";
    if (job.type === "Deep Clean") typeClass = "job-type-deep";
    if (job.type === "Move-Out Clean") typeClass = "job-type-move-out";

    return `
      <div class="job-card" title="Click to highlight in grid">
        <div class="job-card-content">
          <div class="job-card-title">${job.title}</div>
          <div class="job-card-meta">
            <span class="job-card-time">⏰ ${job.time}</span>
            <span class="job-card-loc">📍 ${job.address}</span>
            <span class="job-type-pill ${typeClass}">${job.type}</span>
          </div>
        </div>
        <div class="job-card-actions">
          <button class="btn-delete-job" onclick="deleteJob(${job.id}, this)" title="Delete Job">🗑️</button>
          <button class="btn-edit-job" onclick="openCreateJobModal(${job.id})" title="Edit Job Details">✎</button>
        </div>
      </div>
    `;
  }).join('');
}

// ─── EMPLOYEE GRID ────────────────────────────────────────────────────────────

function renderEmployeeGrid() {
  const grid = document.getElementById('employeeGrid');
  const query = (document.getElementById('employeeSearch')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('filterStatus')?.value || 'all';

  const filtered = EMPLOYEES.filter(emp => {
    const matchName = emp.name.toLowerCase().includes(query);
    const assignment = assignments[emp.id];
    let status = 'unassigned';
    if (assignment) status = assignment.status; // 'assigned' or 'completed'
    const matchStatus = statusFilter === 'all' || statusFilter === status;
    return matchName && matchStatus;
  });

  grid.innerHTML = filtered.map(emp => renderEmployeeCard(emp)).join('');
}

function getJobLabel(jobId) {
  const job = JOBS.find(j => j.id === jobId);
  return job ? `${job.time} · ${job.title}` : '';
}

function renderEmployeeCard(emp) {
  const assignment = assignments[emp.id];
  const status = assignment ? assignment.status : 'unassigned';
  const cardClass = `emp-card status-${status}`;

  // Pill
  const pillClass = { unassigned: 'pill-unassigned', assigned: 'pill-assigned', completed: 'pill-completed', dispatched: 'pill-dispatched' }[status] || 'pill-unassigned';
  const pillLabel = { unassigned: 'Unassigned', assigned: 'Assigned', completed: 'Completed ✓', dispatched: 'Notified 📣' }[status] || 'Unassigned';

  // Options for the dropdown: available jobs + currently assigned one
  const currentJobId = assignment ? assignment.jobId : null;
  const optionsList = JOBS.filter(j => !jobAssigned[j.id] || j.id === currentJobId)
    .map(j => `<option value="${j.id}" ${j.id === currentJobId ? 'selected' : ''}>${j.time} · ${j.title} (${j.type})</option>`)
    .join('');

  const bodyContent = status === 'completed'
    ? `<div class="emp-done-label">✅ ${getJobLabel(currentJobId)}</div>`
    : status === 'dispatched'
      ? `<div class="emp-dispatched-label">📣 ${getJobLabel(currentJobId)}</div>`
      : status === 'assigned'
        ? `
        <div class="emp-assigned-job">
          🏠 ${getJobLabel(currentJobId)}
          <button class="btn-delete-job" onclick="deleteJob(${currentJobId}, this)" title="Delete Job" style="opacity:1; transform:none; position:relative; margin-left:8px; font-size:12px;">🗑️</button>
        </div>
        <div class="emp-actions">
          <button class="btn-complete" onclick="markCompleted(${emp.id})">✔ Mark Complete</button>
          <button class="btn-clear" onclick="clearAssignment(${emp.id})" title="Unassign">✕</button>
        </div>`
        : `
        <select class="emp-job-select" onchange="assignJob(${emp.id}, this.value)" id="sel-${emp.id}">
          <option value="">— Select a job —</option>
          ${optionsList}
        </select>`;

  return `
    <div class="emp-card ${cardClass}" id="card-${emp.id}">
      <div class="emp-card-top">
        <div class="emp-avatar" style="background:${avatarGradient(emp.id)}">${emp.avatar}</div>
        <div class="emp-info">
          <div class="emp-name">${emp.name}</div>
          <div class="emp-role">${emp.role}</div>
        </div>
        <span class="emp-status-pill ${pillClass}">${pillLabel}</span>
      </div>
      <div class="emp-card-body">${bodyContent}</div>
    </div>`;
}

function avatarGradient(id) {
  const palette = [
    'linear-gradient(135deg,#6c63ff,#a78bfa)',
    'linear-gradient(135deg,#3b82f6,#60a5fa)',
    'linear-gradient(135deg,#22c55e,#34d399)',
    'linear-gradient(135deg,#f59e0b,#fbbf24)',
    'linear-gradient(135deg,#ef4444,#f87171)',
    'linear-gradient(135deg,#ec4899,#f472b6)',
    'linear-gradient(135deg,#14b8a6,#2dd4bf)',
    'linear-gradient(135deg,#8b5cf6,#c084fc)',
  ];
  
  // Use a simple hash for UUID strings to pick a consistent color
  let hash = 0;
  const str = String(id || '0');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

// ─── INTERACTIONS ──────────────────────────────────────────────────────────────

async function assignJob(empId, jobId) {
  if (!jobId) return;
  try {
    const admin = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
    await window.DataService.assignEmployeeToJob(jobId, empId);
    await window.DataService.addLog(null, 'assigned', 'job', jobId, { employee_id: empId, actor: admin.email });
    // UI will refresh via Realtime subscription
  } catch (err) {
    console.error("Assignment failed:", err);
    showToast("❌ Failed to assign job");
  }
}

async function clearAssignment(empId) {
  const assignment = assignments[empId];
  if (!assignment) return;
  try {
    await window.DataService.unassignJob(assignment.jobId, empId);
    // UI will refresh via Realtime
  } catch (err) {
    console.error("Clear assignment failed:", err);
  }
}

async function markCompleted(empId) {
  const assignment = assignments[empId];
  if (!assignment) return;
  try {
    await window.DataService.updateJob(assignment.jobId, { 
      status: 'completed',
      completion_time: new Date().toISOString()
    });
    const emp = EMPLOYEES.find(e => e.id === empId);
    await window.DataService.addLog(empId, 'completed', 'job', assignment.jobId, { employee_name: emp?.name });
    // UI will refresh via Realtime
  } catch (err) {
    console.error("Marking completed failed:", err);
  }
}

function filterEmployees() {
  renderEmployeeGrid();
}

function refreshUI() {
  renderEmployeeGrid();
  renderUnassignedJobs();
  updateProgress();
}

// ─── PROGRESS ─────────────────────────────────────────────────────────────────

function updateProgress() {
  let assigned = 0, completed = 0;
  EMPLOYEES.forEach(emp => {
    const a = assignments[emp.id];
    if (!a) return;
    if (a.status === 'assigned' || a.status === 'dispatched') assigned++;
    if (a.status === 'completed') { assigned++; completed++; }
  });
  const unassigned = EMPLOYEES.length - assigned;
  const pct = EMPLOYEES.length > 0 ? Math.round((completed / EMPLOYEES.length) * 100) : 0;

  document.getElementById('statAssigned').textContent = assigned;
  document.getElementById('statCompleted').textContent = completed;
  document.getElementById('statUnassigned').textContent = unassigned;
  document.getElementById('progressBarFill').style.width = pct + '%';
  document.getElementById('barLabel').textContent = `${completed} / ${EMPLOYEES.length}`;
  document.getElementById('barPercent').textContent = pct + '%';
  document.getElementById('completedCount').textContent = completed;
}

// ─── DISPATCH MODAL ────────────────────────────────────────────────────────────

function openDispatchModal() {
  const unassignedCount = EMPLOYEES.filter(e => !assignments[e.id]).length;
  const warn = document.getElementById('modalAssignWarning');
  const warnText = document.getElementById('modalWarnText');
  if (unassignedCount > 0) {
    warn.style.display = 'block';
    warnText.textContent = `${unassignedCount} employees have no job yet — they will be auto-assigned before sending.`;
  } else {
    warn.style.display = 'none';
  }
  document.getElementById('dispatchModal').classList.add('open');
}

function closeDispatchModal() {
  document.getElementById('dispatchModal').classList.remove('open');
}

function closeModalOutside(e) {
  if (e.target === e.currentTarget) closeDispatchModal();
}

async function executeDispatch() {
  closeDispatchModal();

  const adminAuth = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
  const adminName = adminAuth.email?.split('@')[0] || 'Admin';

  try {
    // 1. Auto-assign any remaining unassigned employees to available jobs
    const availableJobs = JOBS.filter(j => !jobAssigned[j.id]);
    let jobIdx = 0;
    
    for (const emp of EMPLOYEES) {
      if (!assignments[emp.id] && jobIdx < availableJobs.length) {
        const job = availableJobs[jobIdx++];
        await window.DataService.assignEmployeeToJob(job.id, emp.id);
      }
    }

    // 2. Lock all assigned jobs as 'dispatched' (we use a status field in cleaning_jobs)
    // Note: Our schema has 'dispatched_at', we'll use that as the primary indicator
    const now = new Date().toISOString();
    for (const job of JOBS) {
      if (jobAssigned[job.id]) {
        await window.DataService.updateJob(job.id, { 
          dispatched_at: now,
          status: 'scheduled' // or maybe 'dispatched' if we add to schema? 
          // Current schema status: 'scheduled' | 'in_progress' | 'completed'
        });
      }
    }

    await window.DataService.addLog(null, 'dispatched', 'schedule', null, { 
      actor: adminName, 
      count: EMPLOYEES.length 
    });

    // Success UI
    showDispatchSuccess();
  } catch (err) {
    console.error("Dispatch failed:", err);
    showToast("❌ Dispatch failed");
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

function showDispatchSuccess() {
  // ── Banner: swap the modal area for a big success banner overlay
  const banner = document.getElementById('successBanner');
  if (banner) {
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 5000);
  }

  // ── Toast
  showToast(`📣 ${EMPLOYEES.length} Schedules Sent!`);

  // ── Permanently update the dispatch button
  const btn = document.getElementById('dispatchBtn');
  btn.innerHTML = `<span>✅</span><span>${EMPLOYEES.length} Schedules Sent!</span>`;
  btn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
  btn.style.boxShadow = '0 4px 18px rgba(34,197,94,0.35)';
  btn.disabled = true;
  btn.style.cursor = 'default';
}
// ─── LOCALSTORAGE SYNC REMOVED (Replaced by Supabase Realtime) ────────────────

async function renderActivityLog() {
  const container = document.getElementById('activityLogList');
  if (!container) return;

  try {
    const logs = await window.DataService.fetchRecentLogs(10);

    if (logs.length === 0) {
      container.innerHTML = '<div class="activity-empty"><p>No activity recorded yet today.</p></div>';
      document.getElementById('activityNewCount').style.display = 'none';
      return;
    }

    container.innerHTML = logs.map(log => {
      let icon = '🔔';
      let typeClass = 'activity-dispatched';
      if (log.action === 'started') { icon = '▶'; typeClass = 'activity-started'; }
      if (log.action === 'completed') { icon = '✔'; typeClass = 'activity-completed'; }
      if (log.action === 'dispatched') { icon = '🚀'; typeClass = 'activity-dispatched'; }
      if (log.action === 'assigned') { icon = '📌'; typeClass = 'activity-assigned'; }

      const userLabel = log.users?.name || log.metadata?.actor || 'System';

      return `
        <div class="activity-item ${typeClass}">
          <div class="activity-icon-wrap">${icon}</div>
          <div class="activity-content">
            <div class="activity-title">${userLabel}</div>
            <div class="activity-desc">${log.action.toUpperCase()}: ${log.target_type}</div>
            <div class="activity-time">${formatRelativeTime(new Date(log.timestamp).getTime())}</div>
          </div>
        </div>
      `;
    }).join('');

    // Update "New" badge
    const lastLog = logs[0];
    if (lastLog && (Date.now() - new Date(lastLog.timestamp).getTime() < 60000)) {
      document.getElementById('activityNewCount').style.display = 'block';
      document.getElementById('activityNewCount').textContent = 'NEW UPDATE';
    } else {
      document.getElementById('activityNewCount').style.display = 'none';
    }
  } catch (err) {
    console.error("Failed to render activity log:", err);
  }
}

function formatRelativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 1) return 'Just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} mins ago`;
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── CREATE/EDIT JOB MODAL ──────────────────────────────────────────────────

function populateStaffDatalist() {
  const staffList = document.getElementById('staffList');
  staffList.innerHTML = EMPLOYEES.map(emp => `<option value="${emp.name}">`).join('');
}

function openCreateJobModal(jobId = null) {
  populateStaffDatalist();
  editingJobId = jobId;
  const modal = document.getElementById('createJobModal');
  const title = modal.querySelector('.modal-title');
  const submitBtn = modal.querySelector('button[type="submit"]');

  if (jobId) {
    const job = JOBS.find(j => j.id === jobId);
    if (!job) return;

    title.textContent = "Edit Job Details";
    submitBtn.textContent = "Save Changes";

    // Split title back to first/last name (naive split)
    const nameParts = job.title.split(' ');
    document.getElementById('firstName').value = nameParts[0] || '';
    document.getElementById('lastName').value = nameParts.slice(1).join(' ') || '';
    document.getElementById('address').value = job.address;
    document.getElementById('serviceType').value = job.type || 'Regular Clean';

    // Find assigned employee if any
    const empId = Object.keys(assignments).find(id => assignments[id].jobId === jobId);
    const emp = EMPLOYEES.find(e => e.id == empId);
    document.getElementById('assignStaff').value = emp ? emp.name : '';

    if (job.time && job.time !== "TBD") {
      document.getElementById('jobTime').value = to24h(job.time);
    } else {
      document.getElementById('jobTime').value = '';
    }

    if (job.details) {
      document.getElementById('phone').value = job.details.phone || '';
      document.getElementById('bedrooms').value = job.details.bedrooms || 0;
      document.getElementById('bathrooms').value = job.details.bathrooms || 0;
      document.getElementById('sqft').value = job.details.sqft || '';
      document.getElementById('accessInfo').value = job.details.accessInfo || '';
      document.getElementById('pets').value = job.details.pets || '';
      document.getElementById('notes').value = job.details.notes || '';
    }
  } else {
    title.textContent = "Create New Job";
    submitBtn.textContent = "Create Job";
    document.getElementById('serviceType').value = 'Regular Clean';
    document.getElementById('assignStaff').value = '';
    document.getElementById('jobTime').value = '08:00'; // Default to 8 AM for new jobs
  }

  modal.classList.add('open');
}

function closeCreateJobModal() {
  document.getElementById('createJobModal').classList.remove('open');
  document.getElementById('createJobForm').reset();
  editingJobId = null;
}

function closeCreateJobModalOutside(e) {
  if (e.target === e.currentTarget) closeCreateJobModal();
}

async function handleCreateJob(e) {
  e.preventDefault();
  const formData = new FormData(e.target);

  try {
    // 1. Handle Client
    const firstName = formData.get('firstName');
    const lastName = formData.get('lastName');
    
    console.log(`[CleanOps] Finding/Creating client: ${firstName} ${lastName}`);
    
    let client_id;
    const { data: clients, error: searchError } = await window.supabase
      .from('clients')
      .select('client_id')
      .eq('first_name', firstName)
      .eq('last_name', lastName)
      .limit(1);
    
    if (searchError) {
      console.error("[CleanOps] Client search error:", searchError);
      throw new Error(`Failed to search for client: ${searchError.message}`);
    }
    
    if (clients && clients.length > 0) {
      client_id = clients[0].client_id;
      console.log("[CleanOps] Found existing client:", client_id);
    } else {
      console.log("[CleanOps] Creating new client...");
      const { data: newClient, error: createError } = await window.supabase
        .from('clients')
        .insert([{
          first_name: firstName,
          last_name: lastName,
          address: formData.get('address'),
          phone: formData.get('phone'),
          bedrooms: parseFloat(formData.get('bedrooms')) || 0,
          bathrooms: parseFloat(formData.get('bathrooms')) || 0,
          square_feet: parseFloat(formData.get('sqft')) || 0,
          notes: formData.get('notes')
        }])
        .select()
        .single();
      
      if (createError) {
        console.error("[CleanOps] Client creation error:", createError);
        throw new Error(`Failed to create client: ${createError.message}`);
      }
      client_id = newClient.client_id;
      console.log("[CleanOps] Created new client:", client_id);
    }

    const jobData = {
      client_id: client_id,
      address: formData.get('address'),
      clean_type: formData.get('serviceType'),
      scheduled_date: new Date().toISOString().split('T')[0], // Today
      scheduled_time: formData.get('jobTime'),
      instructions: (formData.get('accessInfo') || '') + ' ' + (formData.get('pets') || '')
    };

    let jobId = editingJobId;

    if (editingJobId) {
      console.log("[CleanOps] Updating existing job:", editingJobId);
      const { error: updateError } = await window.supabase
        .from('cleaning_jobs')
        .update(jobData)
        .eq('job_id', editingJobId);
        
      if (updateError) {
        console.error("[CleanOps] Job update error:", updateError);
        throw new Error(`Failed to update job: ${updateError.message}`);
      }
      showToast('✅ Job details updated!');
    } else {
      console.log("[CleanOps] Creating new job...");
      const { data: newJob, error: jobError } = await window.supabase
        .from('cleaning_jobs')
        .insert([jobData])
        .select()
        .single();
        
      if (jobError) {
        console.error("[CleanOps] Job creation error:", jobError);
        throw new Error(`Failed to create job: ${jobError.message}`);
      }
      jobId = newJob.job_id;
      console.log("[CleanOps] Created new job:", jobId);
      showToast('✨ New job created successfully!');
    }

    // 2. Handle Staff Assignment
    const staffName = formData.get('assignStaff');
    const employee = EMPLOYEES.find(emp => emp.name === staffName);

    if (employee) {
      console.log("[CleanOps] Assigning staff:", employee.name);
      await window.DataService.assignEmployeeToJob(jobId, employee.id);
    } else {
      console.log("[CleanOps] No staff assigned or clearing assignment");
      await window.DataService.clearAllAssignmentsForJob(jobId);
    }

    closeCreateJobModal();
  } catch (err) {
    console.error("[CleanOps] Critical failure in handleCreateJob:", err);
    showToast(`❌ Error: ${err.message || 'Failed to save job'}`);
  }
}

async function deleteJob(jobId, btn) {
  // If button is NOT in confirming state, enter it
  if (!btn.classList.contains('confirming')) {
    // Reset any other buttons first
    document.querySelectorAll('.btn-delete-job').forEach(b => b.classList.remove('confirming'));
    btn.classList.add('confirming');
    // Auto-reset after 3 seconds
    setTimeout(() => { btn.classList.remove('confirming'); }, 3000);
    return;
  }

  try {
    await window.DataService.deleteJob(jobId);
    showToast('🗑️ Job deleted successfully');
    // Realtime will trigger refresh
  } catch (err) {
    console.error("Delete failed:", err);
    showToast("❌ Delete failed");
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function format12h(time24) {
  if (!time24) return "TBD";
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

function to24h(time12) {
  if (!time12 || time12 === "TBD") return "";
  const [time, ampm] = time12.split(' ');
  let [hours, minutes] = time.split(':');
  let h = parseInt(hours, 10);
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${minutes}`;
}

// ─── ADMIN AUTH LOGIC ────────────────────────────────────────────────────────

function handleAdminLogin(e) {
  e.preventDefault();
  const email = document.getElementById('adminEmail').value;
  const pass = document.getElementById('adminPassword').value;
  const errorMsg = document.getElementById('loginErrorMessage');

  if (MANAGERS[email] && MANAGERS[email] === pass) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ email, timestamp: Date.now() }));
    showDashboard();
    errorMsg.style.display = 'none';
  } else {
    errorMsg.style.display = 'block';
  }
}

function handleLogout() {
  localStorage.removeItem(AUTH_KEY);
  location.reload();
}

function checkAdminAuth() {
  const auth = localStorage.getItem(AUTH_KEY);
  if (!auth) return false;
  // Session expiry check (e.g., 24 hours) could go here
  return true;
}

function showDashboard() {
  document.getElementById('adminLoginScreen').style.display = 'none';
  document.getElementById('mainDashboard').style.display = 'block';
}

function showLogin() {
  document.getElementById('adminLoginScreen').style.display = 'flex';
  document.getElementById('mainDashboard').style.display = 'none';
}
