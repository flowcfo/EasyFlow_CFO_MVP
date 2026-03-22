import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../utils/api.js';
import { formatCurrency } from '../utils/format.js';
import ClientCard from './ClientCard.jsx';
import AlertFeed from './AlertFeed.jsx';
import InviteModal from './InviteModal.jsx';

const TIER_LABELS = { 1: 'Crisis', 2: 'Getting Traction', 3: 'Stable', 4: 'Healthy', 5: 'Wealth Mode' };
const TIER_COLORS = { 1: '#dc2626', 2: '#F05001', 3: '#eab308', 4: '#22c55e', 5: '#f59e0b' };

export default function PartnerDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const data = await api.get('/partner/dashboard');
      setDashboard(data);
    } catch (err) {
      console.error('Failed to load partner dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-32 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return <div className="text-stone text-center py-12">Unable to load dashboard.</div>;
  }

  const tierDist = dashboard.tier_distribution || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-white">Partner Dashboard</h1>
        <button
          onClick={() => setShowInvite(true)}
          className="bg-orange text-white px-6 py-2 rounded-lg font-heading font-semibold hover:bg-orange/90 transition"
        >
          Add Client
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Clients" value={dashboard.total_clients} />
        <StatCard label="Avg Score" value={`${dashboard.avg_portfolio_score}/100`} />
        <StatCard
          label="Seats Used"
          value={`${dashboard.seats_used}/${dashboard.seat_limit === 9999 ? '∞' : dashboard.seat_limit}`}
        />
        <div className="bg-navy-light rounded-xl p-4">
          <div className="text-stone text-xs font-body uppercase tracking-wide mb-2">Tier Distribution</div>
          <div className="flex gap-1">
            {Object.entries(tierDist).map(([tier, count]) => (
              count > 0 && (
                <span
                  key={tier}
                  className="text-xs font-heading px-2 py-1 rounded-full"
                  style={{ backgroundColor: TIER_COLORS[tier] + '33', color: TIER_COLORS[tier] }}
                >
                  L{tier}: {count}
                </span>
              )
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-heading font-semibold text-white">Client Book</h2>
          {dashboard.client_cards?.length === 0 ? (
            <div className="bg-navy-light rounded-xl p-8 text-center">
              <p className="text-stone font-body">No clients yet. Add your first client to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence>
                {dashboard.client_cards.map((client, i) => (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <ClientCard client={client} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-heading font-semibold text-white">Alerts</h2>
          <AlertFeed alerts={dashboard.alerts || []} />
        </div>
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            setShowInvite(false);
            loadDashboard();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-navy-light rounded-xl p-4">
      <div className="text-stone text-xs font-body uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-heading font-bold text-white">{value}</div>
    </div>
  );
}
