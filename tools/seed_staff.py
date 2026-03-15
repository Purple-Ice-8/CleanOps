import os
import uuid
import psycopg2

def seed_staff():
    # Load credentials
    url = os.environ.get("SUPABASE_URL")
    password = os.environ.get("SUPABASE_PASSWORD")
    
    if not password:
        print("❌ Error: SUPABASE_PASSWORD not found in .env")
        return

    project_ref = url.split("//")[1].split(".")[0]
    # Use the successful pooler found earlier
    host = f"aws-0-us-west-2.pooler.supabase.com"
    user = f"postgres.{project_ref}"
    port = "6543"

    staff_members = [
        {"name": "Angel", "email": "angel@cleanops.com", "role": "employee", "employee_role": "Lead Cleaner"},
        {"name": "Jasmine", "email": "jasmine@cleanops.com", "role": "employee", "employee_role": "Lead Cleaner"},
        {"name": "Megan", "email": "megan@cleanops.com", "role": "employee", "employee_role": "General Cleaner"},
        {"name": "Tammie", "email": "tammie@cleanops.com", "role": "employee", "employee_role": "General Cleaner"},
        {"name": "Linnea", "email": "linnea@cleanops.com", "role": "employee", "employee_role": "Deep Specialist"}
    ]

    print(f"Connecting to {host}...")
    conn = None
    try:
        conn = psycopg2.connect(
            host=host,
            user=user,
            password=password,
            dbname="postgres",
            port=port,
            connect_timeout=10
        )
        conn.autocommit = True
        cur = conn.cursor()

        # 1. Clear existing non-manager users (optional, but good for clean seed)
        print("Cleaning up existing non-manager users...")
        cur.execute("DELETE FROM users WHERE role = 'employee';")

        # 2. Insert new staff
        print("Seeding new staff members...")
        for member in staff_members:
            cur.execute(
                """
                INSERT INTO users (name, email, role, employee_role)
                VALUES (%s, %s, %s, %s)
                RETURNING user_id;
                """,
                (member["name"], member["email"], member["role"], member["employee_role"])
            )
            user_id = cur.fetchone()[0]
            print(f"✅ Created {member['name']} (ID: {user_id})")

        print("✨ Staff seeding complete!")

    except Exception as e:
        print(f"❌ Seeding failed: {str(e)}")
    finally:
        if conn:
            cur.close()
            conn.close()

if __name__ == "__main__":
    seed_staff()
