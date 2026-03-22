export const TIERS = {
  FREE: 'free',
  CLARITY: 'clarity',
  CONTROL: 'control',
  HARVEST: 'harvest',
  PARTNER_STARTER: 'partner_starter',
  PARTNER_GROWTH: 'partner_growth',
  PARTNER_SCALE: 'partner_scale',
};

export const USER_TYPES = {
  OWNER: 'owner',
  PARTNER: 'partner',
  CLIENT: 'client',
};

export const TIER_PRICES = {
  [TIERS.CLARITY]: 19.99,
  [TIERS.CONTROL]: 49.99,
  [TIERS.HARVEST]: 99.99,
  [TIERS.PARTNER_STARTER]: 199,
  [TIERS.PARTNER_GROWTH]: 499,
  [TIERS.PARTNER_SCALE]: 999,
};

export const TIER_LABELS = {
  [TIERS.FREE]: 'Free',
  [TIERS.CLARITY]: 'Clarity',
  [TIERS.CONTROL]: 'Control',
  [TIERS.HARVEST]: 'Harvest',
  [TIERS.PARTNER_STARTER]: 'Partner Starter',
  [TIERS.PARTNER_GROWTH]: 'Partner Growth',
  [TIERS.PARTNER_SCALE]: 'Partner Scale',
};

export const TIER_TAGLINES = {
  [TIERS.CLARITY]: 'Stop guessing. Start knowing.',
  [TIERS.CONTROL]: 'Know what to do next. Every time.',
  [TIERS.HARVEST]: 'Run the business. Build the wealth.',
};

export const PARTNER_SEAT_LIMITS = {
  [TIERS.PARTNER_STARTER]: 5,
  [TIERS.PARTNER_GROWTH]: 20,
  [TIERS.PARTNER_SCALE]: Infinity,
};

export const ADDITIONAL_SEAT_PRICE = 25;

export const TIER_RANK = {
  free: 0,
  clarity: 1,
  control: 2,
  harvest: 3,
  partner_starter: 4,
  partner_growth: 5,
  partner_scale: 6,
};

// Screen access by minimum tier
export const SCREEN_ACCESS = {
  1: 'free',        // Input Engine
  2: 'free',        // Profit Dashboard
  3: 'free',        // Owner Pay Gap
  4: 'clarity',     // Breakeven Calculator
  5: 'clarity',     // Productivity Scorecard
  6: 'clarity',     // Profit Leaks Finder
  7: 'control',     // Four Forces Allocator
  8: 'control',     // Scenario Modeler
  9: 'clarity',     // 12-Month Forecast
  10: 'harvest',    // Hire Calculator
  11: 'clarity',    // Pricing Calculator (with Pricing AI)
  12: 'harvest',    // Weekly Scorecard
  13: 'harvest',    // Owner Pay Roadmap
  14: 'control',    // Action Plan (AI for Control+)
};

export const SNAPSHOT_LIMITS = {
  [TIERS.FREE]: 1,
  [TIERS.CLARITY]: 3,
  [TIERS.CONTROL]: Infinity,
  [TIERS.HARVEST]: Infinity,
};

export const AI_SESSION_LIMITS = {
  [TIERS.CONTROL]: 10,
  [TIERS.HARVEST]: Infinity,
  [TIERS.PARTNER_STARTER]: Infinity,
  [TIERS.PARTNER_GROWTH]: Infinity,
  [TIERS.PARTNER_SCALE]: Infinity,
};

export const REVENUE_BANDS = [
  '100k-200k',
  '200k-500k',
  '500k-850k',
  '850k-2m',
  '2m-3.5m',
  '3.5m-5m',
];

export const PROFIT_TIER_THRESHOLDS = [
  { tier: 1, label: 'Crisis', min: -Infinity, max: 0 },
  { tier: 2, label: 'Survival', min: 0, max: 0.05 },
  { tier: 3, label: 'Stability', min: 0.05, max: 0.10 },
  { tier: 4, label: 'Healthy', min: 0.10, max: 0.20 },
  { tier: 5, label: 'Wealth Mode', min: 0.20, max: Infinity },
];

export const TIER_MESSAGES = {
  1: 'Your business is consuming your personal wealth. One thing to fix first.',
  2: 'You are covering costs but not building wealth. Here is your next move.',
  3: 'You have a stable business. Here is what separates stable from thriving.',
  4: 'You are running a healthy business. Protect this and build on it.',
  5: 'You are harvesting wealth. Here is how to make it compound.',
};

export const TIER_COLORS = {
  1: '#dc2626',
  2: '#F05001',
  3: '#eab308',
  4: '#22c55e',
  5: '#f59e0b',
};

export const LPR_THRESHOLDS = {
  direct_lpr: {
    blue: 3.5,
    green: 2.5,
    yellow: 2.0,
    target_low: 2.5,
    target_high: 3.5,
  },
  mpr: {
    green: 5.0,
    yellow: 3.0,
    target: 5.0,
  },
  manpr: {
    green: 1.0,
    yellow: 0.75,
    target: 1.0,
  },
};

export const PROFIT_SCORE_WEIGHTS = {
  direct_lpr: { max: 25, thresholds: [{ min: 2.5, pts: 25 }, { min: 2.0, pts: 15 }, { min: 1.5, pts: 8 }] },
  mpr: { max: 20, thresholds: [{ min: 5.0, pts: 20 }, { min: 3.0, pts: 12 }, { min: 2.0, pts: 6 }] },
  manpr: { max: 20, thresholds: [{ min: 1.0, pts: 20 }, { min: 0.75, pts: 12 }, { min: 0.5, pts: 6 }] },
  pretax_pct: { max: 25, thresholds: [{ min: 0.20, pts: 25 }, { min: 0.10, pts: 20 }, { min: 0.05, pts: 12 }, { min: 0, pts: 6 }] },
  owner_pay_gap: { max: 10, thresholds: [{ maxGapPct: 0, pts: 10 }, { maxGapPct: 0.20, pts: 7 }, { maxGapPct: 0.50, pts: 4 }] },
};

export const BREAKEVEN_TARGETS = [0, 0.03, 0.05, 0.10, 0.15];

export const PRICING_MULTIPLIERS = [2.0, 2.5, 2.75, 3.0, 3.5, 4.0, 5.0];

export const DEFAULTS = {
  tax_rate: 0.40,
  core_capital_months: 2,
  owner_pay_example: 30000,
  benefits_pct: 0.15,
  target_cm_pct: 0.40,
  monthly_growth_rate: 0,
};

// Order matches nav: Clarity tools (forecast → rolling → pricing), then Control (four forces, scenarios, action plan), then Harvest.
export const SCREEN_NAMES = [
  { id: 1, name: 'Input Engine', tier: 'free' },
  { id: 2, name: 'Profit Dashboard', tier: 'free' },
  { id: 3, name: 'Owner Pay Gap', tier: 'free' },
  { id: 4, name: 'Breakeven Calculator', tier: 'clarity' },
  { id: 5, name: 'Productivity Scorecard', tier: 'clarity' },
  { id: 6, name: 'Profit Leaks Finder', tier: 'clarity' },
  { id: 9, name: '12-Month Forecast', tier: 'clarity' },
  { id: 10, name: 'Rolling 12 P&L', tier: 'clarity' },
  { id: 11, name: 'Pricing Calculator', tier: 'clarity' },
  { id: 7, name: 'Four Forces Allocator', tier: 'control' },
  { id: 8, name: 'Scenario Modeler', tier: 'control' },
  { id: 15, name: 'Action Plan', tier: 'control' },
  { id: 12, name: 'Hire Calculator', tier: 'harvest' },
  { id: 13, name: 'Weekly Scorecard', tier: 'harvest' },
  { id: 14, name: 'Owner Pay Roadmap', tier: 'harvest' },
  { id: 16, name: 'Partner Dashboard', tier: 'partner_starter' },
];

export const AI_MODELS = {
  SONNET: 'claude-sonnet-4-5-20250514',
  HAIKU: 'claude-haiku-4-5-20250514',
};

export const RESPONSE_MODES = {
  COMIC: 'comic',
  CLASSIC: 'classic',
};

export const COMIC_PANEL_TYPES = {
  SITUATION: 'situation',
  PROBLEM: 'problem',
  CONSEQUENCE: 'consequence',
  ACTION: 'action',
};

export const COMIC_VISUAL_TYPES = {
  GAUGE: 'gauge',
  GAP_BAR: 'gap_bar',
  METER: 'meter',
  ACTION_ARROW: 'action_arrow',
};

export const DYNAMIC_STARTER_RULES = [
  { condition: 'direct_lpr < 2.5', question: 'Why is my labor cost eating my margin?' },
  { condition: 'mpr < 3.0', question: 'Is my marketing spend actually working?' },
  { condition: 'gap_pct > 0.30', question: 'What do I need to do to pay myself more?' },
  { condition: 'profit_tier <= 2', question: 'What is the single fastest thing I can fix?' },
  { condition: 'profit_tier >= 4', question: 'How do I protect this and keep building?' },
  { condition: 'breakeven_gap > 0.20', question: 'How far am I from actually breaking even?' },
  { condition: 'manpr < 1.0', question: 'Why does my overhead feel out of control?' },
];

export const PARTNER_ADDONS = {
  cfo_chat: {
    key: 'addon_cfo_chat',
    name: 'Partner CFO Chat',
    price: 49,
    description: 'Conversational CFO for your own use. Portfolio-level questions, meeting prep, talking points.',
    model: 'SONNET',
    available_on: ['starter', 'growth'],
    included_on: ['growth', 'scale'],
  },
  briefing_gen: {
    key: 'addon_briefing_gen',
    name: 'Client Briefing Generator',
    price: 49,
    description: 'Auto-generates a 5-sentence client briefing before every scheduled review.',
    model: 'HAIKU',
    available_on: ['starter', 'growth'],
    included_on: ['scale'],
  },
  meeting_prep: {
    key: 'addon_meeting_prep',
    name: 'Meeting Prep Mode',
    price: 49,
    description: 'Enter a meeting topic. AI generates talking points, numbers to reference, and recommended actions.',
    model: 'SONNET',
    available_on: ['starter', 'growth'],
    included_on: ['scale'],
  },
  portfolio_ai: {
    key: 'addon_portfolio_ai',
    name: 'AI Portfolio Assistant',
    price: 99,
    description: 'Cross-client portfolio intelligence. Identify at-risk clients, worst ratios, closest to leveling up.',
    model: 'SONNET',
    available_on: ['growth'],
    included_on: ['scale'],
  },
};
