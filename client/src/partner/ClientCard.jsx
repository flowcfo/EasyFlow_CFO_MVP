import { useNavigate } from 'react-router-dom';

const TIER_LABELS = { 1: 'Crisis', 2: 'Traction', 3: 'Stable', 4: 'Healthy', 5: 'Wealth' };
const TIER_COLORS = { 1: '#dc2626', 2: '#F05001', 3: '#eab308', 4: '#22c55e', 5: '#f59e0b' };

export default function ClientCard({ client }) {
  const navigate = useNavigate();

  const tierColor = TIER_COLORS[client.profit_tier] || '#8A8278';
  const tierLabel = TIER_LABELS[client.profit_tier] || 'Unknown';
  const lastActivity = client.last_activity
    ? new Date(client.last_activity).toLocaleDateString()
    : 'N/A';

  return (
    <div
      className="bg-navy-light rounded-xl p-4 border-l-4 cursor-pointer hover:bg-navy-light/80 transition"
      style={{ borderLeftColor: tierColor }}
      onClick={() => navigate(`/partner/client/${client.client_user_id}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-heading font-semibold text-sm">
            {client.business_name || client.client_name}
          </h3>
          {client.business_name && client.client_name && (
            <p className="text-stone text-xs font-body">{client.client_name}</p>
          )}
        </div>
        <span
          className="text-xs font-heading px-2 py-1 rounded-full"
          style={{ backgroundColor: tierColor + '22', color: tierColor }}
        >
          {tierLabel}
        </span>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-3xl font-heading font-bold" style={{ color: tierColor }}>
            {client.profit_score}
          </div>
          <div className="text-stone text-xs font-body">Profit Score</div>
        </div>

        <div className="text-right space-y-1">
          {client.current_streak > 0 && (
            <div className="text-xs font-body text-stone">
              🔥 {client.current_streak}w streak
            </div>
          )}
          <div className="text-xs font-body text-stone">
            Last: {lastActivity}
          </div>
        </div>
      </div>

      {client.status === 'pending' && (
        <div className="mt-2 text-xs font-body text-orange bg-orange/10 px-2 py-1 rounded">
          Invite pending
        </div>
      )}
    </div>
  );
}
