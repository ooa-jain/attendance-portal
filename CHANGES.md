# What changed

A full UI/UX rebuild of the Office of Academics attendance app, plus the four
functional fixes you asked for and three bugs found along the way.

Your Python logic, MongoDB schema, face-recognition pipeline and geolocation
code are **unchanged** except where listed under "Backend" below. The visual
layer was replaced; the machinery underneath was not.

---

## 1. Design

The palette is lifted from your own logo files rather than invented:

| Token | Value | Where it came from |
|---|---|---|
| Navy | `#0A1324` | dominant colour in `applogo.png` |
| Gold | `#EEBD1B` | accent dot in `applogo.png` / `jain.png` |
| Paper | `#F6F4EF` | warm off-white ground |

Type is Playfair Display (headings) + Plus Jakarta Sans (body), matching the
OoA brand convention, with **JetBrains Mono for every time, hour and coordinate
value** — a timesheet reads better when the digits align in columns.

**The signature element is the Day Arc**: hours drawn as a 180° gold sweep with
a marker at your current position, replacing the generic linear progress bar as
the hero of the dashboard. Behind it, the masthead carries faint ruled lines —
a register-book motif that also runs down the login page with a red margin rule.

### New stylesheets

    static/css/oa-core.css        tokens, reset, shell, typography, responsive layout
    static/css/oa-components.css  cards, buttons, forms, calendar, sheets, Day Arc
    static/css/oa-admin.css       admin console + restyled legacy JS-emitted classes

`static/style.css` was deleted — everything it did now lives in the three files
above.

### Layout

* **≥1024px** — fixed navy left rail + content column. Dashboard splits into a
  main column and a roster/map sidebar.
* **<1024px** — top bar, slide-in drawer, bottom tab bar, bottom sheets.

Both are driven from the same markup; no separate mobile templates.

---

## 2. Your four requests

### App logo as favicon
`applogo.png` is now wired as `icon`, `shortcut icon`, `apple-touch-icon` and
`mask-icon` on every template, and is the sole icon in `manifest.json`
(including a `maskable` entry for Android).

### Shift attendance off by default, with a bulk switch
Changed in four places so it holds no matter which path is taken:

1. `register()` and `admin_create_user()` now write `shift_login_enabled: False`
   on every new account.
2. `get_dashboard_data()` falls back to `False` — previously `True` — so
   existing accounts with no such field also default to off.
3. The admin toggle reads `user.get('shift_login_enabled', False)`.
4. **New server-side guard** in `attendance_login()`: the API refuses a shift
   sign-in when the flag is off, so hiding the tab is no longer the only defence.

New endpoint `POST /api/admin/shift-login/bulk` with `{"enabled": true|false}`
updates every non-admin account at once. It is wired to **Enable / Disable for
everyone** in the navy bar at the top of the admin People tab.

### Know Your Team → "On duty today", with sign-in locations
`/api/user/team-today` now returns `login_address` for each person. The roster
shows name, shift, sign-in time, the address they signed in from, and a badge:
`Head Office` / `1.4 km away` / `Off site`. Sorted by arrival time.

It renders on **both** the Today and Shifts tabs — my reading of "know your user
replace in shift". If you meant something else it is a two-line revert.

⚠️ **This is a real privacy change.** The old endpoint deliberately withheld
addresses, with a comment saying so. Colleagues can now see where each other
signed in from. I've left a note in the code showing how to walk it back
(drop `login_address` from the payload; the UI degrades gracefully). Raw GPS
coordinates are still withheld from everyone except the person they belong to.

### Head Office naming
Three constants at the top of `app.py` are now the single source of truth:

```python
OFFICE_NAME  = "Office of Academics · Head Office"
OFFICE_SHORT = "Head Office"
OFFICE_CITY  = "Bengaluru"
```

They are exposed in `/api/dashboard-data` and mirrored in
`static/js/user-dashboard.js`. Every "JAIN HQ" / "On Campus" / "JAIN University
Campus" string is gone. Change the label in one place and it changes everywhere.

---

## 3. Bugs found and fixed

**Your service worker has never installed.** It precached
`/static/images/logo.png`, which does not exist in the repo. `cache.addAll()`
rejects the entire batch if any single request fails, so the install promise
rejected every time and no caching or offline support was ever active.
Rewritten: entries are added individually, pages use network-first (attendance
state must never be stale), `/api/*` and `/attendance/*` are never cached.

**`requirements.txt` was UTF-16LE** — `pip install -r` fails on a clean Ubuntu
VPS. Converted to UTF-8 and added `opencv-python-headless` and `requests`, both
imported by `app.py` but absent from the file. Headless is the right OpenCV
build for a server; the full package pulls GUI libraries you do not have.

**Two orphaned templates.** `notifications.html` and `attendance_history.html`
have no route rendering them. Restyled anyway so they are consistent if you
wire them up; `attendance_history.html` now calls your existing
`/api/statistics` and `/api/dashboard-data` endpoints.

---

## 4. Security — please act on these

* **`.env` is inside the zip you sent, and it is listed in `.gitignore`.** That
  means it was force-added to the repo at some point and the history may still
  contain it. It has been removed from this build.
* **`app.py` line 32 has a Gmail app password as a hardcoded fallback.** Rotate
  it, then read it from the environment with no default.

---

## 5. Files

**New**

    static/css/oa-core.css
    static/css/oa-components.css
    static/css/oa-admin.css
    static/js/user-dashboard.js       (extracted from the template, restyled)
    static/js/admin-dashboard.js      (extracted from the template, restyled)

**Rewritten**

    templates/base.html
    templates/login.html
    templates/user_dashboard.html
    templates/admin_dashboard.html
    templates/register.html
    templates/notifications.html
    templates/attendance_history.html
    static/manifest.json
    static/sw.js
    static/main.js
    requirements.txt

**Edited**

    app.py         office constants, shift defaults, bulk endpoint,
                   server-side shift guard, team roster rewrite
    .gitignore     .env entries confirmed

**Deleted**

    static/style.css   superseded by the three oa-*.css files

---

## 6. Verification done

* Every template rendered through Jinja2 — no template errors.
* Every page loaded in headless Chromium at 1440px and 390px with mocked API
  responses — **zero JavaScript errors** on login, user dashboard (Today and
  Shifts), and admin console (Overview and People).
* Element IDs cross-checked programmatically between each template and the JS
  that drives it: no missing IDs, no duplicates.
* `app.py`, both dashboard bundles and `sw.js` pass syntax checks.

Not tested: anything requiring a live MongoDB, a real camera, or real GPS —
face registration and verification, actual sign-in/sign-out writes, the Leaflet
locations map, and CSV export. The code paths for those are unchanged, but give
them a pass on staging before this goes to the VPS.

---

## 6b. Sign-in analysis — Excel download & shareable link (admin)

On the admin console's **Locations & Map** tab you can now turn the "where
people signed in" view into a report. Pick a **From → To date range**, choose
**which users** to include (leave all unchecked for everyone), give it a
**title** (auto-fills to `users-…` from your selection), then:

* **Download Excel** — a formatted `.xlsx` for the chosen range and users
  (name, shift, login/logout time, hours, on-campus flag, the address and
  coordinates people signed in from, and device details). The title becomes
  the workbook heading and the file name.
* **Create shareable link** — mints an unguessable link that opens the same
  analysis (same range, users and title) and the Excel download **without a
  login**, for forwarding to HR. Links can be revoked; revoked links 404.
* **Saved links** — every link you create is kept in a history list under the
  panel (newest first) with its title, date span and users. Each row has
  **Copy**, **Open**, **Reuse** (loads that range/users/title back into the
  form) and **Revoke**, so a group you built once is easy to find and reuse.

### Backend

* `openpyxl` added to `requirements.txt` (Excel writer).
* New routes in `app.py`: `/admin/analysis/excel`,
  `/api/admin/analysis/share` (+ `shares`, `share/<token>/revoke`), and the
  public `/share/analysis/<token>` and `/share/analysis/<token>/excel`.
* Shares live in a new `analysis_shares` collection keyed by a
  `secrets.token_urlsafe(24)` token. No existing schema changed.
* New standalone public template `templates/shared_analysis.html`
  (`noindex`, read-only).

---

## 6d. Download / share group moved into the Analysis tab

The **Download or share a group** panel (From→To range, user picker, title,
Download Excel, Create shareable link, and the Saved-links history) now lives
in the **Analysis** tab, directly under the dashboard — so building a group,
pulling the working-hours Excel and minting a no-login link all sit alongside
the day snapshot and per-person calendars. It was previously on Locations &
Map; that tab is now just the map. Nothing else about the feature changed.

---

## 6c. Analysis tab — Power-BI-style attendance dashboard (admin)

A new **Analysis** tab in the admin console gives a one-day snapshot across
**every registered (non-admin) user**, with a date picker:

* **KPI tiles** — Registered · On track · Still active · Left early · Missed
  sign-in · On leave.
* **Donut + attendance-rate bar** — the split of the day and the % of expected
  people who signed in (people on approved leave are excluded from "expected").
* **Category columns** — each person filed under On track / Still active / Left
  early / Missed sign-in / On leave. Everyone registered appears somewhere, so
  absentees are visible, not just those who showed up.
* **30-day progress** — every row carries a progress bar = share of their last
  30 present days on which they met their hours target, plus average hours.

How a person is classified for the day: no record + approved leave → *On
leave*; no record → *Missed sign-in*; a session still open → *Still active*;
closed sessions totalling ≥ their target → *On track*; otherwise → *Left
early*.

Under the category columns the tab also carries an **Individual attendance
calendar**: a searchable list of every registered person. Click a name and a
month calendar opens showing exactly which days they signed in — green for
days that met their hours target, amber for a short day, plain for no sign-in
— with ‹ › month navigation. It's login days only; no location is shown here.

The per-person view takes a **From → To range** (any span, not just one
month). Above the calendars a **full summary** shows **Days worked · Absent ·
On leave · Total hours · Avg/day · Attendance %**, measured against the range's
working days (Mon–Sat, only up to today). Absent = working days minus days
present minus approved leave; the attendance rate does not count leave days
against the person. The range renders one calendar per month it spans, with
each day coloured green (met target) / amber (short) / red (absent) / grey
(leave).

The **public shared link** now carries the same **By day / By person** toggle:
click a person to expand their days, with present-vs-absent across the report's
days and their hours — scoped to exactly the days and people that share
already contained (no login, nothing extra exposed).

### Working week: Sunday holiday, Saturday optional

Attendance maths now treats **Sunday as a holiday** and **Saturday as
optional** — a missed Saturday or Sunday is never counted as "absent", but a
Saturday sign-in still counts as a worked day. This applies everywhere:

* Per-user calendar/summary — compulsory days are **Mon–Fri**; the calendar
  shades Saturdays (optional) and Sundays (holiday) distinctly, and the
  attendance rate is measured against Mon–Fri only.
* The Analysis-tab day snapshot gains an **Off / weekend** category, and
  weekend no-shows land there instead of "Missed sign-in"; the day header
  says "Saturday · optional" / "Sunday · holiday".
* On the **shared link**, each day now shows **who signed in and who did not**
  (with a "not signed in" list), and weekend days are labelled instead of
  listing absentees.

(People could always sign in on a weekend if they needed to — this only
changes how absence is judged, not who may log in.)

### Backend

* New routes `GET /api/admin/analysis-overview?date=YYYY-MM-DD` and
  `GET /api/admin/user-calendar/<user_id>?month=YYYY-MM` in `app.py`
  (read-only; no schema change).
* Charts and the calendar are pure CSS/SVG (conic-gradient donut, CSS grid
  calendar) — no chart library added.

---

## 7. Deploying

    # from your repo root, after copying these files in
    pip install -r requirements.txt
    sudo systemctl restart <your-service-name>

Then **hard-refresh once** (Ctrl/Cmd-Shift-R) or clear site data. The old
service worker will be replaced by `ooa-attendance-v3`, which deletes stale
caches on activate — but the first load needs to get past whatever the browser
already holds.
