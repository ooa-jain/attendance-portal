# Attendance Portal — setup and handover

Office of Academics, JAIN (Deemed-to-be University).
Flask + MongoDB attendance system for interns, employees and administrators.

Everything needed to run this project somewhere else, including in another
Claude session.

---

## ⚠️ Read this first: use the branch, not `main`

`main` is **20 commits behind**. It only has the work up to PR #13.

Everything since lives on **`claude/logout-comment-update-73z44f`**: Word
reports, the Employee role, the rail navigation rework, all the mail and daily
digest work, the admin console performance fix, the Luno and Packet skins, the
static-cache fix, and the face/object prototype.

A fresh clone defaults to `main` and will be missing nearly all of it. Always
name the branch.

---

## 1. Clone

```bash
git clone -b claude/logout-comment-update-73z44f https://github.com/ooa-jain/attendance-portal.git
cd attendance-portal
```

## 2. Install

```bash
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Targets Python 3.13 (`runtime.txt`); 3.11 or newer works.

## 3. Create `.env`

**`.env` is not in the repository** — `.gitignore` excludes it, which is
correct. You have to create it.

The quickest way is to copy the one already on the server:

```bash
cat /var/www/jain-intern/.env
```

### Required

| Variable | What it is |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `SECRET_KEY` | Any long random string; signs the session cookie |

### Mail

The app accepts either spelling — `MAIL_*` or `SMTP_*` — because the
deployment already used `SMTP_*`.

| Variable | Example |
|---|---|
| `SMTP_SERVER` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_EMAIL` | the mailbox that sends |
| `SMTP_PASSWORD` | its password |
| `SMTP_SENDER` | the From address |
| `REPORT_RECIPIENTS` | comma-separated; who gets the daily digest |
| `LEAVE_MAIL_ENABLED` | `1` to mail leave applications as they arrive |
| `DAILY_DIGEST_ATTACH_EXCEL` | `1` to attach the spreadsheet |
| `SIGNOUT_REMINDER_ENABLED` | `1` (default) to mail a reminder to people still signed in; `0` switches it off |

Port 465 means implicit SSL. Set `SMTP_USE_SSL=0` for STARTTLS on 587.

### Optional

| Variable | What it does |
|---|---|
| `GOOGLE_MAPS_API_KEY` | map tiles on the Locations tab |
| `PROTOTYPE_PASSWORD` | gate for `/admin/prototype`; has a fallback in the code |
| `SKIP_INDEXES` | `1` skips index creation at startup |
| `SIGNOUT_NUDGE_HOUR` | hour (IST, 24h) from which the dashboard reminds someone still signed in; default `18` |

> Put no real passwords in this file when sharing it. The values live in
> `.env`, which is deliberately untracked.

## 4. Run

```bash
python app.py                                  # development
gunicorn -w 3 -b 0.0.0.0:8000 app:app          # production
```

Open <http://localhost:5000> (dev) or `:8000` (gunicorn).

## 5. Deploy to the existing server

```bash
cd /var/www/jain-intern && \
  git pull origin claude/logout-comment-update-73z44f && \
  sudo systemctl restart jain-intern
```

Add `source venv/bin/activate && pip install -r requirements.txt` only when
dependencies changed.

---

## Project layout

```
app.py                     the whole backend — routes, mail, reports, face checks
config.py                  reads .env (the only place load_dotenv runs)
admin.py                   admin helpers
ensure_admin.py            create or repair the admin account
reset_admin_password.py    password reset
send_digest.py             cron entry point for the daily summary
send_reminders.py          cron entry point for the evening sign-out reminder
test_mail.py               SMTP diagnostic — probes ports, reports the real error
face_v2_reference.py       reference for the next face pipeline (not wired in)

templates/
  login.html  register.html  base.html
  user_dashboard.html  attendance_history.html  notifications.html
  admin_dashboard.html
  shared_analysis.html  shared_overview.html      no-login share links
  prototype.html  prototype_login.html            face/object prototype

static/css/
  oa-core.css          design tokens, shell, typography
  oa-components.css    shared components
  oa-admin.css         admin console
  oa-admin-luno.css    Luno skin   (default admin chrome)
  oa-admin-packet.css  Packet skin (data-skin="packet")
  oa-admin-dark.css    dark theme  (data-theme="dark")

static/js/
  oa-nav.js            travelling rail highlight
  user-dashboard.js    intern/employee side
  admin-dashboard.js   admin console
```

`CHANGES.md` documents every change made, in order, with the reasoning.

---

## What it does

**For interns and employees**
- Sign in with location recorded; a 50 km radius rule applies
- Optional face check, switched on per person by an administrator
- A work note required at sign-out — what was done, where they went
- Own calendar, statistics and day detail
- Leave applications
- Download their own report, any date range, Excel or Word

**For administrators**
- Today at a glance; live locations and map
- Analysis and calendar across everyone
- Early sign-out flags
- People management — display name separate from login username; Intern,
  Employee and Admin roles
- Leave approvals
- Notices shown to people at sign-in, for a set number of days or sign-ins
- Security and integrity panel
- Read-only share links, revocable
- Excel and Word reports, colour-coded, carrying the JAIN mark

**Email**
- Leave applications mailed as they arrive
- Daily summary with the spreadsheet attached

Cron for the digest:

```
5 21 * * * cd /var/www/jain-intern && venv/bin/python send_digest.py >> /var/log/jain-digest.log 2>&1
```

Cron for the sign-out reminder (Monday to Saturday, 18:30):

```
30 18 * * 1-6 cd /var/www/jain-intern && venv/bin/python send_reminders.py >> /var/log/jain-reminders.log 2>&1
```

**Prototype** — `/admin/prototype/login`, password-gated, separately
shareable. Browser-side face identity, anti-spoofing and 80-class object
detection. Not part of the attendance flow; built to evaluate replacing the
current face check.

---

## Open items

| | |
|---|---|
| **Blank admin console** | Reported, never reproduced here. Most likely cause was stale cached CSS/JS, fixed by versioning static URLs. **Unconfirmed** — if it recurs, check the browser console and whether the page source contains `Today at a glance`. |
| **Homepage** | Two drafts rejected. `/` still redirects straight to `/login`; there is no homepage. |
| **Face pipeline** | Still Haar cascades plus LBP histograms, with **no liveness check** — a printed photo signs someone in. `face_v2_reference.py` has the replacement. |
| **Digest delivery** | Confirm the 21:05 summary actually arrives; check SPF/DKIM for the sending domain. |

---

## Security — do these before sharing the repository

1. **Rotate the Hostinger mailbox password.** It was pasted into a chat.
2. **Change the admin password.** `admin123` is almost certainly still live.
3. **Remove the hardcoded Gmail app password** in `app.py`. It is also in git
   history, so rotating it at Google is the only real fix.
4. **Set `PROTOTYPE_PASSWORD`.** The fallback is in the source, so treat it as
   public.
5. **Face data is sensitive personal data** under India's DPDP Act 2023.
   It needs recorded consent and purpose limitation. Store the embedding
   rather than the photograph wherever retention policy allows.

---

## Starting another Claude session on this project

Say this:

> Repository `ooa-jain/attendance-portal`, branch
> `claude/logout-comment-update-73z44f`. Read `SETUP.md` and `CHANGES.md`
> first. Do not use `main` — it is 20 commits behind.
