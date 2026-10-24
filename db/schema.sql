-- CloneX case history on Postgres (Supabase). Run once in the Supabase SQL editor.
--
-- Append-only: every analyst decision is a new row and nothing is ever updated or deleted, so the history of
-- "what changed, who changed it and when" cannot be rewritten. A case's current status is the status of its
-- latest event.

create table if not exists case_events (
  id           bigint generated always as identity primary key,
  brand        text        not null check (char_length(brand) between 1 and 80),
  finding_id   text        not null check (char_length(finding_id) between 1 and 200),
  at           timestamptz not null default now(),
  by_analyst   text        not null check (char_length(by_analyst) between 1 and 40),
  from_status  text        check (from_status in ('new', 'under-review', 'confirmed', 'false-positive', 'closed')),
  to_status    text        not null check (to_status in ('new', 'under-review', 'confirmed', 'false-positive', 'closed')),
  note         text        check (note is null or char_length(note) <= 300)
);

create index if not exists case_events_brand_idx   on case_events (brand, at, id);
create index if not exists case_events_finding_idx on case_events (brand, finding_id, at, id);

-- Only the server (service-role key) talks to this table. With row level security on and no policies,
-- the public anon key can read and write nothing.
alter table case_events enable row level security;

-- If "Automatically expose new tables" is off (recommended), the server role needs explicit access.
grant usage on schema public to service_role;
grant all on table public.case_events to service_role;
grant usage, select on all sequences in schema public to service_role;
