import { useState } from 'react';
import { api } from '../utils/api.js';
import InviteResult from './InviteResult.jsx';

const inputClass =
  'w-full rounded-[10px] border border-line bg-white px-3 py-2.5 text-navy outline-none transition focus:border-cobalt focus:ring-2 focus:ring-cobalt/15';

export default function InviteModal({ onClose, onInvited }) {
  const [form, setForm] = useState({ client_name: '', business_name: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.client_name || !form.email) {
      setError('Name and email are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.post('/partner/clients/invite', form);
      setResult({ ...data, email: data.email || form.email.trim(), client_name: form.client_name.trim() });
      onInvited?.();
    } catch (err) {
      setError(err.message || 'Could not add this client.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-[18px] bg-white p-6 text-navy shadow-card sm:p-8">
        {result ? (
          <>
            <p className="eyebrow text-ember">Client added</p>
            <h2 className="mb-4 mt-1 font-heading text-xl font-bold">{result.client_name} is in your client list</h2>
            <InviteResult result={result} clientRecordId={result.client_record?.id} />
            <button type="button" onClick={onClose} className="btn-ghost mt-6 w-full text-center">Done</button>
          </>
        ) : (
          <>
            <h2 className="mb-1 font-heading text-xl font-bold">Add a client</h2>
            <p className="mb-5 text-slate">We'll email them a link to set their password.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate" htmlFor="inv-name">Client name</label>
                <input id="inv-name" type="text" value={form.client_name} placeholder="Jane Smith" className={inputClass}
                  onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate" htmlFor="inv-biz">Business name</label>
                <input id="inv-biz" type="text" value={form.business_name} placeholder="Smith Plumbing" className={inputClass}
                  onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate" htmlFor="inv-email">Email</label>
                <input id="inv-email" type="email" value={form.email} placeholder="jane@smithplumbing.com" className={inputClass}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              {error && <p className="rounded-[10px] bg-cream px-3 py-2 text-sm text-ember">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Sending...' : 'Add and send invite'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
