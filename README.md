# Easy Numbers Profit System — MVP

A self-serve SaaS financial operating system for owner-operated businesses ($100K–$5M revenue),
and the practice management platform for their Fractional CFO partners.

**EasyFlow CFO | Living Water Consulting LLC**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Recharts, Framer Motion, Tailwind CSS |
| Backend | Node.js / Express — server-side math engine |
| Database | PostgreSQL via Supabase (Row-Level Security enabled) |
| AI | Anthropic Claude (`AI_MODELS` in `shared/constants.js`) |
| Payments | Stripe subscription checkout (price IDs per tier) |
| Integrations | QuickBooks Online OAuth 2.0; stubs for Xero, Wave, Sage, Zoho, FreshBooks |
| Hosting | Netlify (frontend) + Railway (backend) |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase project
- Stripe account with price IDs for each tier
- Anthropic API key
- Intuit Developer account (QuickBooks Online)

### Setup

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
# Fill in all env vars in both files

# Run schema + seed in Supabase SQL Editor
# server/db/schema.sql
# server/db/seed-benchmarks.sql

cd client && npm install
cd ../server && npm install
```

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm run dev
```

### Deployment

**Frontend (Netlify)**
- Build: `cd client && npm run build`
- Publish: `client/dist`
- Set env vars in Netlify dashboard

**Backend (Railway)**
- Root: `server`
- Start: `npm start`
- Set env vars in Railway dashboard

---

## Architecture

### Calculation layers

| Layer | Where | Used for |
|---|---|---|
| Server-side engine | `server/calculations/` | Core P&L waterfall, scoring, benchmarks — authoritative numbers stored to DB |
| Client-side engine | `client/src/utils/ForecastEngine.js` | 5-year forward forecast, breakeven projection, ratio trends — real-time, no round-trip |

The server is the source of truth for historical data and saved snapshots. The forecast module operates entirely in the browser against the snapshot context so inputs are re-calculated on every control change without a network call.

### State management

`SnapshotContext` (`client/src/context/SnapshotContext.jsx`) holds:
- `inputs` — current P&L inputs (annual values matching `shared/schema.js INPUT_SHAPE`)
- `monthlyHistory` — `{ "YYYY-MM": { revenue, cogs, ... } }` — actual monthly P&L data
- `waterfall` / `outputs` — server-computed results
- Auto-calculate is gated by the presence of an `access_token`; no 401 errors for unauthenticated sessions

---

## Easy Numbers Waterfall

All math follows this non-negotiable sequence:

```
Revenue
− COGS (materials only, no labor)
= Gross Margin
− Direct Labor (employee + subcontractors + Owner Direct Labor, Row 23)
= Contribution Margin
− Marketing
− Operating Expenses (incl. Owner Management Wage, Row 42)
= Pretax Net Income          ← target: 10%+
```

**Owner pay is always split 50 / 50** between Row 23 (direct labor) and Row 42 (management wage).

### Productivity Ratios

| Ratio | Formula | Target |
|---|---|---|
| Direct LPR | Gross Margin ÷ Direct Labor | 2.5×–3.5× |
| MPR | Gross Margin ÷ Marketing Spend | 5×+ |
| ManPR | Contribution Margin ÷ Management Wages (Row 42) | 1.0×+ |

### True Breakeven (EasyFlow Definition)

```
True Breakeven = Fixed Costs / (CM% − Target Profit %)

Fixed Costs = Marketing + Full OpEx + Owner Direct Labor (Row 23) + Owner Management Wage (Row 42)
```

The CPA breakeven lie is excluded owner pay. EasyFlow always includes both halves.

---

## Subscription Tiers

Tier constants live in `shared/constants.js` (`TIERS`, `TIER_PRICES`, `TIER_RANK`, `PARTNER_SEAT_LIMITS`).
Stripe price IDs map to tiers in `server/routes/stripe.js`.

### Owner Plans

| Tier | Price | Screens unlocked |
|---|---|---|
| **Free** | — | Input Engine, Profit Dashboard, Owner Pay Gap |
| **Clarity** | $19.99/mo | + Breakeven, Productivity Scorecard, Profit Leaks, **5-Year Forecast**, Rolling 12, Pricing, Integrations |
| **Control** | $49.99/mo | + Four Forces Allocator, Scenario Modeler, AI Action Plan |
| **Harvest** | $99.99/mo | + Hire Calculator, Weekly Scorecard, Owner Pay Roadmap |

### Partner Plans (white-label, multi-client)

| Tier | Notes |
|---|---|
| **Partner Starter** | Entry-level CFO practice; limited client seats |
| **Partner Growth** | Mid-tier seat expansion |
| **Partner Scale** | Enterprise — see `PARTNER_SEAT_LIMITS` |

Partners get a separate `/partner/` route tree guarded by `PartnerRoute` and `user_type: 'partner'` in the DB.

---

## Screen Map

### Public / Auth

| Path | Screen | Notes |
|---|---|---|
| `/` | `Landing` | New / returning / CFO intent cards; expands to data-entry options |
| `/signup` | `Signup` | Business Owner or Fractional CFO role toggle; `?role=partner` pre-selects CFO tab |
| `/login` | `Login` | Respects `?next=` query param for post-login deep links |

### Onboarding

| Path | Screen |
|---|---|
| `/onboard/upload` | Excel / CSV P&L upload |
| `/onboard/qbo` | QuickBooks Online OAuth |
| `/onboard/manual` | Manual line-item entry |
| `/onboard/reveal` | Profit Score reveal (unauthenticated preview) |
| `/import/confirm` | Confirm uploaded column mapping |
| `/import/review` | Final review before calculate |
| `/email-capture` | Signup gate (skipped for authenticated users) |

### Owner App (`/app/*`) — requires auth

| Path | Screen | Tier |
|---|---|---|
| `/app/input` | Input Engine | Free |
| `/app/dashboard` | Profit Dashboard | Free |
| `/app/owner-pay-gap` | Owner Pay Gap | Free |
| `/app/breakeven` | Breakeven Calculator | Clarity |
| `/app/productivity` | Productivity Scorecard | Clarity |
| `/app/leaks` | Profit Leaks Finder | Clarity |
| `/app/forecast` | **5-Year Profit Forecast** (ForecastView) | Clarity |
| `/app/forecast-classic` | 12-Month Trend Forecast (legacy) | Clarity |
| `/app/rolling12` | Rolling 12 Analysis | Clarity |
| `/app/pricing` | Pricing Calculator | Clarity |
| `/app/integrations` | Integration Hub | Clarity |
| `/app/four-forces` | Four Forces Allocator | Control |
| `/app/scenarios` | Scenario Modeler | Control |
| `/app/action-plan` | AI Action Plan | Control |
| `/app/hire` | Hire Calculator | Harvest |
| `/app/weekly` | Weekly Scorecard | Harvest |
| `/app/pay-roadmap` | Owner Pay Roadmap | Harvest |

### Partner App (`/partner/*`) — requires `user_type: 'partner'`

| Path | Screen |
|---|---|
| `/partner/dashboard` | Partner Dashboard |
| `/partner/whitelabel` | White-Label Settings |
| `/partner/addons` | Add-On Settings |

---

## 5-Year Forecast Module

The forecast is fully self-contained — drop-in, no server dependency.

### Files

| File | Role |
|---|---|
| `client/src/utils/ForecastEngine.js` | Pure calculation — no UI, no React |
| `client/src/screens/ForecastView.jsx` | All display logic; imports engine only |

### ForecastEngine Calculation Blocks

**Block 1 — Rolling 12 Baseline**
Sums trailing 12 months of `monthlyHistory`; falls back to annualized `inputs` when history is sparse.
Produces TTM totals for all line items plus all six ratios (GM%, CM%, LPR, MPR, ManPR, Pretax%).

**Block 2 — YoY Pattern Analysis (up to 4 years)**
- Seasonal index: 12 multipliers per line item (requires 24+ months)
- YoY growth rate per line item (requires 13+ months)
- Lines with YoY standard deviation > 20% are flagged as `volatileLines`

**Block 3 — True Breakeven (monthly, seasonal)**
- `Fixed Costs = Marketing + OpEx + Row 23 + Row 42`
- `Breakeven = Fixed Costs / (CM% − Target%)`
- Seasonal multipliers shift the breakeven amount month to month
- Returns a 12-element array (`breakevenByMonth`)

**Block 4 — 5-Year Forward Forecast (60 months)**
- Year 1: `baseline × (1 + g)`; Years 2–5 compound with 0.85 dampening factor from Year 3 onward
- Full P&L waterfall recalculated every month
- Owner pay held constant; all other items maintain TTM ratios to revenue
- Status per month: `healthy` / `warning` / `critical`

**Block 5 — Reverse Target Solver**
- `Required Revenue = Fixed Costs / (CM% − Target%)` × seasonal index
- 60-month array; gap = Required minus Forecast (positive = shortfall)

**Block 6 — Seasonal Action Triggers**
- Warning/critical months get a primary leak diagnosis:
  - LPR < 2.5 → Job Leak
  - MPR < 5 → Marketing Leak
  - ManPR < 1.0 → Overhead Leak
  - All ratios healthy but pretax still low → Breakeven Gap

### ForecastView Display

| Tab | Content |
|---|---|
| **5-Year Summary** | Annual table; color-coded rows; optional Required Revenue row per year with surplus / shortfall |
| **Monthly Detail** | Recharts ComposedChart — navy actual area, blue forecast area, dashed orange breakeven, dotted required revenue; ReferenceArea red shading on critical spans; scrollable MonthCard row below |
| **Ratio Trends** | LineChart — LPR / MPR / ManPR across actuals + forecast; shaded target bands; red dot on below-target months |

Owner controls at top: Target Pretax %, Revenue Growth slider (0–30%, defaults to YoY), Owner Pay (annual), breakeven/required overlays.

---

## Auth Flow

| Scenario | Result |
|---|---|
| Unauthenticated user uploads file | Scores calculate; routed to `/email-capture` with `?next=/app/dashboard` |
| Authenticated user uploads file | Skips email capture; goes directly to `/app/dashboard` |
| New owner signup | Creates `user_type: 'owner'` account; redirects to `/app/dashboard` |
| New CFO signup (`/signup?role=partner`) | Creates owner account, immediately calls `/auth/partner-upgrade`, then `window.location.replace('/partner/dashboard')` (hard reload prevents `PartnerRoute` race condition) |
| Existing owner upgrades to partner | `TierPresentationModal` calls `/auth/partner-upgrade`; same hard-reload pattern |
| Login with `?next=` param | Post-login redirect honors the `next` path |

---

## Tier Presentation Modal

`TierPresentationModal` (`client/src/components/TierPresentationModal.jsx`) is launched from:
- `NavSidebar` — current tier label button and "Upgrade" CTA
- `LockedOverlay` — "See what's included" link on locked screens
- `NavSidebar` — "Become a Fractional CFO" button (opens `partner_starter` tab)

Content per tier (label, price, tagline, benefits, slides) is defined in `shared/tierPresentations.js`.

---

## Key Shared Files

| File | Purpose |
|---|---|
| `shared/constants.js` | `TIERS`, `TIER_RANK`, `TIER_PRICES`, `USER_TYPES`, `PARTNER_SEAT_LIMITS`, `AI_MODELS` |
| `shared/schema.js` | `INPUT_SHAPE`, `INPUT_SECTIONS`, `validateInputs` |
| `shared/tierPresentations.js` | Per-tier marketing content for `TierPresentationModal` |
| `server/calculations/` | Authoritative server-side P&L engine |
| `client/src/utils/ForecastEngine.js` | Client-side 5-year forecast engine |
| `client/src/utils/calendarRolling12.js` | TTM calendar utilities (`sumCalendarTTM`, `buildCalendarRollingPeriods`) |
| `client/src/utils/format.js` | `formatCurrency`, `formatCompact`, `formatPercent`, `formatMultiplier` |

---

*Your Numbers Made Easy.*
