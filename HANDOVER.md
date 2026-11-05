# Handover: Family Office IPO Dashboard

## Project
- **What:** Flask + vanilla JS dashboard for managing a family's IPO applications (investors/PANs, banks, applications, allotment, transfers, portfolio).
- **Owner:** Rajat Lakhani. Prefers replies in **English only**. Uses the app mostly **on a phone**.
- **Code:** GitHub `rajatlakhani2/ipo`, branch `main`.
- **Live:** https://ipo.kuhu.org.in, SpidyHost cPanel (Passenger Python 3.12), app folder `/home/kuhuorgi/ipo.kuhu.org.in`, SQLite DB in `data/`.
- **Deploy (owner does this by hand):** cPanel → Git Version Control → ipo → Pull or Deploy → **Update from Remote**, then Setup Python App → **Restart**. Full checklist: `deploy/NEXT_DEPLOY.md`.

## Status (5 Nov 2026)
- **Live server is at `fee8731`.** Everything after it is on GitHub `main` (latest `c1c02af`) but **not deployed yet**.
- Clickable demo with sample data: claude.ai artifact "IPO Desk Demo" (private to owner).

## Done since fee8731 (all on GitHub, not live)
1. **Validation:** Demat ID must be 16 chars (16 digits CDSL, or IN + 14 digits NSDL); PAN must match `ABCDE1234F` and auto-capitalises. Checked in the form and the API (`validators.py`).
2. **Auto CAPITALS:** every text input types in capitals, except email, password, UPI, URL, search and AI advisor (`api-client.js`; opt out with `data-no-caps`).
3. **Security:** `app.py` used to serve ANY file in the app folder (DB, .env, .git, source) plus path traversal. Now an allow-list of static types only. Also `deploy/htaccess-security.conf` for Apache (owner must paste it into `.htaccess`).
4. **IPO Centre** (`ipo-centre.js/.css`, `ipo_centre_service.py`, `nse_client.py`, `gmp_scraper.py`, `ipo_sync.py`): Open / Upcoming / Past tabs; NSE data; GMP from ipowatch / investorgain / chittorgarh (the old **fake GMP estimate was removed**); category-wise subscription; family allotment chance (1/S lottery model, 1-(1-p)^n for n PANs); PAN calculator. APIs: `/api/fo/ipo-centre`, `/api/fo/ipo-centre/refresh`, `/api/cron/sync?key=CRON_KEY`.
   ⚠️ **Live scraping is untested** (the dev sandbox couldn't reach NSE or the GMP sites). The first real test is after deploy: tap Refresh and read the error toast.
5. **App shell** (`app-shell.js/.css`): phone bottom tabs (Home, IPOs, Apply, Family, More), slide-out menu, back button works (hash routes), menu regrouped by task.
6. **New Home** (`home.js/.css`): "Needs you today" list, net worth bar, money tiles, open IPOs.
7. **Theme** (`theme.css`): restyles all older screens. Fonts: Bricolage Grotesque + Instrument Sans. Colours: navy + marigold (marigold = "you / your family").
8. **Data-safety fix:** Home used to auto-run `/seed-demo`, which **overwrote the first 5 real investors' PAN/Demat** with fake values (`ABCDE0000F`, `IN300…`), added fake banks and transfers, and set a 12% GMP. Removed. Seed now refuses accounts that have data. Investor Master flags demo-looking values.
9. **One PAN per IPO:** blocks a second application with the same PAN or Demat ID under another investor entry (`validators.duplicate_pan_conflict`). Allocation now checks the account (organisation) too.
10. **Login fix:** JWT `sub` is now a string (PyJWT 2.10+ rejects ints). Server pins 2.8.0, so this is a safeguard.
11. **Daily SQLite backup** (`backup_service.py`), run by the cron endpoint, keeps 14 copies in `data/backups/`.
12. **Installable app:** manifest, icons, minimal service worker, offline page.
13. Removed fake "Sample" upcoming IPOs; fixed a `passenger_wsgi.py` typo (`fh`).

## Tests
- `python3 tests/test_ipo_centre.py`: 55 offline checks (parsers + chance maths).
- `python3 tests/test_e2e.py`: 33 checks against the real app on a temp SQLite DB (needs requirements installed).

## Owner to-do after deploy
- Fix investors showing red "demo value" / "Fix:" labels.
- IPO Centre → Refresh once; report any error.
- Optional: paste the `.htaccess` block; set `CRON_KEY` and check `SECRET_KEY` in Setup Python App; add a cPanel cron every 15 min:
  `curl -s "https://ipo.kuhu.org.in/api/cron/sync?key=CRON_KEY" > /dev/null`

## Ideas discussed, not built (owner declined for now)
UPI mandate tracker, capital gains report per PAN, bulk entry, alerts, Gujarati toggle. Also suggested: login rate-limiting, off-server backup copies, repo cleanup (old backups, ~26 guide .md files, broken unused `migrate_new_columns.py`).

## Notes for the next AI
- Can't deploy to production for the owner. Give cPanel steps; the owner taps the buttons.
- `config.py` falls back to a dev SECRET_KEY if the env var is missing, so check that it's set on the server.
- Older views live in `script.js`, `ipo-saas.js` and `family-office.js`. Newer modules chain onto `window.loadView`.
