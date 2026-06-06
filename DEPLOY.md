# Deploy Family Office Dashboard

See **PRODUCTION.md** for full production checklist, nginx, backups, and HTTPS.

## Docker + PostgreSQL (recommended)

1. Copy environment file:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` — set `SECRET_KEY`, `APP_BASE_URL`, Stripe keys, SMTP for production.
3. Start stack:
   ```bash
   docker compose up -d --build
   ```
4. Open **http://localhost:5001/login.html**

PostgreSQL data persists in Docker volume `postgres_data`.

## Stripe setup

1. [Stripe Dashboard](https://dashboard.stripe.com) → Products → create **IPO Control Pro** (recurring monthly).
2. Copy **Price ID** → `STRIPE_PRICE_ID_PRO=price_...`
3. Developers → API keys → `STRIPE_SECRET_KEY`
4. Developers → Webhooks → add endpoint:
   ```
   https://your-domain.com/api/billing/webhook
   ```
   Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Copy signing secret → `STRIPE_WEBHOOK_SECRET`

Local testing with Stripe CLI:
```bash
stripe listen --forward-to localhost:5001/api/billing/webhook
```

## Email verification (production)

```env
REQUIRE_EMAIL_VERIFICATION=true
MAIL_SERVER=smtp.sendgrid.net
MAIL_USERNAME=apikey
MAIL_PASSWORD=your-sendgrid-api-key
MAIL_FROM=IPO Control <verify@yourdomain.com>
APP_BASE_URL=https://your-domain.com
```

Without SMTP, verification links print to the server console (development only).

## Local development (no Docker)

```bash
pip install -r requirements.txt
python migrate_schema.py
python app.py
```

## Health check

`GET /api/health`
