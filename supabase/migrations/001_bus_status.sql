-- bus_status: single row per bus (use id = 'default-bus' for one bus)
create table if not exists public.bus_status (
  id text primary key default 'default-bus',
  lat double precision not null,
  lng double precision not null,
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Realtime: enable in Supabase Dashboard → Database → Replication → add table bus_status

-- RLS: public read, only authenticated users with role 'driver' can write
alter table public.bus_status enable row level security;

create policy "Public read bus_status"
  on public.bus_status for select
  using (true);

-- Only users with app_metadata.role = 'driver' can insert/update/delete
create policy "Driver can upsert bus_status"
  on public.bus_status for all
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'driver'
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'driver'
  );

comment on table public.bus_status is 'Live bus position; Realtime enabled. RLS: read all, write driver only.';
