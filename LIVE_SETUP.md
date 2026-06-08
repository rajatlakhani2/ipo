# Live setup — ipo.kuhu.org.in (SpidyHost cPanel)

**Secrets never go in GitHub.** Add API keys only in **cPanel → Setup Python App → Environment variables**, then **RESTART**.

Code/docs updates: push from PC → `git pull` on server → **RESTART**.

---

## Already configured (required)

| Name | Value |
|------|--------|
| `SECRET_KEY` | long random string |
| `APP_BASE_URL` | `https://ipo.kuhu.org.in` |
| `CORS_ORIGINS` | `https://ipo.kuhu.org.in` |
| `DISABLE_BACKGROUND_JOBS` | `true` |

---

## 1. Zerodha live portfolio (Kite Connect)

### A. Create Kite app

1. Go to [https://developers.kite.trade/](https://developers.kite.trade/) → log in with Zerodha
2. **My Apps** → **Create new app**
3. Fill in:
   - **App name:** Family Office IPO
   - **Redirect URL:** `https://ipo.kuhu.org.in/broker/zerodha/callback`
   - **Type:** Connect (OAuth)
4. Save → copy **API Key** and **API Secret**

### B. Add cPanel environment variables

| Name | Value |
|------|--------|
| `KITE_API_KEY` | your API key |
| `KITE_API_SECRET` | your API secret |
| `KITE_REDIRECT_URL` | `https://ipo.kuhu.org.in/broker/zerodha/callback` |

### C. Restart & test

1. cPanel → **RESTART**
2. Log in → **Portfolio** → **Connect Broker** → **Zerodha**
3. Complete Kite login → holdings sync live

---

## 2. Stripe billing (Pro subscription)

### A. Stripe Dashboard

1. [https://dashboard.stripe.com](https://dashboard.stripe.com) → **Products** → **Add product**
2. Name: **Family Office Pro**, recurring **monthly** (e.g. ₹999)
3. Copy **Price ID** (starts with `price_`)

### B. API keys

**Developers → API keys** → copy **Secret key** (`sk_live_...` or `sk_test_...` for testing)

### C. Webhook

**Developers → Webhooks → Add endpoint**

| Field | Value |
|-------|--------|
| URL | `https://ipo.kuhu.org.in/api/billing/webhook` |
| Events | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` |

Copy **Signing secret** (`whsec_...`)

### D. cPanel environment variables

| Name | Value |
|------|--------|
| `STRIPE_SECRET_KEY` | `sk_live_...` or `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `STRIPE_PRICE_ID_PRO` | `price_...` |

### E. Restart & test

1. **RESTART**
2. Log in as workspace **owner** → Billing / Upgrade → **Upgrade to Pro**
3. Complete Stripe Checkout (use test card `4242 4242 4242 4242` in test mode)

---

## 3. Email verification (SMTP)

### A. Choose an SMTP provider

| Provider | MAIL_SERVER | Notes |
|----------|-------------|--------|
| **Gmail** | `smtp.gmail.com` | Use [App Password](https://myaccount.google.com/apppasswords), not normal password |
| **SendGrid** | `smtp.sendgrid.net` | `MAIL_USERNAME=apikey`, password = API key |
| **Zoho** | `smtp.zoho.in` | Use Zoho app password |
| **SpidyHost mail** | ask host support | Often `mail.kuhu.org.in` |

### B. cPanel environment variables

| Name | Example value |
|------|----------------|
| `MAIL_SERVER` | `smtp.gmail.com` |
| `MAIL_PORT` | `587` |
| `MAIL_USERNAME` | `your@gmail.com` |
| `MAIL_PASSWORD` | your app password |
| `MAIL_USE_TLS` | `true` |
| `MAIL_FROM` | `Family Office <noreply@kuhu.org.in>` |
| `REQUIRE_EMAIL_VERIFICATION` | `true` |

`APP_BASE_URL` must already be `https://ipo.kuhu.org.in` (verification links use this).

### C. Restart & test

1. **RESTART**
2. Register a **new** test email on `/login.html`
3. Check inbox for **Verify your IPO Control account**
4. Click link → `verify.html` → then sign in

Without `MAIL_SERVER`, verification links only appear in server logs (dev mode).

---

## Deploy doc changes via GitHub

### On Windows PC
```cmd
cd /d "d:\New folder\Dashboard\IPO Dashboard"
git add LIVE_SETUP.md .env.example
git commit -m "Add live setup guide for Kite, Stripe, and email"
git push origin main
```

### On SpidyHost SSH
```bash
cd /home/kuhuorgi/ipo.kuhu.org.in
git checkout -- passenger_wsgi.py
git pull origin main
```

### cPanel
**RESTART** (after adding env vars, always restart)

---

## Full cPanel env var checklist

```
SECRET_KEY=...
APP_BASE_URL=https://ipo.kuhu.org.in
CORS_ORIGINS=https://ipo.kuhu.org.in
DISABLE_BACKGROUND_JOBS=true

# Zerodha (optional)
KITE_API_KEY=...
KITE_API_SECRET=...
KITE_REDIRECT_URL=https://ipo.kuhu.org.in/broker/zerodha/callback

# Stripe (optional)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO=price_...

# Email (optional)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_USE_TLS=true
MAIL_FROM=Family Office <noreply@kuhu.org.in>
REQUIRE_EMAIL_VERIFICATION=true
```

---

## Security

- Never commit real keys to GitHub
- Use Stripe **test mode** first (`sk_test_`, `whsec_` from test webhook)
- Rotate `SECRET_KEY` if exposed
- Kite tokens are stored per-investor in the database after OAuth
