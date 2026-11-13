#!/usr/bin/env python
"""Mail every intern and employee their own attendance for a month. For cron.

    python send_monthly.py            # last month
    python send_monthly.py 2026-10    # a particular month

On the 1st of each month at 09:15, with the app's virtualenv:

    15 9 1 * *  cd /var/www/jain-intern && venv/bin/python send_monthly.py >> /var/log/jain-monthly.log 2>&1

Each mail carries the person's day-by-day Excel. People with no email on
file are listed, not mailed. Set MONTHLY_REPORT_ENABLED=0 in .env to stop it.
"""
import sys
from datetime import date

from app import app, send_monthly_reports, month_bounds, previous_month, MONTHLY_REPORT_ENABLED


def main():
    if not MONTHLY_REPORT_ENABLED:
        print(f"[{date.today()}] monthly reports are switched off")
        return 0
    with app.app_context():
        rng = month_bounds(sys.argv[1]) if len(sys.argv) > 1 else previous_month()
        if not rng:
            print("Give the month as YYYY-MM, e.g. 2026-10", file=sys.stderr)
            return 2
        res = send_monthly_reports(*rng)
    print(f"[{date.today()}] {res['month']}: mailed {res['sent']}"
          + (f" · no email: {', '.join(res['no_email'])}" if res["no_email"] else ""))
    for line in res["failed"]:
        print(f"  FAILED {line}", file=sys.stderr)
    return 1 if res["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
