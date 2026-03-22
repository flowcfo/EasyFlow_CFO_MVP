import rateLimit from 'express-rate-limit';
import { TIER_RANK } from '../../shared/constants.js';

const AI_REQUESTS_PER_HOUR = {
  clarity: 20,
  control: 30,
  harvest: 50,
  partner_starter: 50,
  partner_growth: 50,
  partner_scale: 50,
};

export function aiRateLimiter(req, res, next) {
  const tier = req.user?.tier || 'free';
  const rank = TIER_RANK[tier] ?? 0;

  if (rank < TIER_RANK.clarity) {
    return res.status(403).json({
      error: 'AI features require a paid tier',
      required_tier: 'clarity',
    });
  }

  const maxRequests = AI_REQUESTS_PER_HOUR[tier] || 20;

  const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: maxRequests,
    keyGenerator: (req) => req.user.id,
    message: {
      error: 'Rate limit exceeded',
      message: `You have reached your limit of ${maxRequests} AI requests per hour.`,
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  return limiter(req, res, next);
}
