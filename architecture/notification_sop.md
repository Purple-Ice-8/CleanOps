# SOP: Automated Notifications

## Goal
Automate job reminders and real-time completion alerts via Twilio with built-in idempotency.

## Logic (Layer 3: Tools)

> **Prerequisites:** The `.env` file must contain `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, and `MANAGER_PHONE_NUMBER`.

### 1. Job Completion (Instant)
- **Trigger**: `status` changes to `completed`.
- **Action**: Execute `python3 tools/send_sms.py --to <MANAGER_PHONE> --msg "<MESSAGE>"`
- **Recipient**: Manager (Casey).
- **Condition**: Must prevent duplicate sends if the status is updated multiple times.
- **Testing**: `python3 tools/send_sms.py --test` sends a test SMS to `MANAGER_PHONE_NUMBER`.

### 2. Client Reminders (Cron/Scheduled)
- **Trigger**: 7 PM daily via cron or external task runner.
- **Action**: Execute `python3 tools/send_reminders.py`.
- **Target**: All jobs where `scheduled_date` is tomorrow AND `client_reminder_sent_at` is NULL.
- **Payload**: "Hi [Name], this is an automated reminder from CleanOps..."
- **Post-Action**: Script automatically sets `client_reminder_sent_at` to current timestamp via Supabase.
- **Testing**: `python3 tools/send_reminders.py --dry-run` prints what would be sent without actually messaging or updating the DB.

## Edge Cases
- **API Failure**: Script outputs errors; logs should be captured. Idempotent design ensures it can be safely re-run.

