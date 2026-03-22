import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../utils/api.js';

const PROVIDERS = [
  {
    id: 'qbo',
    name: 'QuickBooks Online',
    description: 'Connect your QuickBooks account to auto-import your P&L data.',
    icon: '📊',
    color: '#2CA01C',
    connectPath: '/integrations/qbo/connect',
    pullPath: '/integrations/qbo/pull',
    disconnectPath: '/integrations/qbo/disconnect',
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Pull your Xero P&L report directly into Easy Numbers.',
    icon: '📘',
    color: '#13B5EA',
    connectPath: '/integrations/xero/connect',
    pullPath: '/integrations/xero/pull',
    disconnectPath: '/integrations/xero/disconnect',
  },
  {
    id: 'freshbooks',
    name: 'FreshBooks',
    description: 'Import FreshBooks accounting data for instant analysis.',
    icon: '📗',
    color: '#0075DD',
    connectPath: '/integrations/freshbooks/connect',
    pullPath: '/integrations/freshbooks/pull',
    disconnectPath: '/integrations/freshbooks/disconnect',
  },
  {
    id: 'wave',
    name: 'Wave',
    description: 'Connect your Wave Accounting for free P&L import.',
    icon: '🌊',
    color: '#2757FF',
    connectPath: '/integrations/wave/connect',
    pullPath: '/integrations/wave/pull',
    disconnectPath: '/integrations/wave/disconnect',
  },
  {
    id: 'sage',
    name: 'Sage Business Cloud',
    description: 'Pull Sage financial data into Easy Numbers.',
    icon: '📙',
    color: '#00DC00',
    connectPath: '/integrations/sage/connect',
    pullPath: '/integrations/sage/pull',
    disconnectPath: '/integrations/sage/disconnect',
  },
  {
    id: 'zoho',
    name: 'Zoho Books',
    description: 'Import your Zoho Books P&L report.',
    icon: '📕',
    color: '#C8202B',
    connectPath: '/integrations/zoho/connect',
    pullPath: '/integrations/zoho/pull',
    disconnectPath: '/integrations/zoho/disconnect',
  },
];

export default function IntegrationHub() {
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);

  useEffect(() => {
    loadStatuses();
  }, []);

  async function loadStatuses() {
    try {
      const data = await api.get('/integrations/status');
      setStatuses(data.integrations || {});
    } catch (err) {
      console.error('Failed to load integration statuses:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(provider) {
    setConnecting(provider.id);
    try {
      const data = await api.get(provider.connectPath);
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(`Failed to connect ${provider.name}:`, err);
    } finally {
      setConnecting(null);
    }
  }

  async function handleDemoConnect() {
    setConnecting('demo');
    try {
      await api.post('/integrations/demo/connect');
      await loadStatuses();
    } catch (err) {
      console.error('Demo connect failed:', err);
    } finally {
      setConnecting(null);
    }
  }

  async function handleDisconnect(provider) {
    try {
      await api.delete(provider.disconnectPath);
      setStatuses((prev) => {
        const updated = { ...prev };
        delete updated[provider.id];
        return updated;
      });
    } catch (err) {
      console.error(`Failed to disconnect ${provider.name}:`, err);
    }
  }

  async function handlePull(provider) {
    try {
      const isDemoQBO = provider.id === 'qbo' && statuses.qbo?.realm_id === 'demo-realm-123456';
      const pullPath = isDemoQBO ? '/integrations/demo/pull' : provider.pullPath;

      const now = new Date();
      const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const data = await api.post(pullPath, {
        start_date: yearAgo.toISOString().split('T')[0],
        end_date: now.toISOString().split('T')[0],
      });
      await loadStatuses();
      return data;
    } catch (err) {
      console.error(`Failed to pull from ${provider.name}:`, err);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-white">Integrations</h1>
        <p className="text-stone font-body text-sm mt-1">
          Connect your accounting software to auto-import your financial data. Or upload an Excel/CSV file.
        </p>
      </div>

      <div className="bg-navy-light rounded-xl p-4 border border-orange/20">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📄</span>
          <div className="flex-1">
            <h3 className="text-white font-heading font-semibold">Excel/CSV Upload</h3>
            <p className="text-stone text-xs font-body">Upload a P&L export from any accounting software.</p>
          </div>
          <label className="bg-orange text-white px-4 py-2 rounded-lg font-heading font-semibold text-sm cursor-pointer hover:bg-orange/90 transition">
            Upload File
            <input
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const buffer = await file.arrayBuffer();
                try {
                  const data = await api.upload('/integrations/excel/upload', buffer, file.name);
                  console.log('Parsed:', data);
                } catch (err) {
                  console.error('Upload failed:', err);
                }
              }}
            />
          </label>
        </div>
      </div>

      <div className="bg-gradient-to-r from-orange/20 to-orange/5 rounded-xl p-4 border border-orange/30">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧪</span>
          <div className="flex-1">
            <h3 className="text-white font-heading font-semibold">Demo Mode — QuickBooks Simulation</h3>
            <p className="text-stone text-xs font-body">
              No QuickBooks account? Connect with sample data from a realistic $850K home-services business.
            </p>
          </div>
          {statuses.qbo?.connected ? (
            <span className="text-xs font-body px-2 py-1 rounded-full bg-green-500/20 text-green-400">
              Demo Active
            </span>
          ) : (
            <button
              onClick={handleDemoConnect}
              disabled={connecting === 'demo' || loading}
              className="bg-orange text-white px-4 py-2 rounded-lg font-heading font-semibold text-sm hover:bg-orange/90 transition disabled:opacity-50"
            >
              {connecting === 'demo' ? 'Connecting...' : 'Try Demo'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROVIDERS.map((provider) => {
          const status = statuses[provider.id];
          const isConnected = status?.connected;

          return (
            <motion.div
              key={provider.id}
              className="bg-navy-light rounded-xl p-4 border border-white/5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl">{provider.icon}</span>
                <div className="flex-1">
                  <h3 className="text-white font-heading font-semibold text-sm">{provider.name}</h3>
                  <p className="text-stone text-xs font-body">{provider.description}</p>
                </div>
                {isConnected && (
                  <span className="text-xs font-body px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                    Connected
                  </span>
                )}
              </div>

              {isConnected && status.last_pulled_at && (
                <p className="text-stone text-xs font-body mb-3">
                  Last synced: {new Date(status.last_pulled_at).toLocaleDateString()}
                </p>
              )}

              <div className="flex gap-2">
                {!isConnected ? (
                  <button
                    onClick={() => handleConnect(provider)}
                    disabled={connecting === provider.id || loading}
                    className="bg-orange text-white px-4 py-1.5 rounded-lg text-sm font-heading font-semibold hover:bg-orange/90 transition disabled:opacity-50"
                  >
                    {connecting === provider.id ? 'Connecting...' : 'Connect'}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handlePull(provider)}
                      className="bg-orange/20 text-orange px-3 py-1.5 rounded-lg text-sm font-heading font-semibold hover:bg-orange/30 transition"
                    >
                      Refresh Data
                    </button>
                    <button
                      onClick={() => handleDisconnect(provider)}
                      className="bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-sm font-heading font-semibold hover:bg-red-500/30 transition"
                    >
                      Disconnect
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
