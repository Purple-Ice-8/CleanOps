# SOP: Employee Access

## Goal
Ensure workers have frictionless, role-based access to their assigned jobs while preventing unauthorized viewing of other schedules.

## Logic (Layer 3: Tools)
### 1. Verification
- **Auth**: Use Supabase Auth for employee login via work email.
- **Role Check**: Verify if user is `Lead Cleaner` or `General Cleaner`.

### 2. Job Retrieval
- **Query**: Fetch from `Cleaning Jobs` where `employee_id` matches current user and `scheduled_date` is today.
- **Outcome**: Deterministic display of exactly 0 or 1 job (unless multi-assignment is enabled later).

### 3. Completion Rights
- **Lead Cleaner**: Full permission to `mark_complete.py`.
- **General Cleaner**: Read-only access to job details; completion button hidden or disabled.

## Edge Cases
- **No Job Assigned**: Display "All jobs assigned!" or "No jobs for you today" screen.
- **Multiple Employees**: If two employees are assigned to the same `job_id`, coordinate status updates via Supabase Realtime.
