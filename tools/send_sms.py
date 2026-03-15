import os
import argparse
import sys
from dotenv import load_dotenv
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

# Load environment variables from .env if present
load_dotenv()

def send_sms(to_number: str, message_body: str) -> bool:
    """
    Sends an SMS using Twilio credentials from the environment.
    Returns True if successful, False otherwise.
    """
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_number = os.environ.get("TWILIO_PHONE_NUMBER")

    if not all([account_sid, auth_token, from_number]):
        print("❌ Error: Twilio credentials not fully set in .env")
        return False

    try:
        client = Client(account_sid, auth_token)
        message = client.messages.create(
            body=message_body,
            from_=from_number,
            to=to_number
        )
        print(f"✅ SMS sent successfully to {to_number}. SID: {message.sid}")
        return True
    except TwilioRestException as e:
        print(f"❌ Twilio Error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error sending SMS: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Send an SMS via Twilio.")
    parser.add_argument("--test", action="store_true", help="Send a test message to the manager")
    parser.add_argument("--to", type=str, help="Phone number to send SMS to")
    parser.add_argument("--msg", type=str, help="Message body")
    
    args = parser.parse_args()

    if args.test:
        manager_phone = os.environ.get("MANAGER_PHONE_NUMBER")
        if not manager_phone:
            print("❌ Error: MANAGER_PHONE_NUMBER not set in .env for test.")
            sys.exit(1)
        print(f"Sending test SMS to manager ({manager_phone})...")
        success = send_sms(manager_phone, "CleanOps Notification System Test: OK!")
        sys.exit(0 if success else 1)
    elif args.to and args.msg:
        success = send_sms(args.to, args.msg)
        sys.exit(0 if success else 1)
    else:
        parser.print_help()
        sys.exit(1)
