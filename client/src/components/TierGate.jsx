import { useAuth } from '../hooks/useAuth.js';
import LockedOverlay from './LockedOverlay.jsx';
import { TIER_RANK } from '../../../shared/constants.js';

export default function TierGate({ required, children }) {
  const { user } = useAuth();
  const userRank = TIER_RANK[user?.tier] || 0;
  const requiredRank = TIER_RANK[required] || 0;

  if (userRank < requiredRank) {
    return <LockedOverlay requiredTier={required}>{children}</LockedOverlay>;
  }

  return children;
}
