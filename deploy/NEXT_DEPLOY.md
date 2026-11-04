# Next deploy checklist (ipo.kuhu.org.in)

Changes waiting on GitHub `main` since the last deploy (`fee8731`):

1. **PAN** — auto-capitals, format `ABCDE1234F` enforced in form and API
2. **Security** — app no longer serves private files (database, `.env`, `.git`, `.py`, logs, Excel, backups)
3. **Investor Master** — red warning on investors whose saved PAN / Demat ID is invalid, with a "Show only these" filter
4. **Auto CAPITALS** — every text box types in capitals (except email, password, UPI, URL, search, AI advisor)
5. **IPO Centre** — new screen with Open now / Upcoming / Past tabs: live NSE data, GMP (unofficial, never estimated),
   category-wise subscription, bidding timeline, and your family's allotment chance with a "how many PANs" calculator
6. **Phone-friendly app** — bottom tab bar, slide-out menu, back button works, menu regrouped by task, light mode fixed
7. **New Home + app-wide redesign** — "Needs you today" list, net worth breakdown, money tiles; every screen restyled
8. **Data-safety fix** — opening Home no longer writes demo data over real investors (it used to, if no bank was added)
9. **One PAN per IPO** — a second application with the same PAN or Demat ID (under another investor entry) is blocked
10. **Login fix** — tokens work with newer PyJWT versions too (prevents a mass "Invalid token" logout after any upgrade)
11. **Daily database backup** — made by the cron job, 14 days kept in `data/backups/` (private)
12. **Install as app** — "Add to Home Screen" gives an IPO Desk icon and full-screen app on your phone

## Steps (cPanel)

1. **Git Version Control** → ipo → **Manage** → **Pull or Deploy** → **Update from Remote**
2. **File Manager** → `ipo.kuhu.org.in` → `.htaccess` → **Edit** →
   paste the contents of `deploy/htaccess-security.conf` at the very top → **Save**
3. **Setup Python App** → ipo.kuhu.org.in → add an environment variable
   `CRON_KEY` = any long random text (e.g. 30+ letters and numbers) → **Save**
4. **Setup Python App** → ipo.kuhu.org.in → **Restart**
5. **Cron Jobs** → Add New Cron Job → Common settings: *Once per fifteen minutes* → Command:

   ```
   curl -s "https://ipo.kuhu.org.in/api/cron/sync?key=PASTE_THE_SAME_CRON_KEY" > /dev/null
   ```

   This keeps IPOs, GMP and subscription fresh without anyone clicking Refresh.
   (Even without it, opening IPO Centre refreshes data that is more than 30 minutes old.)

## Check it worked

- Dashboard opens and you can log in
- `https://ipo.kuhu.org.in/data/ipo_saas.sqlite` → shows an error / 403 / 404, **not** a download
- `https://ipo.kuhu.org.in/.env` → error, not a file
- Investor form: typing a name or PAN in small letters turns it into capitals
- Investor Master: any old record with a bad PAN / Demat ID shows a red "Fix:" label
- **IPO Centre**: tap Refresh once; within a minute the tabs fill with live IPOs.
  If a tab stays empty or GMP shows "Not available" everywhere, a source site may be blocking the server —
  send the message shown after Refresh so the fetcher can be adjusted.
- `https://ipo.kuhu.org.in/api/cron/sync?key=WRONG` → "Forbidden" (the key works as a lock)
- On your phone: bottom tabs (Home, IPOs, Apply, Family, More) and the back button moves between screens
- Investors: any investor whose PAN/Demat was overwritten by the old demo data shows a red "demo value" label — fix those
- The day after setting up the cron job, `data/backups/` (File Manager) has a dated `.sqlite` copy
- Phone browser menu → **Add to Home Screen** → the IPO Desk icon opens the app full screen

If the site shows an error after step 2, remove the pasted block from `.htaccess` and restart.
