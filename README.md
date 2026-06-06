# Family Office Dashboard

Multi-tenant IPO & family wealth dashboard — treasury, investor masters, AI allocation, Kanban, live portfolio (Zerodha), allotment center, and net worth tracking.

## Quick start (local)

```bash
pip install -r requirements.txt
cp .env.example .env
python app.py
```

Open http://127.0.0.1:5001/login.html

## Deploy

| Target | Guide |
|--------|--------|
| **SpidyHost / cPanel** | [SPIDYHOST.md](SPIDYHOST.md) |
| **Docker + PostgreSQL** | [DEPLOY.md](DEPLOY.md) / [PRODUCTION.md](PRODUCTION.md) |

## Stack

- Flask, SQLAlchemy (SQLite or PostgreSQL)
- JWT auth, multi-org SaaS
- Static frontend (`index.html`, `family-office.js`)
