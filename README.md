# Easy Numbers Profit System V8

A self-serve SaaS financial operating system for owner-operated businesses ($100K–$5M revenue).

**EasyFlow CFO | Living Water Consulting LLC**

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, Framer Motion
- **Backend**: Node.js, Express, server-side math engine
- **Database**: PostgreSQL via Supabase (with Row-Level Security)
- **AI**: Anthropic Claude (models defined in [`shared/constants.js`](shared/constants.js) as `AI_MODELS`) — score interpreter, CFO chat, action plans, pricing AI, weekly briefings
- **Payments**: Stripe (subscription price IDs per tier; see **Subscription tiers** below)
- **Integrations**: QuickBooks Online OAuth 2.0; additional accounting providers (Xero, Wave, Sage, Zoho, FreshBooks) use env vars documented in [`server/.env.example`](server/.env.example)
- **Hosting**: Netlify (frontend) + Railway (backend)

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project (create at supabase.com)
- Stripe account with subscription products/price IDs for each tier you sell
- Anthropic API key (Claude)
- Intuit Developer account (for QuickBooks Online), if using QBO

### Setup

1. Clone the repository
2. Copy environment files:
   ```bash
   cp client/.env.example client/.env
   cp server/.env.example server/.env
   ```
3. Fill in all environment variables in both `.env` files (see [`server/.env.example`](server/.env.example) for server-side keys used by the app)
4. Run the database schema in Supabase SQL Editor: `server/db/schema.sql`
5. Seed benchmark data: `server/db/seed-benchmarks.sql`
6. Install dependencies:
   ```bash
   cd client && npm install
   cd ../server && npm install
   ```
7. Start development:
   ```bash
   # Terminal 1 - Backend
   cd server && npm run dev

   # Terminal 2 - Frontend
   cd client && npm run dev
   ```

### Deployment

**Frontend (Netlify)**:
- Build command: `cd client && npm run build`
- Publish directory: `client/dist`
- Set environment variables in Netlify dashboard

**Backend (Railway)**:
- Root directory: `server`
- Start command: `npm start`
- Set environment variables in Railway dashboard

## Architecture

All financial calculations run server-side in `/server/calculations/`. The frontend never computes. It only renders what the server returns.

## Subscription tiers

Tier names and list prices are defined in [`shared/constants.js`](shared/constants.js) (`TIERS`, `TIER_PRICES`, `TIER_RANK`). Stripe checkout maps **Stripe Price IDs** to tiers in [`server/routes/stripe.js`](server/routes/stripe.js).

**Owner plans**

| Tier | Price (reference) | Notes |
|------|-------------------|--------|
| **Free** | — | Core screens (input, dashboard, owner pay gap); limited snapshots |
| **Clarity** | $19.99/mo | Diagnosis, forecast, rolling 12, pricing, integrations, and related tools |
| **Control** | $49.99/mo | Planning tools (four forces, scenarios), AI action plan |
| **Harvest** | $99.99/mo | Hire calculator, weekly scorecard, owner pay roadmap |

**Partner plans** (white-label / multi-client): **Partner Starter**, **Partner Growth**, **Partner Scale** — see `TIER_PRICES` and `PARTNER_SEAT_LIMITS` in [`shared/constants.js`](shared/constants.js).

Your Numbers Made Easy.
