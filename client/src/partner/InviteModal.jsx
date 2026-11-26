import { useState } from 'react';
import { api } from '../utils/api.js';
import InviteLinkPanel from './InviteLinkPanel.jsx';

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
      setResult({ link: data.invite_link, email: form.email.trim(), name: form.client_name.trim() });
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
            <h2 className="mb-2 mt-1 font-heading text-xl font-bold">Send {result.name.split(' ')[0]} their invite</h2>
            <p className="mb-5 text-slate">
              {result.name} is in your client list. Send this link so they can set a password and sign in.
            </p>
            {result.link ? (
              <InviteLinkPanel link={result.link} email={result.email} clientName={result.name} />
            ) : (
              <p className="rounded-[10px] bg-cream px-3 py-2 text-ember">
                The client was added, but no link came back. Open their card to get a new link.
              </p>
            )}
            <button type="button" onClick={onClose} className="btn-ghost mt-6 w-full text-center">Done</button>
          </>
        ) : (
          <>
            <h2 className="mb-1 font-heading text-xl font-bold">Add a client</h2>
            <p className="mb-5 text-slate">You'll get a link to email them from Outlook.</p>
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
                  {loading ? 'Adding...' : 'Add client'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
