#!/usr/bin/env python
"""Mail a sign-out reminder to everyone still signed in. Meant for cron.

    python send_reminders.py

An evening run, with the app's virtualenv:

    30 18 * * 1-6  cd /var/www/jain-intern && venv/bin/python send_reminders.py >> /var/log/jain-reminders.log 2>&1

Set SIGNOUT_REMINDER_ENABLED=0 in .env to switch it off without touching cron.
People with no email on file are listed, not mailed.
"""
import sys
from datetime import date

from app import app, send_signout_reminders, SIGNOUT_REMINDER_ENABLED


def main():
    if not SIGNOUT_REMINDER_ENABLED:
        print(f"[{date.today()}] sign-out reminders are switched off")
        return 0
    with app.app_context():
        res = send_signout_reminders()
    print(f"[{date.today()}] still signed in: {len(res['people'])} · mailed {res['sent']}"
          + (f" · no email: {', '.join(res['no_email'])}" if res["no_email"] else ""))
    for line in res["failed"]:
        print(f"  FAILED {line}", file=sys.stderr)
    return 1 if res["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
