import { useState } from 'react';
import { api } from '../utils/api.js';
import InviteLinkPanel from './InviteLinkPanel.jsx';

/**
 * What Nick sees after inviting (or re-inviting) a client.
 * - Email went out: say so, with a backup "Get a link instead".
 * - Email didn't go out: show the link to send from Outlook.
 * `clientRecordId` lets the backup ask the server for a fresh link.
 */
export default function InviteResult({ result, clientRecordId }) {
  const [linkResult, setLinkResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const firstName = String(result.client_name || '').trim().split(/\s+/)[0] || 'your client';

  async function getLink() {
    setLoading(true);
    setError('');
    try {
      const data = await api.post(`/partner/clients/${clientRecordId}/invite-link`, { mode: 'link' });
      setLinkResult(data);
    } catch (err) {
      setError(err.message || 'Could not make a link.');
    } finally {
      setLoading(false);
    }
  }

  const link = linkResult?.invite_link || (!result.email_sent ? result.invite_link : null);

  return (
    <div className="space-y-4">
      {result.email_sent && !linkResult ? (
        <div className="rounded-[10px] bg-pale px-4 py-3 text-ink">
          <p className="font-bold">Invite emailed to {result.email}.</p>
          <p className="mt-1 text-sm">
            {firstName} gets an email from EasyFlow CFO with a link to set a password. Ask them to check spam if it doesn't show up in a few minutes.
          </p>
        </div>
      ) : !result.email_sent && !linkResult ? (
        <div className="rounded-[10px] bg-cream px-4 py-3 text-ember ring-1 ring-inset ring-[#F6D9BF]">
          <p className="font-bold">The email couldn't be sent, so here's the link to send yourself.</p>
          {result.email_error && <p className="mt-1 text-sm">Reason: {result.email_error}</p>}
        </div>
      ) : null}

      {link && <InviteLinkPanel link={link} email={result.email} clientName={result.client_name} />}

      {result.email_sent && !linkResult && clientRecordId && (
        <button type="button" onClick={getLink} disabled={loading}
          className="text-sm font-semibold text-cobalt hover:underline disabled:opacity-50">
          {loading ? 'Getting link...' : 'Get a link to send myself instead'}
        </button>
      )}
      {linkResult && (
        <p className="text-sm text-slate">This new link replaces the one in the email, so send this one.</p>
      )}
      {error && <p className="text-sm text-ember">{error}</p>}
    </div>
  );
}
