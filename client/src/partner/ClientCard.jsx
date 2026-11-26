import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';
import InviteLinkPanel from './InviteLinkPanel.jsx';

export default function ClientCard({ client }) {
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [inviteError, setInviteError] = useState('');
  const [loadingLink, setLoadingLink] = useState(false);

  const lastActivity = client.last_activity
    ? new Date(client.last_activity).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'None yet';
  const pending = client.status === 'pending';

  async function getLink(e) {
    e.stopPropagation();
    setLoadingLink(true);
    setInviteError('');
    try {
      const data = await api.post(`/partner/clients/${client.id}/invite-link`, {});
      setInvite(data);
    } catch (err) {
      setInviteError(err.message || 'Could not make a new link.');
    } finally {
      setLoadingLink(false);
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/partner/client/${client.client_user_id}/game-plan`)}
        onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/partner/client/${client.client_user_id}/game-plan`); }}
        className="cursor-pointer rounded-2xl bg-white p-5 shadow-card ring-1 ring-transparent transition hover:ring-cobalt"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-heading text-lg font-bold text-navy">
              {client.business_name || client.client_name}
            </h3>
            {client.business_name && client.client_name && (
              <p className="truncate text-[15px] text-slate">{client.client_name}</p>
            )}
          </div>
          {pending && (
            <span className="flex-none rounded-full bg-cream px-3 py-1 text-sm font-bold text-ember ring-1 ring-inset ring-[#F6D9BF]">
              Invite pending
            </span>
          )}
        </div>
        <div className="mt-4 flex items-end justify-between gap-3 text-sm text-slate">
          <span>Last update: <b className="text-navy">{lastActivity}</b></span>
          {pending && (
            <button type="button" onClick={getLink} disabled={loadingLink}
              className="font-semibold text-cobalt hover:underline disabled:opacity-50">
              {loadingLink ? 'Getting link...' : 'Get invite link'}
            </button>
          )}
        </div>
        {inviteError && <p className="mt-2 text-sm text-ember">{inviteError}</p>}
      </div>

      {invite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4" role="dialog" aria-modal="true"
             onClick={() => setInvite(null)}>
          <div className="w-full max-w-md rounded-[18px] bg-white p-6 text-navy shadow-card sm:p-8" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow text-ember">New invite link</p>
            <h2 className="mb-5 mt-1 font-heading text-xl font-bold">Send {String(invite.client_name || 'your client').split(' ')[0]} a fresh link</h2>
            <InviteLinkPanel link={invite.invite_link} email={invite.email} clientName={invite.client_name} />
            <button type="button" onClick={() => setInvite(null)} className="btn-ghost mt-6 w-full text-center">Done</button>
          </div>
        </div>
      )}
    </>
  );
}
