# SOP: Job Dispatching

## Goal
Enforce deterministic job assignments and ensure employees are notified only when the schedule is finalized.

## Inputs
- `job_id`: Target job.
- `employee_id`: Assigned cleaner.
- `assignment_time`: When the dispatch was triggered.

## Logic (Layer 3: Tools)
1. **Verification**: Check if job is still `scheduled` and employee is `active`.
2. **Persistence**: Call `assign_job.py` to update Supabase.
3. **Notification**: Call `send_sms.py` (Twilio) to notify employee of their assigned job.

## Edge Cases
- **Over-assignment**: Prevent assigning multiple jobs to a non-Lead cleaner if the business rules change.
- **Race conditions**: Ensure job status doesn't change during dispatch.
