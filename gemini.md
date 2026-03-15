# 📜 Project Constitution: CleanOps

## 🎯 North Star
Eliminate manual daily scheduling and job-status communication for a 20-employee cleaning company by providing a centralized system where employees view daily assignments and managers receive automatic job completion notifications. Goal: Reduce manual communication from 60 minutes to under 5 minutes.

## 🛠️ Architecture Invariants
1. **Separation of Concerns:** Business logic in `tools/`, orchestration in `architecture/`, state in Supabase.
2. **Deterministic Logic:** Avoid probabilistic branching in core business rules.
3. **Data-First:** No tool development without a defined schema in this document.
4. **Mobile First:** UI/UX optimized for speed and single-hand use (< 10 seconds to job view).
5. **Idempotency:** Reminders and notifications must have sent-state flags to prevent duplicates.
6. **Timezone:** All operations use business local time (e.g., America/Los_Angeles).

## 📊 JSON Data Schema (Supabase)

### Users
```json
{
  "user_id": "uuid",
  "name": "string",
  "email": "string",
  "phone": "string",
  "role": "string (manager | employee)",
  "employee_role": "string (Lead Cleaner | General Cleaner | Deep Specialist) (nullable)",
  "active_status": "boolean"
}
```

### Clients
```json
{
  "client_id": "uuid",
  "first_name": "string",
  "last_name": "string",
  "address": "string",
  "phone": "string",
  "email": "string",
  "pets": "string",
  "gate_code": "string",
  "bedrooms": "number",
  "bathrooms": "number",
  "square_feet": "number",
  "notes": "string"
}
```

### Cleaning Jobs
```json
{
  "job_id": "uuid",
  "client_id": "uuid",
  "lead_employee_id": "uuid (nullable)",
  "clean_type": "string",
  "scheduled_date": "date",
  "scheduled_time": "time",
  "scheduled_at": "timestamp (with timezone)",
  "address": "string",
  "instructions": "string",
  "caddy_number": "number",
  "status": "string (scheduled | in_progress | completed)",
  "completion_time": "timestamp (nullable)",
  "dispatched_at": "timestamp (nullable)",
  "dispatched_by": "uuid (nullable)",
  "client_reminder_sent_at": "timestamp (nullable)"
}
```

### Job Assignments
```json
{
  "job_assignment_id": "uuid",
  "job_id": "uuid",
  "employee_id": "uuid"
}
```

### System Logs (Audit Trail)
```json
{
  "log_id": "uuid",
  "actor_user_id": "uuid",
  "action": "string",
  "target_type": "string",
  "target_id": "uuid",
  "timestamp": "timestamp",
  "metadata": "jsonb (old_state, new_state, device_info)"
}
```

## 📜 Behavioral Rules (Law)
1. **Visibility (RBAC):** Employees only see their own assigned jobs. Managers see everything.
2. **Explicit Dispatch:** schedule only becomes Visible/Notified once `dispatched_at` is set by a Manager.
3. **Lead Enforced Completion:** Only the user matching `lead_employee_id` (or a Manager) can set status to `completed`.
4. **Instant Completion Alert:** Setting status to `completed` triggers immediate manager SMS.
5. **Nightly Reminder Loop:** Daily at 7 PM, scan jobs for T+1 where `client_reminder_sent_at` is null.
6. **Immutable Accountability:** Every state change must write to `System Logs`.
7. **Simplicity Over Speed:** UI must require minimal clicks for the cleaning crew.

## 📝 Maintenance Log
- **2026-03-04**: Project and Architecture initialized. Supabase schema defined.
- **2026-03-15**: Completed Phase 5 (Trigger). Twilio SMS scripts (`send_sms.py`, `send_reminders.py`) implemented for automated notifications and nightly client reminders.
