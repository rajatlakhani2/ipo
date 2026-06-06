# IPO Control SaaS

Multi-tenant IPO application control platform. Each workspace (organization) has isolated investors, IPOs, and applications.

## Quick Start

```bash
pip install -r requirements.txt
python app.py
```

Open **http://127.0.0.1:5001/login.html** → Register a workspace → Use the app.

### Migrate legacy data (optional)

If you have old `db_v2.sqlite`:

```bash
python migrate_saas.py
```

Default login after migration: `admin@local.dev` / `admin123`

## SaaS Features

- **Register / Login** with JWT per workspace
- **Multi-tenant isolation** — all data scoped to organization
- **Roles**: owner, admin, member (write), viewer (read — extend in routes)
- **Command Board** — open IPOs, closing soon, bank alerts, not-applied list
- **IPO Calendar** — bidding close, allotment, listing dates
- **Upcoming IPO Feed** — import template IPOs into your workspace
- **Bank ASBA headroom** — set per-bank blocked limits with alerts
- **IPO lifecycle stages** — Upcoming → Open → BiddingClosed → AwaitingAllotment → Listed → Closed
- **Application ref, apply channel, allotted shares**
- **Duplicate apply guard** — one application per investor per IPO
- **Bulk allotment import** (Excel) and bulk status updates
- **Listing day bulk** — set sell price + payment for all allotted
- **Export** applications to Excel (authenticated)
- **Global search** across investors, IPOs, applications
- **Audit trail** for application changes
- **IPO scorecard API** at `/api/scorecard`

## Environment

| Variable | Default |
|----------|---------|
| `SECRET_KEY` | dev key (change in production) |
| `DATABASE_URL` | `sqlite:///ipo_saas.sqlite` |
| `PORT` | `5001` |

## Email verification

Set `REQUIRE_EMAIL_VERIFICATION=true` and configure SMTP (see `.env.example`).  
Users verify via link → `/verify.html?token=...`

## Stripe Pro billing

- **Free**: 15 investors, 10 IPOs, 3 members
- **Pro**: higher limits (configure in `config.py`)
- Settings → **Upgrade to Pro** (Stripe Checkout)
- Webhook: `POST /api/billing/webhook`

See **DEPLOY.md** for full Stripe + Docker instructions.

## Docker deploy

```bash
cp .env.example .env
docker compose up -d --build
```

## Production Notes

1. Set a strong `SECRET_KEY`
2. Use PostgreSQL via Docker Compose or `DATABASE_URL`
3. Put behind HTTPS reverse proxy (nginx)
4. Enable CORS only for your domain
5. Run `python migrate_schema.py` after upgrades

## Live IPO Feed

Pulls real-time IPO data from **NSE India API** (open IPOs), **Moneycontrol**, **Chittorgarh**, and ShareMarketIPO.

1. Open sidebar → **Live IPO Feed**
2. Click **Fetch Live IPOs** (auto-syncs if empty or older than 6 hours)
3. Click **Add** to import an IPO into your workspace

API: `POST /api/upcoming-ipos/fetch-live`

## API Auth

```
Authorization: Bearer <token>
```

Obtain token via `POST /api/auth/register` or `POST /api/auth/login`.
