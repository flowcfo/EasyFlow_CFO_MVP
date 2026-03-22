import { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../utils/api.js';

export default function InviteModal({ onClose, onInvited }) {
  const [form, setForm] = useState({ client_name: '', business_name: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.client_name || !form.email) {
      setError('Name and email are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/partner/clients/invite', form);
      onInvited();
    } catch (err) {
      setError(err.message || 'Failed to send invite.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-offwhite rounded-xl p-6 w-full max-w-md"
      >
        <h2 className="text-xl font-heading font-bold text-navy mb-4">Add Client</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-body text-stone mb-1">Client Name</label>
            <input
              type="text"
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              className="w-full bg-white border border-stone/30 rounded-lg px-3 py-2 text-navy font-body focus:border-orange focus:ring-1 focus:ring-orange outline-none"
              placeholder="Jane Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-body text-stone mb-1">Business Name</label>
            <input
              type="text"
              value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              className="w-full bg-white border border-stone/30 rounded-lg px-3 py-2 text-navy font-body focus:border-orange focus:ring-1 focus:ring-orange outline-none"
              placeholder="Smith Plumbing LLC"
            />
          </div>

          <div>
            <label className="block text-sm font-body text-stone mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-white border border-stone/30 rounded-lg px-3 py-2 text-navy font-body focus:border-orange focus:ring-1 focus:ring-orange outline-none"
              placeholder="jane@smithplumbing.com"
            />
          </div>

          {error && <p className="text-red-500 text-sm font-body">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-stone/20 text-stone px-4 py-2 rounded-lg font-heading font-semibold hover:bg-stone/30 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-orange text-white px-4 py-2 rounded-lg font-heading font-semibold hover:bg-orange/90 transition disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
