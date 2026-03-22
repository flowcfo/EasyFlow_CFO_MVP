export function SkeletonLine({ width = '100%', height = '1rem', className = '' }) {
  return <div className={`skeleton ${className}`} style={{ width, height }} />;
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`card-dark space-y-4 ${className}`}>
      <SkeletonLine width="60%" height="1.5rem" />
      <SkeletonLine width="100%" height="1rem" />
      <SkeletonLine width="80%" height="1rem" />
      <SkeletonLine width="40%" height="2rem" />
    </div>
  );
}

export function SkeletonGauge({ size = 200 }) {
  return (
    <div className="skeleton rounded-full" style={{ width: size, height: size }} />
  );
}

export default function SkeletonLoader({ type = 'card', count = 1 }) {
  const items = Array.from({ length: count });

  if (type === 'gauge') {
    return <SkeletonGauge />;
  }

  return (
    <div className="space-y-4">
      {items.map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
