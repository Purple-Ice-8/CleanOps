-- CleanOps Supabase Schema

-- Cleanup (for re-runs)
DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS job_assignments CASCADE;
DROP TABLE IF EXISTS cleaning_jobs CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('manager', 'employee')),
  employee_role TEXT CHECK (employee_role IN ('Lead Cleaner', 'General Cleaner', 'Deep Specialist')),
  active_status BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Clients Table
CREATE TABLE clients (
  client_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  pets TEXT,
  gate_code TEXT,
  bedrooms NUMERIC DEFAULT 0,
  bathrooms NUMERIC DEFAULT 0,
  square_feet NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Cleaning Jobs Table
CREATE TABLE cleaning_jobs (
  job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(client_id),
  lead_employee_id UUID REFERENCES users(user_id),
  clean_type TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  scheduled_at TIMESTAMPTZ, -- Derived in logic
  address TEXT NOT NULL,
  instructions TEXT,
  caddy_number INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
  completion_time TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  dispatched_by UUID REFERENCES users(user_id),
  client_reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Job Assignments Table
CREATE TABLE job_assignments (
  job_assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES cleaning_jobs(job_id) ON DELETE CASCADE,
  employee_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, employee_id)
);

-- 5. System Logs Table
CREATE TABLE system_logs (
  log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id UUID REFERENCES users(user_id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  timestamp TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Realtime Configuration
ALTER PUBLICATION supabase_realtime ADD TABLE cleaning_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE job_assignments;

-- 6. Helper Functions for RLS
CREATE OR REPLACE FUNCTION is_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'manager'
    FROM users
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies (Initial Setup)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- 1. Users Policies
CREATE POLICY "Users can view themselves" ON users FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Managers full access on users" ON users FOR ALL USING (is_manager());

-- 2. Cleaning Jobs Policies
CREATE POLICY "Employees can view assigned jobs" ON cleaning_jobs
  FOR SELECT USING (
    job_id IN (
      SELECT job_id FROM job_assignments WHERE employee_id = auth.uid()
    ) OR lead_employee_id = auth.uid()
  );

CREATE POLICY "Managers full access on jobs" ON cleaning_jobs FOR ALL USING (is_manager());

-- 3. Job Assignments Policies
CREATE POLICY "Employees can view own assignments" ON job_assignments FOR SELECT USING (employee_id = auth.uid());
CREATE POLICY "Managers full access on assignments" ON job_assignments FOR ALL USING (is_manager());

-- 4. Clients Policies
CREATE POLICY "Managers full access on clients" ON clients FOR ALL USING (is_manager());

-- 5. System Logs Policies
CREATE POLICY "Managers full access on logs" ON system_logs FOR ALL USING (is_manager());
