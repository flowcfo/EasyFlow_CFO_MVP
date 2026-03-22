import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../utils/api.js';
import { PARTNER_ADDONS } from '../../../shared/constants.js';

export default function AddonSettings() {
  const [addons, setAddons] = useState([]);
  const [plan, setPlan] = useState('');
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(null);

  useEffect(() => {
    loadAddons();
  }, []);

  async function loadAddons() {
    try {
      const data = await api.get('/partner/addons');
      setAddons(data.addons);
      setPlan(data.plan);
    } catch (err) {
      console.error('Failed to load addons:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate(addonId) {
    setActivating(addonId);
    try {
      await api.post('/partner/addons/activate', { addon_id: addonId });
      await loadAddons();
    } catch (err) {
      console.error('Failed to activate addon:', err);
    } finally {
      setActivating(null);
    }
  }

  async function handleDeactivate(addonId) {
    setActivating(addonId);
    try {
      await api.delete(`/partner/addons/${addonId}`);
      await loadAddons();
    } catch (err) {
      console.error('Failed to deactivate addon:', err);
    } finally {
      setActivating(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card-dark">
            <div className="skeleton h-6 w-48 mb-2" />
            <div className="skeleton h-4 w-full mb-4" />
            <div className="skeleton h-10 w-32" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-sora text-xl font-bold text-white mb-1">AI Add-Ons</h2>
        <p className="font-mulish text-sm text-stone">
          Supercharge your practice with AI tools. Your plan: <span className="text-orange capitalize">{plan}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {addons.map((addon) => (
          <motion.div
            key={addon.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`card-dark border ${addon.active ? 'border-green-500/30' : addon.available ? 'border-white/10' : 'border-white/5 opacity-60'}`}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-sora text-sm font-bold text-white">{addon.name}</h3>
              {addon.included && (
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-mulish rounded-full">
                  Included
                </span>
              )}
              {addon.active && !addon.included && (
                <span className="px-2 py-0.5 bg-orange/20 text-orange text-xs font-mulish rounded-full">
                  Active
                </span>
              )}
              {!addon.available && (
                <span className="px-2 py-0.5 bg-stone/20 text-stone text-xs font-mulish rounded-full">
                  Not available
                </span>
              )}
            </div>

            <p className="font-mulish text-xs text-stone mb-4">{addon.description}</p>

            <div className="flex items-center justify-between">
              <span className="font-sora text-sm text-white">
                {addon.included ? 'Free with plan' : `$${addon.price}/mo`}
              </span>

              {addon.included ? (
                <span className="font-mulish text-xs text-green-400">Active</span>
              ) : addon.active ? (
                <button
                  onClick={() => handleDeactivate(addon.id)}
                  disabled={activating === addon.id}
                  className="btn-ghost text-xs text-status-red hover:text-red-300 disabled:opacity-50"
                >
                  {activating === addon.id ? 'Processing...' : 'Deactivate'}
                </button>
              ) : addon.available ? (
                <button
                  onClick={() => handleActivate(addon.id)}
                  disabled={activating === addon.id}
                  className="btn-primary text-xs px-4 py-1.5 disabled:opacity-50"
                >
                  {activating === addon.id ? 'Processing...' : 'Activate'}
                </button>
              ) : (
                <span className="font-mulish text-xs text-stone">Upgrade plan to unlock</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="card-dark border border-white/5">
        <p className="font-mulish text-xs text-stone">
          Add-ons are billed as separate subscriptions. Deactivating an add-on cancels at the end of your current billing period.
          Upgrade to Partner Scale ($999/mo) to include all add-ons automatically.
        </p>
      </div>
    </div>
  );
}
