import os
import psycopg2

def apply_schema():
    # Load credentials from .env
    url = os.environ.get("SUPABASE_URL")
    password = os.environ.get("SUPABASE_PASSWORD")
    
    if not password:
        print("❌ Error: SUPABASE_PASSWORD not found in .env")
        return

    project_ref = url.split("//")[1].split(".")[0]
    
    # Connection strings to try
    conn_strings = [
        f"postgresql://postgres:{password}@db.{project_ref}.supabase.co:5432/postgres",
        f"postgresql://postgres.{project_ref}:{password}@aws-0-us-west-2.pooler.supabase.com:6543/postgres",
        f"postgresql://postgres.{project_ref}:{password}@aws-0-us-west-2.pooler.supabase.com:5432/postgres",
        f"postgresql://postgres.{project_ref}:{password}@aws-0-us-west-1.pooler.supabase.com:6543/postgres",
        f"postgresql://postgres.{project_ref}:{password}@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres"
    ]
    
    conn = None
    for conn_str in conn_strings:
        display_str = conn_str.replace(password, "********")
        print(f"Attempting: {display_str}")
        try:
            conn = psycopg2.connect(conn_str, connect_timeout=5)
            conn.autocommit = True
            print("✅ Connected!")
            break
        except Exception as e:
            print(f"   Failed: {str(e).strip()}")

    if not conn:
        print("❌ Could not connect to any available host.")
        return

    try:
        cur = conn.cursor()
        print("Ensuring uuid-ossp extension is enabled...")
        cur.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
        
        schema_path = "supabase_schema.sql"
        with open(schema_path, "r") as f:
            schema_sql = f.read()
            
        print(f"Applying schema from {schema_path}...")
        cur.execute(schema_sql)
        print("✅ Schema applied successfully!")
        
    except Exception as e:
        print(f"❌ Error applying schema: {str(e)}")
    finally:
        if conn:
            cur.close()
            conn.close()

if __name__ == "__main__":
    apply_schema()
