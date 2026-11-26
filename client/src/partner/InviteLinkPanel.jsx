import { useState } from 'react';

/**
 * Shows a client's set-password link with two ways to send it:
 * copy it, or open a ready-made email in Nick's own mail app (Outlook).
 * The portal does not email clients itself yet.
 */
export default function InviteLinkPanel({ link, email, clientName }) {
  const [copied, setCopied] = useState(false);
  const firstName = String(clientName || '').trim().split(/\s+/)[0] || 'there';

  const subject = 'Your EasyFlow CFO client portal';
  const body = [
    `Hi ${firstName},`,
    '',
    'Your EasyFlow CFO portal is ready. It shows your game plan, your cash and how each month compares with the plan.',
    '',
    'Click this link to set your password:',
    link,
    '',
    'The link works once and expires soon, so please use it today. If it has expired, reply and I will send a new one.',
    '',
    'Nick',
  ].join('\n');
  const mailto = `mailto:${encodeURIComponent(email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate" htmlFor="invite-link">Set-password link</label>
        <input
          id="invite-link"
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="w-full truncate rounded-[10px] border border-line bg-offwhite px-3 py-2.5 text-sm text-navy outline-none"
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <a href={mailto} className="btn-primary flex-1">Email it from Outlook</a>
        <button type="button" onClick={copy} className="btn-secondary flex-1">
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <p className="text-sm text-slate">
        The link works once and expires, so send it now. If it runs out, open the client's card and get a new one.
      </p>
    </div>
  );
}
