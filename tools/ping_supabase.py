import os
from supabase import create_client, Client

# These will be loaded from .env once provided
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_ANON_KEY")

def ping():
    if not url or not key:
        print("❌ Error: SUPABASE_URL or SUPABASE_ANON_KEY not found in .env")
        return

    try:
        supabase: Client = create_client(url, key)
        # Select 1 from users to check connection
        response = supabase.table("users").select("count", count="exact").limit(1).execute()
        print("✅ Supabase connection verified!")
        print(f"Connection Successful. Found {response.count} users.")
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")

if __name__ == "__main__":
    ping()
