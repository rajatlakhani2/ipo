# Live Portfolio Architecture — ipo.kuhu.org.in

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│ Zerodha         │     │ Upstox / Dhan        │     │ Portfolio Engine      │
│ Personal API    │────▶│ WebSocket            │────▶│ (market_service)      │
│ → Holdings      │     │ → Live LTP prices    │     │ → Dashboard           │
└─────────────────┘     └──────────────────────┘     └─────────────────────┘
```

| Layer | Source | What it provides | Status in app |
|-------|--------|------------------|---------------|
| **Holdings** | Zerodha Kite Connect | Symbols, qty, avg price, day P&L | **Live today** |
| **Live prices** | Upstox or Dhan WebSocket | Real-time LTP for held symbols | **Planned** (NSE fallback works now) |
| **Dashboard** | Your portfolio engine | Net worth, portfolio cards, sync | **Live today** |

**Secrets:** cPanel env vars only — never GitHub.

---

# Part 1 — Zerodha Personal API → Holdings

Use Zerodha **only for holdings** (what you own). Prices can come from Upstox/Dhan WebSocket.

## Step 1 — Create Kite app

1. [https://developers.kite.trade/](https://developers.kite.trade/) → login (Zerodha account)
2. **My Apps** → **Create new app**
3. Settings:

| Field | Value |
|-------|--------|
| App name | `Family Office Holdings` |
| Redirect URL | `https://ipo.kuhu.org.in/broker/zerodha/callback` |
| Type | Connect (OAuth) |

4. Copy **API Key** + **API Secret**

## Step 2 — cPanel env vars (Zerodha)

**Setup Python App** → **+ ADD VARIABLE**:

| Name | Value |
|------|--------|
| `KITE_API_KEY` | your API key |
| `KITE_API_SECRET` | your API secret |
| `KITE_REDIRECT_URL` | `https://ipo.kuhu.org.in/broker/zerodha/callback` |

## Step 3 — Restart

**SAVE** → **RESTART**

## Step 4 — Connect in dashboard

1. [https://ipo.kuhu.org.in/login.html](https://ipo.kuhu.org.in/login.html) → sign in
2. **Investor Master** → add investor (name, PAN)
3. **Portfolio** → **Connect Broker**
4. Investor + **Zerodha** → **Connect**
5. Zerodha login + 2FA → approve
6. Holdings appear (symbol, qty, avg price)

## Step 5 — Refresh holdings (daily)

- Zerodha token expires ~next morning IST → reconnect if needed
- **Portfolio** → **Sync Holdings** re-pulls holdings from Zerodha

---

# Part 2 — Upstox WebSocket → Live Prices

Use Upstox **only for live LTP** on symbols already in your portfolio (from Zerodha holdings).

## Step 1 — Upstox developer account

1. [https://upstox.com/developer/api-documentation](https://upstox.com/developer/api-documentation)
2. Sign up / log in → **My Apps** → **Create App**
3. Note **API Key** and **API Secret**
4. Set **Redirect URL**: `https://ipo.kuhu.org.in/broker/upstox/callback` *(when Upstox OAuth is added)*

## Step 2 — Get access token

1. Upstox OAuth flow (or sandbox token for testing)
2. Token is used for REST + WebSocket market feed
3. Docs: [Market Data Feed V3](https://upstox.com/developer/api-documentation/v3/market-data-feed)

## Step 3 — cPanel env vars (Upstox)

| Name | Value |
|------|--------|
| `PRICE_FEED_PROVIDER` | `upstox` |
| `UPSTOX_API_KEY` | your API key |
| `UPSTOX_API_SECRET` | your API secret |
| `UPSTOX_ACCESS_TOKEN` | OAuth access token (refresh daily) |
| `UPSTOX_REDIRECT_URL` | `https://ipo.kuhu.org.in/broker/upstox/callback` |

## Step 4 — How it will work (engine)

```
Holdings (Zerodha) → symbols list [RELIANCE, TCS, ...]
       ↓
Upstox WebSocket subscribes to NSE_EQ symbols
       ↓
LTP updates → Holding.ltp in database
       ↓
Dashboard Portfolio view refreshes
```

## Step 5 — Test (when enabled)

1. Connect Zerodha holdings first
2. Set `PRICE_FEED_PROVIDER=upstox` + Upstox token
3. **Portfolio** → **Sync Holdings** → LTP should update in real time

> **Today:** app uses NSE quote API + simulation fallback in `market_service.py` until Upstox WebSocket module is deployed.

---

# Part 3 — Dhan WebSocket → Live Prices

Alternative to Upstox for live LTP.

## Step 1 — Dhan developer account

1. [https://dhanhq.co/](https://dhanhq.co/) → **DhanHQ API**
2. [https://api.dhan.co/](https://api.dhan.co/) → generate **Client ID** + **Access Token**
3. Docs: Market Quote WebSocket

## Step 2 — cPanel env vars (Dhan)

| Name | Value |
|------|--------|
| `PRICE_FEED_PROVIDER` | `dhan` |
| `DHAN_CLIENT_ID` | your client ID |
| `DHAN_ACCESS_TOKEN` | your access token |

Use **either** Upstox **or** Dhan for prices — set only one `PRICE_FEED_PROVIDER`.

## Step 3 — How it will work

```
Holdings symbols → Dhan WebSocket (NSE instruments)
       ↓
Live LTP → portfolio engine → Dashboard
```

## Step 4 — Test (when enabled)

1. Zerodha holdings connected
2. Set `PRICE_FEED_PROVIDER=dhan` + Dhan token
3. **Sync Holdings** → live prices on dashboard

---

# Part 4 — Portfolio Engine → Dashboard

Your app already has the engine in:

| File | Role |
|------|------|
| `kite_service.py` | Pull Zerodha holdings |
| `market_service.py` | Update LTP on all holdings |
| `family_office_routes.py` | `/api/fo/portfolio`, `/portfolio/refresh` |
| `family-office.js` | Portfolio UI |

## Step 1 — Base env vars (required)

| Name | Value |
|------|--------|
| `SECRET_KEY` | random string |
| `APP_BASE_URL` | `https://ipo.kuhu.org.in` |
| `CORS_ORIGINS` | `https://ipo.kuhu.org.in` |
| `DISABLE_BACKGROUND_JOBS` | `true` |
| `PRICE_FEED_PROVIDER` | `nse` (default today) / `upstox` / `dhan` |

## Step 2 — Data flow

```
1. Zerodha OAuth     → holdings saved to DB (symbols, qty, avg)
2. Price feed        → updates Holding.ltp (NSE / Upstox / Dhan)
3. Dashboard         → reads /api/fo/portfolio → shows value & P&L
```

## Step 3 — Use dashboard

| Action | Where |
|--------|--------|
| See family total | **Portfolio** top card |
| Per-investor holdings | Portfolio → investor panels |
| Refresh prices | **Sync Holdings** button |
| Net worth | **Home** (includes stocks from holdings) |
| Market pulse | Home / treasury widgets |

## Step 4 — Deploy engine updates via GitHub

**Windows PC:**
```cmd
cd /d "d:\New folder\Dashboard\IPO Dashboard"
git pull
git push origin main
```

**SpidyHost SSH:**
```bash
cd /home/kuhuorgi/ipo.kuhu.org.in
git checkout -- passenger_wsgi.py
git pull origin main
```

**cPanel:** RESTART

---

# Full cPanel checklist (all layers)

```env
# Core
SECRET_KEY=...
APP_BASE_URL=https://ipo.kuhu.org.in
CORS_ORIGINS=https://ipo.kuhu.org.in
DISABLE_BACKGROUND_JOBS=true

# Layer 1 — Zerodha holdings
KITE_API_KEY=...
KITE_API_SECRET=...
KITE_REDIRECT_URL=https://ipo.kuhu.org.in/broker/zerodha/callback

# Layer 2 — Live prices (pick ONE provider)
PRICE_FEED_PROVIDER=nse
# UPSTOX_API_KEY=...
# UPSTOX_API_SECRET=...
# UPSTOX_ACCESS_TOKEN=...
# DHAN_CLIENT_ID=...
# DHAN_ACCESS_TOKEN=...
```

---

# Recommended setup order

| Order | Task | Time |
|-------|------|------|
| 1 | Zerodha Kite app + cPanel `KITE_*` vars | 15 min |
| 2 | Connect Zerodha in Portfolio | 5 min |
| 3 | Confirm holdings show | — |
| 4 | Use **Sync Holdings** (NSE prices work now) | — |
| 5 | Later: add Upstox or Dhan for WebSocket LTP | when dev deploys feed module |

---

# Troubleshooting

| Issue | Fix |
|-------|-----|
| No holdings after Zerodha login | Reconnect broker; check redirect URL exact match |
| LTP not updating | Click **Sync Holdings**; check `PRICE_FEED_PROVIDER` |
| Zerodha works, prices stale | Normal until Upstox/Dhan WebSocket is enabled |
| `broker_error` in URL | Read toast message; re-login Zerodha |

---

# What to do right now

**You can complete today:**
1. Zerodha → holdings (Parts 1 + 4)
2. Dashboard with NSE-based price refresh

**Coming next (code update):**
- Upstox WebSocket price feed module
- Dhan WebSocket price feed module
- `PRICE_FEED_PROVIDER` switch in `market_service.py`

Ask to implement Upstox/Dhan WebSocket in the codebase when ready.
