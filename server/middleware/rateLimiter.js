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

// Throttles credential stuffing and bulk signup. Applied to /auth/login and /auth/signup.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts. Try again in 15 minutes.' },
});

// Catch-all backstop for unauthenticated abuse. Applied globally in server/index.js.
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Please slow down.' },
});

// Per-user upload throttle. /health and SSE chat endpoints are excluded via skip.
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Upload rate limit exceeded. Try again in an hour.' },
});

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
