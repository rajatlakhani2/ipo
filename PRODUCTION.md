# Family Office Dashboard — Production Deploy

## Quick start (Docker + PostgreSQL)

```bash
cp .env.example .env
# Edit .env — set SECRET_KEY, POSTGRES_PASSWORD, APP_BASE_URL

docker compose up -d --build
```

Open **http://localhost:5001/login.html**

## Production with nginx

```bash
cp .env.example .env
```

Required in `.env`:

```env
SECRET_KEY=<64-char-random-string>
POSTGRES_PASSWORD=<strong-password>
APP_BASE_URL=https://your-domain.com
CORS_ORIGINS=https://your-domain.com
KITE_REDIRECT_URL=https://your-domain.com/broker/zerodha/callback
```

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Open **http://your-server** (port 80) or map `HTTP_PORT=443` with TLS termination at load balancer.

## Environment checklist

| Variable | Required | Notes |
|----------|----------|-------|
| `SECRET_KEY` | Yes | JWT signing |
| `POSTGRES_PASSWORD` | Prod | Strong password |
| `APP_BASE_URL` | Yes | Public URL for emails, Stripe, Kite |
| `KITE_API_KEY` / `KITE_API_SECRET` | For live portfolio | Zerodha developer console |
| `STRIPE_*` | For billing | Checkout + webhook |
| `MAIL_*` | For verification/alerts | SMTP provider |
| `REQUIRE_EMAIL_VERIFICATION` | Recommended | `true` in production |

## Health & logs

```bash
curl http://localhost:5001/api/health
docker compose logs -f web
docker compose logs -f db
```

## Backup PostgreSQL

```bash
docker compose exec db pg_dump -U ipo ipo_control > backup.sql
```

## Upgrade

```bash
git pull
docker compose up -d --build
```

Migrations run automatically on startup (`migrate_schema.py` + `db.create_all()`).

## HTTPS (recommended)

- Terminate TLS at **Cloudflare**, **AWS ALB**, or **Caddy** in front of nginx
- Set `APP_BASE_URL=https://your-domain.com`
- Set `CORS_ORIGINS=https://your-domain.com`

## Local dev (SQLite, no Docker)

```bash
pip install -r requirements.txt
python app.py
```
