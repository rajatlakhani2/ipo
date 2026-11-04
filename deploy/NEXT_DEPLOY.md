# Next deploy checklist (ipo.kuhu.org.in)

Changes waiting on GitHub `main` since the last deploy (`fee8731`):

1. **PAN** — auto-capitals, format `ABCDE1234F` enforced in form and API
2. **Security** — app no longer serves private files (database, `.env`, `.git`, `.py`, logs, Excel, backups)
3. **Investor Master** — red warning on investors whose saved PAN / Demat ID is invalid, with a "Show only these" filter
4. **Auto CAPITALS** — every text box types in capitals (except email, password, UPI, URL, search, AI advisor)

## Steps (cPanel)

1. **Git Version Control** → ipo → **Manage** → **Pull or Deploy** → **Update from Remote**
2. **File Manager** → `ipo.kuhu.org.in` → `.htaccess` → **Edit** →
   paste the contents of `deploy/htaccess-security.conf` at the very top → **Save**
3. **Setup Python App** → ipo.kuhu.org.in → **Restart**

## Check it worked

- Dashboard opens and you can log in
- `https://ipo.kuhu.org.in/data/ipo_saas.sqlite` → shows an error / 403 / 404, **not** a download
- `https://ipo.kuhu.org.in/.env` → error, not a file
- Investor form: typing a name or PAN in small letters turns it into capitals
- Investor Master: any old record with a bad PAN / Demat ID shows a red "Fix:" label

If the site shows an error after step 2, remove the pasted block from `.htaccess` and restart.
