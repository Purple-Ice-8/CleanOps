# 🔍 Findings: CleanOps

## North Star
- Goal: Reduce daily scheduling overhead from 60 mins to <5 mins.
- Key Outcomes: Centralized scheduling, mobile job viewing for employees, real-time completion alerts for managers, and automatic client notifications.
## Current Architecture (Legacy)
- Static index.html and employee.html.
- In-memory data structures in `app.js` and `employee.js`.
- Sync relies on `localStorage` and `StorageEvent`.

## Future Architecture (Supabase Transition)
- Database: Supabase (Auth, Tables, Realtime).
- Integration: Twilio (SMS Notifications).
- UI: Maintained "Premium" aesthetics but with true data persistence.

## Discovered Constraints
- Roles: `Lead Cleaner` vs `General Cleaner`.
- Workflow: Scheduled -> In Progress -> Completed.
- Aesthetic: Glassmorphism / Dark Mode.
