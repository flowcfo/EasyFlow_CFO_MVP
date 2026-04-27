-- Easy Numbers Profit System V8 — Database Schema
-- Run in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. USERS
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  full_name text,
  business_name text,
  user_type text not null default 'owner' check (user_type in ('owner','partner','client')),
  managed_by_partner_id uuid,
  revenue_band text check (revenue_band in ('100k-200k','200k-500k','500k-850k','850k-2m','2m-3.5m','3.5m-5m')),
  industry text,
  tier text not null default 'free' check (tier in ('free','clarity','control','harvest','partner_starter','partner_growth','partner_scale')),
  stripe_customer_id text,
  response_mode text not null default 'comic' check (response_mode in ('comic','classic')),
  created_at timestamptz not null default now()
);

alter table users enable row level security;
create policy "Users can read own data" on users for select using (auth.uid() = id);
create policy "Users can update own data" on users for update using (auth.uid() = id);
create policy "Service role full access to users" on users for all using (auth.role() = 'service_role');

-- 2. PARTNERS
create table if not exists partners (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique not null references users(id) on delete cascade,
  brand_name text not null,
  logo_url text,
  primary_color text default '#F05001',
  plan text not null default 'starter' check (plan in ('starter','growth','scale')),
  client_seat_limit integer not null default 5,
  stripe_customer_id text,
  addon_cfo_chat boolean not null default false,
  addon_briefing_gen boolean not null default false,
  addon_meeting_prep boolean not null default false,
  addon_portfolio_ai boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_partners_user on partners(user_id);

alter table partners enable row level security;
create policy "Partners can read own record" on partners for select using (auth.uid() = user_id);
create policy "Partners can update own record" on partners for update using (auth.uid() = user_id);
create policy "Service role full access to partners" on partners for all using (auth.role() = 'service_role');

-- 3. PARTNER CLIENTS
create table if not exists partner_clients (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references partners(id) on delete cascade,
  client_user_id uuid not null references users(id) on delete cascade,
  client_name text,
  business_name text,
  status text not null default 'pending' check (status in ('active','inactive','pending')),
  added_at timestamptz not null default now()
);

create index idx_partner_clients_partner on partner_clients(partner_id);
create index idx_partner_clients_user on partner_clients(client_user_id);

alter table partner_clients enable row level security;
create policy "Partners can read own clients" on partner_clients for select
  using (partner_id in (select id from partners where user_id = auth.uid()));
create policy "Partners can manage own clients" on partner_clients for all
  using (partner_id in (select id from partners where user_id = auth.uid()));
create policy "Clients can read own record" on partner_clients for select
  using (client_user_id = auth.uid());
create policy "Service role full access to partner_clients" on partner_clients for all
  using (auth.role() = 'service_role');

-- 4. PARTNER NOTES
create table if not exists partner_notes (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references partners(id) on delete cascade,
  client_user_id uuid not null references users(id) on delete cascade,
  note text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_partner_notes_partner on partner_notes(partner_id);
create index idx_partner_notes_client on partner_notes(client_user_id);

alter table partner_notes enable row level security;
create policy "Partners can manage own notes" on partner_notes for all
  using (partner_id in (select id from partners where user_id = auth.uid()));
create policy "Clients can read pinned notes" on partner_notes for select
  using (client_user_id = auth.uid() and pinned = true);
create policy "Service role full access to partner_notes" on partner_notes for all
  using (auth.role() = 'service_role');

-- 5. SNAPSHOTS
create table if not exists snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  label text,
  period_type text check (period_type in ('annual','ttm','monthly')),
  inputs jsonb not null,
  outputs jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_snapshots_user on snapshots(user_id);
create index idx_snapshots_created on snapshots(created_at desc);

alter table snapshots enable row level security;
create policy "Users can read own snapshots" on snapshots for select using (auth.uid() = user_id);
create policy "Users can insert own snapshots" on snapshots for insert with check (auth.uid() = user_id);
create policy "Users can delete own snapshots" on snapshots for delete using (auth.uid() = user_id);
create policy "Partners can read client snapshots" on snapshots for select
  using (user_id in (
    select pc.client_user_id from partner_clients pc
    join partners p on pc.partner_id = p.id
    where p.user_id = auth.uid()
  ));
create policy "Service role full access to snapshots" on snapshots for all using (auth.role() = 'service_role');

-- 6. WEEKLY ENTRIES
create table if not exists weekly_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  week_ending date not null,
  revenue numeric not null default 0,
  cogs numeric not null default 0,
  direct_labor numeric not null default 0,
  marketing numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_weekly_user on weekly_entries(user_id);
create index idx_weekly_date on weekly_entries(week_ending desc);

alter table weekly_entries enable row level security;
create policy "Users can read own weekly entries" on weekly_entries for select using (auth.uid() = user_id);
create policy "Users can insert own weekly entries" on weekly_entries for insert with check (auth.uid() = user_id);
create policy "Users can update own weekly entries" on weekly_entries for update using (auth.uid() = user_id);
create policy "Users can delete own weekly entries" on weekly_entries for delete using (auth.uid() = user_id);
create policy "Service role full access to weekly_entries" on weekly_entries for all using (auth.role() = 'service_role');

-- 7. GAME PROGRESS
create table if not exists game_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique not null references users(id) on delete cascade,
  profit_score integer not null default 0 check (profit_score >= 0 and profit_score <= 100),
  profit_tier integer not null default 1 check (profit_tier >= 1 and profit_tier <= 5),
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_checkin_date date,
  fix_queue jsonb default '[]'::jsonb,
  completed_actions jsonb default '[]'::jsonb,
  score_history jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_game_user on game_progress(user_id);

alter table game_progress enable row level security;
create policy "Users can read own game progress" on game_progress for select using (auth.uid() = user_id);
create policy "Users can update own game progress" on game_progress for update using (auth.uid() = user_id);
create policy "Service role full access to game_progress" on game_progress for all using (auth.role() = 'service_role');

-- 8. AI CONVERSATIONS
create table if not exists ai_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  snapshot_id uuid references snapshots(id) on delete set null,
  messages text not null default '',  -- AES-256 encrypted JSON; decrypt server-side only
  created_at timestamptz not null default now()
);

create index idx_ai_conv_user on ai_conversations(user_id);

alter table ai_conversations enable row level security;
create policy "Users can read own conversations" on ai_conversations for select using (auth.uid() = user_id);
create policy "Users can insert own conversations" on ai_conversations for insert with check (auth.uid() = user_id);
create policy "Users can update own conversations" on ai_conversations for update using (auth.uid() = user_id);
create policy "Users can delete own conversations" on ai_conversations for delete using (auth.uid() = user_id);
create policy "Service role full access to ai_conversations" on ai_conversations for all using (auth.role() = 'service_role');

-- 9. WEEKLY BRIEFINGS
create table if not exists weekly_briefings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  week_ending date not null,
  briefing_text text not null,
  sent_at timestamptz,
  opened boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_briefings_user on weekly_briefings(user_id);

alter table weekly_briefings enable row level security;
create policy "Users can read own briefings" on weekly_briefings for select using (auth.uid() = user_id);
create policy "Service role full access to weekly_briefings" on weekly_briefings for all using (auth.role() = 'service_role');

-- 10. INTEGRATIONS
create table if not exists integrations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('qbo','xero','freshbooks','wave','sage','zoho')),
  realm_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  last_pulled_at timestamptz,
  pull_status text default 'pending' check (pull_status in ('success','failed','pending')),
  created_at timestamptz not null default now(),
  unique(user_id, provider)
);

create index idx_integrations_user on integrations(user_id);

alter table integrations enable row level security;
create policy "Users can read own integrations" on integrations for select using (auth.uid() = user_id);
create policy "Service role full access to integrations" on integrations for all using (auth.role() = 'service_role');

-- 11. BENCHMARKS
create table if not exists benchmarks (
  id uuid primary key default uuid_generate_v4(),
  industry text not null,
  revenue_band text not null,
  avg_gm_pct numeric,
  avg_direct_lpr numeric,
  avg_mpr numeric,
  avg_manpr numeric,
  avg_pretax_profit_pct numeric,
  sample_size integer default 0,
  updated_at timestamptz not null default now(),
  unique(industry, revenue_band)
);

alter table benchmarks enable row level security;
create policy "Authenticated users can read benchmarks" on benchmarks for select using (auth.role() = 'authenticated');
create policy "Service role full access to benchmarks" on benchmarks for all using (auth.role() = 'service_role');

-- 12. AI SESSIONS (tracking monthly session usage for Control tier limits)
create table if not exists ai_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  conversation_id uuid references ai_conversations(id) on delete cascade,
  month_year text not null,
  created_at timestamptz not null default now()
);

create index idx_ai_sessions_user_month on ai_sessions(user_id, month_year);

alter table ai_sessions enable row level security;
create policy "Users can read own sessions" on ai_sessions for select using (auth.uid() = user_id);
create policy "Service role full access to ai_sessions" on ai_sessions for all using (auth.role() = 'service_role');

-- Auto-update updated_at on game_progress
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger game_progress_updated
  before update on game_progress
  for each row execute function update_updated_at();

-- Foreign key: users.managed_by_partner_id -> partners.id
alter table users add constraint fk_users_managed_by_partner
  foreign key (managed_by_partner_id) references partners(id) on delete set null;

-- 13. OAUTH NONCES (CSRF protection for provider auth callbacks)
create table if not exists oauth_nonces (
  nonce text primary key,
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('qbo','xero','freshbooks','wave','sage','zoho')),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);

create index idx_oauth_nonces_expires on oauth_nonces(expires_at);

alter table oauth_nonces enable row level security;
create policy "Service role full access to oauth_nonces" on oauth_nonces for all using (auth.role() = 'service_role');

-- 14. PARTNER ACCESS TOKENS (single-use, server-verified tokens for partner→client access)
create table if not exists partner_access_tokens (
  token_hash text primary key,
  partner_id uuid not null references partners(id) on delete cascade,
  client_user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_partner_access_tokens_expires on partner_access_tokens(expires_at);

alter table partner_access_tokens enable row level security;
create policy "Service role full access to partner_access_tokens" on partner_access_tokens for all using (auth.role() = 'service_role');
