/**
 * The old self-serve plans ($19.99 / $49.99 / $99.99) are retired. Clients are
 * invited by their CFO and see every screen in their menu, so this gate now
 * lets everything through. Kept as a component so routes don't need rewiring
 * if plan-based access comes back.
 */
export default function TierGate({ children }) {
  return children;
}
