import { TIER_RANK, TIER_LABELS } from '../../shared/constants.js';

export function tierGuard(requiredTier) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRank = TIER_RANK[req.user.tier] ?? 0;
    const requiredRank = TIER_RANK[requiredTier] ?? 0;

    if (userRank < requiredRank) {
      const label = TIER_LABELS[requiredTier] || requiredTier;
      return res.status(403).json({
        error: 'Upgrade required',
        required_tier: requiredTier,
        current_tier: req.user.tier,
        message: `This feature requires the ${label} tier or higher.`,
      });
    }

    next();
  };
}
