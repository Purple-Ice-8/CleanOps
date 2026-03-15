import os
import argparse
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client

# Import the SMS script directly since it's in the same directory
from send_sms import send_sms

load_dotenv()

def get_supabase_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")  # Using anon since this is server-side scripted but service role is better if bypassing RLS
    if not url or not key:
        print("❌ Error: SUPABASE_URL or SUPABASE_ANON_KEY not found in environment.")
        sys.exit(1)
    return create_client(url, key)

def format_12h(time_24h_str: str) -> str:
    if not time_24h_str:
        return ""
    try:
        time_part = time_24h_str.split(':')[0:2]
        hours = int(time_part[0])
        minutes = time_part[1]
        ampm = "PM" if hours >= 12 else "AM"
        hours_12 = hours % 12
        if hours_12 == 0:
            hours_12 = 12
        return f"{hours_12}:{minutes} {ampm}"
    except Exception:
        return time_24h_str

def run_reminders(dry_run: bool = False):
    print("Starting client reminder sweep...")
    supabase = get_supabase_client()

    # Determine "tomorrow" date string (YYYY-MM-DD)
    # Ensure to use business local time if possible, or UTC if Supabase is storing UTC
    # The requirement says "where scheduled_date is tomorrow"
    tomorrow_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Needs client data to get phone numbers
    # Join with clients
    try:
        response = supabase.table("cleaning_jobs").select(
            "job_id, scheduled_date, scheduled_time, client_reminder_sent_at, clients(first_name, last_name, phone)"
        ).eq("scheduled_date", tomorrow_date).is_("client_reminder_sent_at", "null").execute()
    except Exception as e:
        print(f"❌ Failed to fetch jobs from Supabase: {e}")
        sys.exit(1)
        
    jobs = response.data
    if not jobs:
        print(f"No jobs found for {tomorrow_date} needing reminders.")
        return

    print(f"Found {len(jobs)} job(s) scheduled for {tomorrow_date} needing reminders.")

    success_count = 0
    for job in jobs:
        client_data = job.get("clients")
        if not client_data:
            print(f"⚠️ Job {job['job_id']} has no associated client data. Skipping.")
            continue
            
        client_phone = client_data.get("phone")
        client_name = client_data.get("first_name", "Valued Client")
        
        if not client_phone:
            print(f"⚠️ Client {client_name} has no phone number on file. Skipping.")
            continue
            
        scheduled_time = format_12h(job.get("scheduled_time", "TBD"))
        
        message_body = (
            f"Hi {client_name}, this is an automated reminder from CleanOps that you have a "
            f"cleaning scheduled for tomorrow ({tomorrow_date}) at {scheduled_time}. "
            "Reply to this number if you need to make any changes. See you then!"
        )

        if dry_run:
            print(f"[DRY RUN] Would send SMS to {client_phone}:\n  \"{message_body}\"")
            success_count += 1
        else:
            print(f"Sending prompt to {client_phone}...")
            if send_sms(client_phone, message_body):
                # Update Supabase to prevent duplicate sends
                now_str = datetime.now().isoformat()
                supabase.table("cleaning_jobs").update(
                    {"client_reminder_sent_at": now_str}
                ).eq("job_id", job['job_id']).execute()
                print(f"✅ Reminder marked as sent in DB for job {job['job_id']}")
                success_count += 1
            else:
                print(f"❌ Failed to send SMS for job {job['job_id']}")

    print(f"Reminder sweep completed. {success_count} / {len(jobs)} processed successfully.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Send nightly client reminders for tomorrow's jobs.")
    parser.add_argument("--dry-run", action="store_true", help="Print messages without actually sending SMS or updating DB.")
    
    args = parser.parse_args()
    run_reminders(dry_run=args.dry_run)
