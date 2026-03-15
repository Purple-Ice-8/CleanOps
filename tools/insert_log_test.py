import os
import uuid
from supabase import create_client, Client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") # Service role for audit logs

def test_log():
    if not url or not key:
        print("❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env")
        return

    try:
        supabase: Client = create_client(url, key)
        
        test_log_entry = {
            "actor_user_id": None, # Null actor for system test
            "action": "CONNECTION_TEST",
            "target_type": "SYSTEM",
            "metadata": {"test": "handshake", "status": "success"}
        }
        
        response = supabase.table("system_logs").insert(test_log_entry).execute()
        print("✅ System log insertion verified!")
        print(f"Log ID created: {response.data[0]['log_id']}")
    except Exception as e:
        print(f"❌ Log insertion failed: {str(e)}")

if __name__ == "__main__":
    test_log()
