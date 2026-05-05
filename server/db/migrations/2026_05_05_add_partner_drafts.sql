-- 2026-05-05: Partner CFO Workbench draft layer.
--
-- One row per (partner_id, client_user_id). Holds the in-progress numbers Nick is
-- working on for a client. Nothing the client sees changes until Nick hits
-- Publish, which inserts a row into snapshots for the client's user_id.

create table if not exists partner_drafts (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references partners(id) on delete cascade,
  client_user_id uuid not null references users(id) on delete cascade,
  inputs jsonb not null default '{}'::jsonb,
  monthly_history jsonb,
  field_sources jsonb not null default '{}'::jsonb,
  outputs jsonb,
  interpretation jsonb,
  last_published_snapshot_id uuid references snapshots(id) on delete set null,
  last_published_at timestamptz,
  has_unpublished_changes boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (partner_id, client_user_id)
);

create index if not exists idx_partner_drafts_partner on partner_drafts(partner_id);
create index if not exists idx_partner_drafts_client on partner_drafts(client_user_id);

alter table partner_drafts enable row level security;

create policy "Partners can manage own drafts" on partner_drafts for all
  using (partner_id in (select id from partners where user_id = auth.uid()));

create policy "Service role full access to partner_drafts" on partner_drafts for all
  using (auth.role() = 'service_role');

-- Bump updated_at on every save.
create trigger partner_drafts_updated
  before update on partner_drafts
  for each row execute function update_updated_at();
