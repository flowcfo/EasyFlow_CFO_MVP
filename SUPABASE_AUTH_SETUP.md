# Supabase Auth Setup for EasyFlow CFO

This is the operator runbook for the closed client portal at `easyflowcfoapp.netlify.app`.
Self-signup is disabled. New clients are created by you (Nick) inside Supabase, sent an
invite email, and land on `/set-password` to choose their password.

This document covers:

1. Environment variables the browser app needs.
2. Supabase Auth → URL Configuration.
3. Email template copy for **Invite** and **Reset Password**.
4. JWT expiry recommendation.
5. Custom SMTP recommendation (Resend).
6. Step-by-step "How to onboard a new client".

---

## 1. Environment variables

The browser uses Supabase JS for password reset, set-password, and the welcome-card
dismissal write to `users.has_completed_onboarding`. Add these to Netlify (Site
Settings → Environment Variables):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

The anon key is safe to ship to the browser. The **service role** key must never
be exposed there. It only belongs on Railway.

After setting these, redeploy Netlify so the build picks them up.

---

## 2. URL Configuration

In **Supabase Dashboard → Authentication → URL Configuration**:

| Setting | Value |
|---|---|
| Site URL | `https://easyflowcfoapp.netlify.app` |
| Additional redirect URLs | `https://easyflowcfoapp.netlify.app/set-password`<br>`https://easyflowcfoapp.netlify.app/reset-password`<br>`http://localhost:5173/set-password` (dev)<br>`http://localhost:5173/reset-password` (dev) |

Both auth flow links sent in email use these redirect targets:

- **Invite** email button → `/set-password`
- **Reset password** email button → `/reset-password`

If you ever rename the production domain, add the new redirect URL here first.

---

## 3. Email template copy

Edit at **Supabase Dashboard → Authentication → Email Templates**.

Tone matches the EasyFlow CFO brand rules: direct, plainspoken, no em dashes.
The signature is "Nick, The Fractional CFO".

### 3a. Invite user

**Subject**

```
Welcome to EasyFlow CFO. Set your password.
```

**Body (HTML)**

```html
<p>Hi {{ .Email }},</p>

<p>Your CFO has set up your client portal at EasyFlow CFO. Click the button below to set your password and access your dashboard.</p>

<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;background:#0E1B2E;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;font-family:Sora,Arial,sans-serif;">
    Set your password
  </a>
</p>

<p>This link is valid for 24 hours. If it expires, reply to this email and I'll send a new one.</p>

<p>Once you're in, your dashboard will show your numbers as soon as I've loaded the latest period.</p>

<p>Talk soon.<br/>
Nick, The Fractional CFO<br/>
EasyFlow CFO. Your Numbers Made Easy.</p>
```

### 3b. Reset password

**Subject**

```
Reset your EasyFlow CFO password.
```

**Body (HTML)**

```html
<p>Hi {{ .Email }},</p>

<p>We got a request to reset your EasyFlow CFO password. Click below to choose a new one.</p>

<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;background:#0E1B2E;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;font-family:Sora,Arial,sans-serif;">
    Reset password
  </a>
</p>

<p>This link is valid for 1 hour. If you didn't request this, ignore this email and your password stays the same.</p>

<p>Nick, The Fractional CFO<br/>
EasyFlow CFO. Your Numbers Made Easy.</p>
```

> The `{{ .ConfirmationURL }}` token is rendered by Supabase. It already carries
> the access token in the URL fragment. Do not modify it or the auth screens will
> show "invalid or expired link".

---

## 4. JWT expiry recommendation

In **Supabase Dashboard → Authentication → Sessions**:

| Setting | Recommended | Why |
|---|---|---|
| JWT expiry | `604800` (7 days) | Owner-operators don't want to log in weekly. 7 days hits the right balance for a closed portal. |
| Refresh token rotation | Enabled | Default. Keep it. |
| Refresh token reuse interval | `10` seconds | Default. Keep it. |

The browser stores the JWT in `localStorage`. Until we move to HttpOnly cookies
(see deferred work in the security plan), 7 days is the longest you should go.

---

## 5. Custom SMTP (Resend)

Supabase's default email sender is rate-limited and looks generic. Switch to
Resend before you onboard real clients so invites land reliably and look on-brand.

**Steps**

1. Sign up at [resend.com](https://resend.com) and verify the `easyflowcfo.com` domain
   (DNS records: SPF, DKIM, DMARC).
2. Create an API key.
3. In **Supabase Dashboard → Authentication → SMTP Settings**, toggle **Enable
   Custom SMTP** and enter:

   | Field | Value |
   |---|---|
   | Sender email | `nick@easyflowcfo.com` |
   | Sender name | `Nick at EasyFlow CFO` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | (your Resend API key) |

4. Send a test email from the Supabase dashboard.

If DNS isn't verified yet, your invite emails will go to spam. Don't onboard
clients until this is green.

---

## 6. How to onboard a new client

Do this once per new client.

### 6a. Create the auth user

**Supabase Dashboard → Authentication → Users → Add user → Send invitation**

| Field | Value |
|---|---|
| Email | `client@example.com` |
| User Metadata (JSON) | `{"first_name": "Sarah", "full_name": "Sarah Reynolds"}` |

Hitting **Send invitation** triggers the Invite email. The link in that email
points to `/set-password` and creates the auth.users row.

> The `first_name` in user metadata is what `/set-password` reads to build the
> "Welcome to EasyFlow CFO, Sarah." heading. If you skip it, the heading
> falls back to "Welcome to EasyFlow CFO."

### 6b. Create the matching `users` row

The `users` table is separate from `auth.users` and powers tier, brand, and
RLS for everything in the app. Run this in **SQL Editor** with the new auth
user's UUID.

```sql
insert into users (id, email, full_name, business_name, user_type, tier, has_completed_onboarding, managed_by_partner_id)
values (
  '<paste-auth-user-uuid>',
  'client@example.com',
  'Sarah Reynolds',
  'Reynolds Landscaping',
  'client',
  'harvest',
  false,
  '<your-partner-id-from-partners-table>'
);

insert into game_progress (user_id, profit_score, profit_tier, current_streak, longest_streak)
values ('<paste-auth-user-uuid>', 0, 1, 0, 0);
```

> `has_completed_onboarding = false` makes the first-login WelcomeCard fire.
> `tier = 'harvest'` gives the client all dashboard screens. They cannot self-upgrade.
> `managed_by_partner_id` links them to your `partners` row so the partner-client
> RLS policies work.

### 6c. (Optional) Link them to your partner book

If you want the client to appear in your `/partner/dashboard` book:

```sql
insert into partner_clients (partner_id, client_user_id, client_name, business_name, status)
values (
  '<your-partner-id>',
  '<client-auth-user-uuid>',
  'Sarah Reynolds',
  'Reynolds Landscaping',
  'active'
);
```

### 6d. What the client sees

1. They get the Invite email.
2. They click "Set your password" and land on `/set-password`.
3. They choose a password and land on `/app/dashboard`.
4. The WelcomeCard greets them with "Welcome, Sarah."
5. They click "Take me to my dashboard" — the flag flips to true.
6. If you haven't loaded their numbers yet, they see:
   "Your CFO is preparing your numbers. You'll see your dashboard here within 1 business day."

### 6e. If they need a password reset later

Send them to `https://easyflowcfoapp.netlify.app/forgot-password` and they
self-serve. Or in the Supabase dashboard, **Users → … → Send password recovery**.

---

## Follow-ups (open)

- Calendly URL placeholders: `WelcomeCard.jsx` uses
  `https://calendly.com/easyflowcfo/monthly-review` and `Login.jsx` uses
  `/intro`. Replace with the real links when they exist.
- The `Signup.jsx` file still exists but is no longer routed. Leave it for now;
  delete after a release if no one notices.
- localStorage → HttpOnly cookies for JWT storage is still deferred (tracked in
  the security plan).
