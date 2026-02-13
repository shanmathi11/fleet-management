-- Extend bus_status with driver_id and PostGIS geography location for NexaTSync

alter table public.bus_status
  add column if not exists driver_id uuid,
  add column if not exists location geography(Point,4326);

-- Ensure one active row per driver
create unique index if not exists bus_status_driver_id_key
  on public.bus_status(driver_id);

comment on column public.bus_status.driver_id is 'Auth user id for the driver';
comment on column public.bus_status.location is 'Bus position as geography POINT (SRID=4326)';

