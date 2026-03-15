/**
 * CLEAN OPS - DATA SERVICE
 * Abstraction layer for Supabase operations using the global 'supabase' client.
 */

const DataService = {
  // --- USERS / STAFF ---
  async fetchEmployees() {
    const { data, error } = await window.supabase
      .from('users')
      .select('*')
      .eq('role', 'employee')
      .eq('active_status', true);
    if (error) throw error;
    return data;
  },

  async getUserByEmail(email) {
    const { data, error } = await window.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // --- CLIENTS ---
  async fetchClients() {
    const { data, error } = await window.supabase
      .from('clients')
      .select('*');
    if (error) throw error;
    return data;
  },

  // --- JOBS ---
  async fetchJobs() {
    // For this app, we're focusing on today's jobs or general daily view
    const { data, error } = await window.supabase
      .from('cleaning_jobs')
      .select(`
        *,
        clients (*),
        job_assignments (
          employee_id
        )
      `)
      .order('scheduled_time', { ascending: true });
    if (error) throw error;
    return data;
  },

  async createJob(jobData) {
    const { data, error } = await window.supabase
      .from('cleaning_jobs')
      .insert([jobData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateJob(jobId, updates) {
    const { data, error } = await window.supabase
      .from('cleaning_jobs')
      .update(updates)
      .eq('job_id', jobId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteJob(jobId) {
    const { error } = await window.supabase
      .from('cleaning_jobs')
      .delete()
      .eq('job_id', jobId);
    if (error) throw error;
  },

  // --- ASSIGNMENTS ---
  async assignEmployeeToJob(jobId, employeeId) {
    // Check if assignment exists
    const { data: existing } = await window.supabase
      .from('job_assignments')
      .select('*')
      .eq('job_id', jobId)
      .eq('employee_id', employeeId);
    
    if (existing && existing.length > 0) return existing[0];

    const { data, error } = await window.supabase
      .from('job_assignments')
      .insert([{ job_id: jobId, employee_id: employeeId }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async unassignJob(jobId, employeeId) {
    const { error } = await window.supabase
      .from('job_assignments')
      .delete()
      .eq('job_id', jobId)
      .eq('employee_id', employeeId);
    if (error) throw error;
  },

  async clearAllAssignmentsForJob(jobId) {
    const { error } = await window.supabase
      .from('job_assignments')
      .delete()
      .eq('job_id', jobId);
    if (error) throw error;
  },

  // --- SYSTEM LOGS ---
  async addLog(actorId, action, targetType, targetId, metadata = {}) {
    // actorId can be null for system actions
    const logData = {
      actor_user_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata
    };
    const { error } = await window.supabase
      .from('system_logs')
      .insert([logData]);
    if (error) console.error("Error logging event:", error);
  },

  async fetchRecentLogs(limit = 10) {
    const { data, error } = await window.supabase
      .from('system_logs')
      .select(`
        *,
        users (name)
      `)
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }
};

window.DataService = DataService;
