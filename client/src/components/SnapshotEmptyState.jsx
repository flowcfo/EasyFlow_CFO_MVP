import { Link } from 'react-router-dom';

export default function SnapshotEmptyState({ error, onRetry }) {
  return (
    <div className="card-dark text-center py-12 px-6 space-y-4 max-w-lg mx-auto">
      <h2 className="font-sora text-lg font-semibold text-white">No results yet</h2>
      <p className="font-mulish text-sm text-stone">
        Enter your numbers on <strong className="text-white">Input</strong> (or import / demo data), then use{' '}
        <strong className="text-white">Calculate My Profit Score</strong>. Dashboards need at least one successful
        calculation.
      </p>
      {error && (
        <p className="font-mulish text-sm text-status-red bg-status-red/10 rounded-lg py-2 px-3">{error}</p>
      )}
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn-primary py-2.5 px-6 font-sora text-sm">
            Retry calculation
          </button>
        )}
        <Link to="/app/input" className="btn-primary py-2.5 px-6 font-sora text-sm text-center inline-block">
          Go to Input
        </Link>
      </div>
    </div>
  );
}
