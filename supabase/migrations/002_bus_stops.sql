-- bus_stops: static stop coordinates for geofencing and map markers
create table if not exists public.bus_stops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  order_index integer not null default 0,
  created_at timestamptz default now()
);

alter table public.bus_stops enable row level security;

-- Anyone (including anon) can read bus stops
create policy "Public read bus_stops"
  on public.bus_stops for select
  using (true);

-- Seed one test stop via SQL Editor if needed:
-- insert into public.bus_stops (name, lat, lng, order_index) values ('Main Campus Stop', 12.9716, 77.5946, 0);
