# Deploy to SpidyHost (cPanel)

Family Office Dashboard runs on SpidyHost **cPanel Python** hosting via Passenger.

## 1. Push this repo to Git

On your PC (already initialized):

```bash
git remote add origin <your-git-url>
git push -u origin main
```

Use GitHub, GitLab, Bitbucket, or SpidyHost cPanel **Git Version Control** (create a repo there and use that URL).

## 2. Clone on SpidyHost

In cPanel → **Git Version Control** → Clone, or SSH:

```bash
cd ~/yourdomain.com   # or subdomain folder
git clone <your-git-url> family-office
cd family-office
```

## 3. Create Python application

cPanel → **Setup Python App** → **Create Application**

| Setting | Value |
|---------|--------|
| Python version | 3.10+ |
| Application root | `family-office` (your clone path) |
| Application URL | your domain or subdomain |
| Application startup file | `passenger_wsgi.py` |
| Application entry point | `application` |

Click **Create**.

## 4. Install dependencies

In the Python app screen → **Add another file and install** → select `requirements.txt` → Install.

Or SSH:

```bash
source ~/virtualenv/family-office/3.10/bin/activate   # path shown in cPanel
cd ~/family-office
pip install -r requirements.txt
```

## 5. Environment variables

cPanel Python app → **Environment variables** (or create `.env` **outside** public_html if supported):

```env
SECRET_KEY=<long-random-string>
APP_BASE_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com
REQUIRE_EMAIL_VERIFICATION=false
```

**Zerodha, Stripe, email:** see **[LIVE_SETUP.md](LIVE_SETUP.md)** — add keys in cPanel env vars only (never commit secrets to GitHub).

**Database:** default is SQLite (`ipo_saas.sqlite` in app folder). For PostgreSQL, set `DATABASE_URL` if your plan includes it.

## 6. Restart & test

Python app → **Restart**

- App: `https://yourdomain.com/login.html`
- Health: `https://yourdomain.com/api/health`

## 7. Updates

```bash
cd ~/family-office
git pull
# Restart Python app in cPanel
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "It works!" page | `passenger_wsgi.py` must import `application` from `app` |
| 500 error | Check cPanel **Errors** log; verify `pip install -r requirements.txt` |
| Static files 404 | App root must be the folder containing `index.html` |
| OAuth / Stripe | Set `APP_BASE_URL` to your live HTTPS URL |
