export const TIER_PRESENTATIONS = {
  free: {
    label: 'Free',
    price: null,
    tagline: 'Know your numbers. For free.',
    color: '#8A8278',
    icon: '📊',
    whatMatters: [
      'Your Profit Score at a glance',
      'Full P&L waterfall — Revenue through Pre-Tax Profit',
      'Owner Pay Gap — are you paying yourself fairly?',
    ],
    slides: [
      {
        heading: 'Your Profit Score',
        body: 'A single 0–100 number that tells you how healthy your business is — based on labor productivity, marketing return, owner pay, and pre-tax margin. Not just revenue.',
      },
      {
        heading: 'Profit Dashboard',
        body: 'See your full P&L as a waterfall: Revenue → Gross Margin → Contribution Margin → Pre-Tax Profit. Know exactly where the money is going before you guess.',
      },
      {
        heading: 'Owner Pay Gap',
        body: 'Most owners pay themselves last. This screen shows the gap between what you earn and what a manager would cost — and what that gap is doing to your wealth over time.',
      },
    ],
  },

  clarity: {
    label: 'Clarity',
    price: 19.99,
    tagline: 'Stop guessing. Start knowing.',
    color: '#3B82F6',
    icon: '🔍',
    whatMatters: [
      'Know exactly where profit is leaking',
      'Break-even in seconds',
      'Forecast the next 12 months',
      'Pricing that protects your margin',
    ],
    slides: [
      {
        heading: 'Breakeven Calculator',
        body: 'How many dollars do you need to cover costs? What does 5% or 10% profit look like in your business? This screen makes it concrete in seconds.',
      },
      {
        heading: 'Productivity Scorecard',
        body: 'Three core ratios — Direct LPR, MPR, ManPR — benchmarked against where you need to be. Color-coded so you know which lever to pull first.',
      },
      {
        heading: 'Profit Leaks Finder',
        body: 'Surfaces the top 3 places money is leaking. Each leak comes with a suggested fix and an estimated dollar impact.',
      },
      {
        heading: '12-Month Forecast',
        body: 'Set a growth rate, adjust owner pay, and see what your P&L looks like 12 months from now. Includes break-even month and projected owner pay gap.',
      },
      {
        heading: 'Rolling 12 P&L',
        body: 'Month-by-month trending. Spot seasonal patterns, check if improvements are sticking, and catch problems before they compound.',
      },
      {
        heading: 'Pricing Calculator',
        body: 'Input direct costs and target multiplier. See the right price to protect margin — and what you lose every time you discount.',
      },
    ],
  },

  control: {
    label: 'Control',
    price: 49.99,
    tagline: 'Know what to do next. Every time.',
    color: '#8B5CF6',
    icon: '🎯',
    whatMatters: [
      'Allocate every dollar with purpose',
      'Model "what if" before you commit',
      'AI advisor — ask your numbers anything',
      'A written action plan, ready to execute',
    ],
    slides: [
      {
        heading: 'Four Forces Allocator',
        body: 'Split revenue across Owner Pay, Profit, Operating Costs, and Taxes using your actual numbers. See if your current allocation will sustain the business.',
      },
      {
        heading: 'Scenario Modeler',
        body: 'What if you hire someone? Add a service line? Raise prices 10%? Run up to 3 scenarios side by side before making the call.',
      },
      {
        heading: 'Action Plan (AI)',
        body: 'AI builds a prioritized 90-day action plan based on your Profit Score, your leaks, and your top 3 moves. Updated every time you recalculate.',
      },
      {
        heading: 'Conversational CFO',
        body: 'Ask your numbers anything. "Why is my margin dropping?" "What do I fix first?" You get a direct answer grounded in your actual data — not a search result.',
      },
    ],
  },

  harvest: {
    label: 'Harvest',
    price: 99.99,
    tagline: 'Run the business. Build the wealth.',
    color: '#F59E0B',
    icon: '🌾',
    whatMatters: [
      'Know the real cost of your next hire',
      'Track every week — not just year-end',
      'A road map to the owner pay you deserve',
      'Unlimited AI sessions',
    ],
    slides: [
      {
        heading: 'Hire Calculator',
        body: 'Before you hire, run the numbers. Labor Productivity Ratio shows whether the business can afford it — and how much new revenue the hire needs to break even.',
      },
      {
        heading: 'Weekly Scorecard',
        body: 'Enter 5 numbers each week. The scorecard turns them into a real-time view of your trajectory so nothing surprises you at year-end.',
      },
      {
        heading: 'Owner Pay Roadmap',
        body: 'A step-by-step path from your current owner pay to your target. Shows what margin improvement, revenue growth, or overhead reduction gets you there first.',
      },
      {
        heading: 'Unlimited AI',
        body: 'No session caps. Use the Conversational CFO as often as you need — for prep, for decisions, for clarity on any number in the business.',
      },
    ],
  },

  partner_starter: {
    label: 'Partner Starter',
    price: 199,
    tagline: 'Your CFO practice. Powered by data.',
    color: '#10B981',
    icon: '🤝',
    whatMatters: [
      'Manage up to 5 business owner clients',
      'Client Book — all scores in one view',
      'White-label branding (your name, your colors)',
      'Invite clients directly from the platform',
    ],
    slides: [
      {
        heading: 'Client Book',
        body: 'See all clients in one dashboard — Profit Scores, tier, and last activity. Spot who needs attention before the meeting.',
      },
      {
        heading: 'White-Label Branding',
        body: "Replace 'Easy Numbers' with your practice name, logo, and brand color. Clients see your brand — you get the platform behind it.",
      },
      {
        heading: 'Client Invites',
        body: 'Invite clients by email. They onboard under your practice. Their data is yours to view — their login is theirs to control.',
      },
    ],
  },

  partner_growth: {
    label: 'Partner Growth',
    price: 499,
    tagline: 'Scale your advisory practice.',
    color: '#06B6D4',
    icon: '📈',
    whatMatters: [
      'Up to 20 clients',
      'AI add-ons: CFO Chat, Briefing Generator, Meeting Prep',
      'Everything in Partner Starter',
    ],
    slides: [
      {
        heading: 'Up to 20 Clients',
        body: 'As your book grows, your seat limit grows. Manage up to 20 business owners from a single login.',
      },
      {
        heading: 'CFO Chat Add-On',
        body: 'Ask portfolio-level questions. "Which clients have the worst margin?" AI answers across your entire book.',
      },
      {
        heading: 'Client Briefing Generator',
        body: 'Auto-generate a 5-sentence briefing before each review. Pull key numbers, flag the top issue, walk in prepared.',
      },
      {
        heading: 'Meeting Prep Mode',
        body: "Enter a meeting topic. AI generates talking points, numbers to reference, and recommended actions — grounded in that client's data.",
      },
    ],
  },

  partner_scale: {
    label: 'Partner Scale',
    price: 999,
    tagline: 'Unlimited. Everything included.',
    color: '#F05001',
    icon: '🚀',
    whatMatters: [
      'Unlimited clients',
      'All AI add-ons included',
      'Portfolio AI — cross-client intelligence',
      'Everything in Partner Growth',
    ],
    slides: [
      {
        heading: 'Unlimited Clients',
        body: 'No seat cap. Run as large a book as your practice demands.',
      },
      {
        heading: 'AI Portfolio Assistant',
        body: 'Analyze risk across your entire client portfolio — identify at-risk clients, find those closest to leveling up, surface patterns across the book.',
      },
      {
        heading: 'Everything Included',
        body: 'CFO Chat, Briefing Generator, Meeting Prep, and Portfolio AI — all included. One price, full capability.',
      },
    ],
  },
};
