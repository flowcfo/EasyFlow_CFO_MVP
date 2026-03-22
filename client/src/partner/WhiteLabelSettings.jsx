import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../utils/api.js';

export default function WhiteLabelSettings() {
  const [config, setConfig] = useState({ brand_name: '', logo_url: '', primary_color: '#F05001' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const data = await api.get('/partner/whitelabel');
      setConfig(data);
    } catch (err) {
      console.error('Failed to load white-label config:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.post('/partner/whitelabel', config);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="skeleton h-64 rounded-xl" />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-white">White-Label Settings</h1>
      <p className="text-stone font-body text-sm">
        These settings control how your clients see the platform. Your brand replaces Easy Numbers on all client screens and PDF outputs.
      </p>

      <div className="bg-navy-light rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-body text-stone mb-1">Brand Name</label>
          <input
            type="text"
            value={config.brand_name}
            onChange={(e) => setConfig({ ...config, brand_name: e.target.value })}
            className="w-full bg-navy border border-stone/30 rounded-lg px-3 py-2 text-white font-body focus:border-orange focus:ring-1 focus:ring-orange outline-none"
            placeholder="Your CFO Practice Name"
          />
          <p className="text-stone text-xs mt-1 font-body">
            This name appears in AI responses, PDF headers, and client-facing screens.
          </p>
        </div>

        <div>
          <label className="block text-sm font-body text-stone mb-1">Primary Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={config.primary_color}
              onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
              className="w-12 h-10 rounded border border-stone/30 cursor-pointer"
            />
            <input
              type="text"
              value={config.primary_color}
              onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
              className="bg-navy border border-stone/30 rounded-lg px-3 py-2 text-white font-body w-32 focus:border-orange outline-none"
            />
            <div
              className="w-10 h-10 rounded-lg"
              style={{ backgroundColor: config.primary_color }}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-body text-stone mb-1">Logo URL</label>
          <input
            type="text"
            value={config.logo_url || ''}
            onChange={(e) => setConfig({ ...config, logo_url: e.target.value })}
            className="w-full bg-navy border border-stone/30 rounded-lg px-3 py-2 text-white font-body focus:border-orange focus:ring-1 focus:ring-orange outline-none"
            placeholder="https://..."
          />
          {config.logo_url && (
            <div className="mt-3 bg-navy rounded-lg p-4 inline-block">
              <img src={config.logo_url} alt="Logo preview" className="h-12 max-w-48 object-contain" />
            </div>
          )}
        </div>

        <div className="pt-2">
          <div className="bg-navy rounded-xl p-4 border border-stone/20">
            <div className="text-stone text-xs font-body uppercase tracking-wide mb-2">Preview</div>
            <div className="flex items-center gap-3">
              {config.logo_url && (
                <img src={config.logo_url} alt="" className="h-8 object-contain" />
              )}
              <span className="font-heading font-bold text-lg" style={{ color: config.primary_color }}>
                {config.brand_name || 'Your Brand'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-orange text-white px-6 py-2 rounded-lg font-heading font-semibold hover:bg-orange/90 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
