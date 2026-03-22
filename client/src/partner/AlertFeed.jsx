import { useNavigate } from 'react-router-dom';

const ALERT_ICONS = {
  score_drop: '📉',
  streak_broken: '⚠️',
  level_up: '🎉',
};

const SEVERITY_STYLES = {
  high: 'border-l-red-500 bg-red-500/10',
  medium: 'border-l-yellow-500 bg-yellow-500/10',
  positive: 'border-l-green-500 bg-green-500/10',
};

export default function AlertFeed({ alerts }) {
  const navigate = useNavigate();

  if (!alerts || alerts.length === 0) {
    return (
      <div className="bg-navy-light rounded-xl p-6 text-center">
        <p className="text-stone text-sm font-body">No alerts right now. Your clients are steady.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`rounded-lg border-l-4 p-3 cursor-pointer hover:opacity-90 transition ${SEVERITY_STYLES[alert.severity] || ''}`}
          onClick={() => navigate(`/partner/client/${alert.client_user_id}`)}
        >
          <div className="flex items-start gap-2">
            <span className="text-lg">{ALERT_ICONS[alert.type] || '📋'}</span>
            <div>
              <div className="text-white text-sm font-heading font-semibold">
                {alert.business_name || alert.client_name}
              </div>
              <div className="text-stone text-xs font-body">{alert.message}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
