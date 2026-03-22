const DOLLAR_PATTERN = /\$[\d,]+\.?\d*/g;
const LARGE_NUMBER_PATTERN = /\b\d{4,}\b/g;
const SENSITIVE_KEYS = [
  'revenue', 'profit', 'salary', 'wage', 'income', 'gap', 'cogs',
  'labor', 'marketing', 'opex', 'rent', 'insurance', 'subcontractors',
  'tax', 'cash_flow', 'distribution', 'debt', 'cost', 'margin',
  'gross_margin', 'contribution_margin', 'pretax', 'post_tax',
  'owner_pay', 'owner_direct_labor', 'owner_management_wage',
  'access_token', 'refresh_token', 'stripe_customer_id', 'email',
  'full_name', 'business_name',
];

function redactValue(key, value) {
  if (typeof value === 'string') {
    let redacted = value.replace(DOLLAR_PATTERN, '[REDACTED]');
    const lowerKey = (key || '').toLowerCase();
    if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk))) {
      return '[REDACTED]';
    }
    redacted = redacted.replace(LARGE_NUMBER_PATTERN, (match) => {
      return parseInt(match, 10) > 999 ? '[REDACTED]' : match;
    });
    return redacted;
  }
  if (typeof value === 'number') {
    const lowerKey = (key || '').toLowerCase();
    if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk))) {
      return '[REDACTED]';
    }
    if (value > 999) return '[REDACTED]';
  }
  return value;
}

function redactObject(obj, depth = 0) {
  if (depth > 10) return '[NESTED]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => redactObject(item, depth + 1));

  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'object' && val !== null) {
      clean[key] = redactObject(val, depth + 1);
    } else {
      clean[key] = redactValue(key, val);
    }
  }
  return clean;
}

export function logSanitizer(req, res, next) {
  const origJson = res.json.bind(res);
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  function sanitizeArgs(args) {
    return args.map((arg) => {
      if (typeof arg === 'string') {
        return arg.replace(DOLLAR_PATTERN, '[REDACTED]');
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.parse(JSON.stringify(redactObject(arg)));
        } catch {
          return '[REDACTED_OBJECT]';
        }
      }
      return arg;
    });
  }

  console.log = (...args) => origLog(...sanitizeArgs(args));
  console.warn = (...args) => origWarn(...sanitizeArgs(args));
  console.error = (...args) => origError(...sanitizeArgs(args));

  res.on('finish', () => {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  });

  next();
}
