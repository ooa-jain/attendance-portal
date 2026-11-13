#!/usr/bin/env python
"""Mail the day's attendance summary. Meant for cron.

    python send_digest.py              # today
    python send_digest.py 2026-10-15   # a particular day
    python send_digest.py yesterday    # the day before today

A nightly run, with the app's virtualenv:

    5 21 * * *  cd /var/www/jain-intern && venv/bin/python send_digest.py >> /var/log/jain-digest.log 2>&1

Exits non-zero if the mail could not be sent, so cron will report it.
"""
import sys
from datetime import date, timedelta

from app import app, send_daily_digest, REPORT_RECIPIENTS


def resolve_day(arg):
    if not arg or arg == "today":
        return date.today().isoformat()
    if arg == "yesterday":
        return (date.today() - timedelta(days=1)).isoformat()
    return arg


def main():
    day = resolve_day(sys.argv[1] if len(sys.argv) > 1 else None)
    with app.app_context():
        ok, err = send_daily_digest(day)
    where = ", ".join(REPORT_RECIPIENTS) or "(nobody — set REPORT_RECIPIENTS)"
    if ok:
        print(f"[{date.today()}] digest for {day} sent to {where}")
        return 0
    print(f"[{date.today()}] digest for {day} FAILED: {err}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
