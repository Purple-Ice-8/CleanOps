];

// ─── STATE ────────────────────────────────────────────────────────────────────
let currentEmployee = null;  // { id, name, role, avatar, email }
let currentJob = null;  // { id, title, address, time, type }
let jobState = 'idle'; // 'idle' | 'started' | 'completed'

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Fetch employees for demo hints
    const employees = await window.DataService.fetchEmployees();
    renderDemoEmails(employees);
    setDateLabel();
});

function setDateLabel() {
    const now = new Date();
    const opts = { weekday: 'long', month: 'long', day: 'numeric' };
    const label = now.toLocaleDateString('en-US', opts);
    const el = document.getElementById('jobDate');
    if (el) el.textContent = label;
}

// ─── DEMO EMAIL CHIPS ─────────────────────────────────────────────────────────
function renderDemoEmails(employees) {
    const container = document.getElementById('demoEmails');
    if (!container) return;
    const preview = employees.slice(0, 5);
    container.innerHTML = preview.map(emp => `
    <div class="demo-email-chip" onclick="quickLogin('${emp.email}')">
      <div>
        <div class="demo-email-chip-name">${emp.name}</div>
        <div style="font-size:12px;color:var(--text-muted)">${emp.email}</div>
      </div>
      <span class="demo-chip-arrow">→</span>
    </div>
  `).join('');
}

function quickLogin(email) {
    document.getElementById('emailInput').value = email;
    handleLogin(null);
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
async function handleLogin(event) {
    if (event) event.preventDefault();

    const input = document.getElementById('emailInput');
    const email = input.value.trim().toLowerCase();
    const btn = document.getElementById('loginBtn');
    const error = document.getElementById('loginError');

    try {
        const emp = await window.DataService.getUserByEmail(email);
        if (!emp || emp.role !== 'employee') {
            error.style.display = 'block';
            input.focus();
            return;
        }
        error.style.display = 'none';

        btn.disabled = true;
        document.getElementById('loginBtnText').textContent = 'Loading…';

        // Add avatar helper
        emp.avatar = emp.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        
        currentEmployee = emp;
        await loadJobForEmployee(emp);
        
        btn.disabled = false;
        document.getElementById('loginBtnText').textContent = 'View My Schedule →';
    } catch (err) {
        console.error("Login failed:", err);
        error.textContent = "⚠️ Connection error. Try again.";
        error.style.display = 'block';
    }
}

// ─── LOAD JOB FOR EMPLOYEE ────────────────────────────────────────────────────
async function loadJobForEmployee(emp) {
    try {
        const jobs = await window.DataService.fetchJobs();
        // Find job where this employee is assigned
        const job = jobs.find(j => j.job_assignments.some(a => a.employee_id === emp.user_id));
        
        if (job) {
            currentJob = {
                id: job.job_id,
                title: `${job.clients?.first_name || ''} ${job.clients?.last_name || ''}`.trim(),
                address: job.address,
                time: format12h(job.scheduled_time.substring(0, 5)),
                type: job.clean_type
            };
            jobState = job.status;
        } else {
            currentJob = null;
            jobState = 'idle';
        }

        renderJobScreen();
        showScreen('screenJob');
        
        // Setup subscription for this job
        setupRealtimeForJob();
    } catch (err) {
        console.error("Failed to load job:", err);
    }
}

function format12h(time24) {
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
}

function setupRealtimeForJob() {
    window.supabase
        .channel('job-updates')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'cleaning_jobs', 
            filter: `job_id=eq.${currentJob?.id}` 
        }, payload => {
            jobState = payload.new.status;
            renderJobScreen();
        })
        .subscribe();
}

// ─── RENDER JOB SCREEN ────────────────────────────────────────────────────────
function renderJobScreen() {
    if (!currentEmployee || !currentJob) return;

    // Header
    document.getElementById('jobEmpAvatar').textContent = currentEmployee.avatar;
    document.getElementById('jobEmpName').textContent = currentEmployee.name;
    document.getElementById('jobEmpRole').textContent = currentEmployee.role;

    // Job card
    document.getElementById('jobType').textContent = currentJob.type;
    document.getElementById('jobClient').textContent = currentJob.title;
    document.getElementById('jobAddress').textContent = currentJob.address;
    document.getElementById('jobTime').textContent = currentJob.time;
    document.getElementById('jobType2').textContent = currentJob.type;

    // Maps link
    const query = encodeURIComponent(currentJob.address);
    document.getElementById('mapsLink').href = `https://maps.google.com/?q=${query}`;

    // Restore state if already started/completed
    if (jobState === 'started') {
        setButtonComplete();
        showStatusBanner('Job in progress…');
    } else if (jobState === 'completed') {
        // Already done — show success screen directly
        showSuccessScreen();
        return;
    } else {
        setButtonStart();
        document.getElementById('statusBanner').style.display = 'none';
    }

    // Role-based restriction: Only Lead can complete
    if (currentEmployee.role !== 'Lead Cleaner' && jobState !== 'completed') {
        const btn = document.getElementById('actionBtn');
        if (jobState === 'started') {
            btn.disabled = true;
            btn.style.opacity = '0.6';
            document.getElementById('actionBtnText').textContent = 'Waiting for Lead...';
        }
    } else {
        document.getElementById('actionBtn').disabled = false;
        document.getElementById('actionBtn').style.opacity = '1';
    }
}

// ─── ACTION BUTTON ────────────────────────────────────────────────────────────
async function handleAction() {
    if (!currentJob) return;

    try {
        if (jobState === 'scheduled' || jobState === 'idle') {
            // START JOB
            jobState = 'in_progress';
            await window.DataService.updateJob(currentJob.id, { status: 'in_progress' });
            await window.DataService.addLog(currentEmployee.user_id, 'started', 'job', currentJob.id);
            renderJobScreen();
        } else if (jobState === 'in_progress') {
            // MARK AS COMPLETED
            jobState = 'completed';
            await window.DataService.updateJob(currentJob.id, { 
                status: 'completed',
                completion_time: new Date().toISOString()
            });
            await window.DataService.addLog(currentEmployee.user_id, 'completed', 'job', currentJob.id);
            showSuccessScreen();
        }
    } catch (err) {
        console.error("Action failed:", err);
    }
}

function logEvent(type, user, msg) {
    try {
        const state = getStoredState();
        if (!state.events) state.events = [];
        state.events.push({
            type,
            user,
            msg,
            timestamp: Date.now()
        });
        // Keep only last 50 events
        if (state.events.length > 50) state.events.shift();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
}

function setButtonStart() {
    const btn = document.getElementById('actionBtn');
    btn.className = 'btn-action btn-start';
    document.getElementById('actionBtnIcon').textContent = '▶';
    document.getElementById('actionBtnText').textContent = 'START JOB';
}

function setButtonComplete() {
    const btn = document.getElementById('actionBtn');
    btn.className = 'btn-action btn-complete';
    document.getElementById('actionBtnIcon').textContent = '✔';
    document.getElementById('actionBtnText').textContent = 'MARK AS COMPLETED';
}

function showStatusBanner(msg) {
    const banner = document.getElementById('statusBanner');
    document.getElementById('statusBannerText').textContent = msg;
    banner.style.display = 'flex';
}

// ─── SUCCESS SCREEN ───────────────────────────────────────────────────────────
function showSuccessScreen() {
    if (currentJob) {
        document.getElementById('recapClient').textContent = currentJob.title;
    }
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    document.getElementById('recapTime').textContent = `Completed at ${timeStr}`;

    showScreen('screenSuccess');
    setTimeout(spawnConfetti, 100);
}

// ─── CONFETTI ─────────────────────────────────────────────────────────────────
function spawnConfetti() {
    const container = document.getElementById('confetti');
    if (!container) return;
    container.innerHTML = '';
    const colors = ['#6c63ff', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#a78bfa', '#34d399'];
    for (let i = 0; i < 60; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        const size = 6 + Math.random() * 10;
        piece.style.cssText = `
      left: ${Math.random() * 100}%;
      top: -20px;
      width: ${size}px;
      height: ${size}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation: confetti-fall ${1.5 + Math.random() * 2}s ${Math.random() * 0.8}s linear both;
      opacity: ${0.7 + Math.random() * 0.3};
    `;
        container.appendChild(piece);
    }
}

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
function handleLogout() {
    currentEmployee = null;
    currentJob = null;
    jobState = 'idle';
    document.getElementById('emailInput').value = '';
    showScreen('screenLogin');
}

// ─── SCREEN TRANSITIONS ───────────────────────────────────────────────────────
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) {
        // Slight delay so the CSS transition fires
        requestAnimationFrame(() => {
            requestAnimationFrame(() => target.classList.add('active'));
        });
    }
}

// ─── LOCALSTORAGE SYNC REMOVED ───────────────────────────────────────────────
