# NexaTSync

Real-time fleet management: Driver shares GPS every 3s; Student sees live bus on a Mapbox map with 2km geofence alerts.

## Stack

- React (Vite) + TypeScript
- Tailwind CSS, Lucide React
- Supabase (Auth + Realtime + `bus_status` table)
- Mapbox GL JS

## Setup

1. **Env**: Copy `.env.example` to `.env` at the **project root** and set:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `VITE_MAPBOX_TOKEN` (from [Mapbox](https://account.mapbox.com))

2. **Supabase**:
   - Run the SQL in `supabase/migrations/001_bus_status.sql` in the SQL Editor (create table + RLS).
   - In **Database → Replication**, enable Realtime for the `bus_status` table.
   - For driver write access: in **Authentication → Users**, set the driver user’s **App Metadata** to `{"role": "driver"}`. Use **User Metadata** `{"role": "student"}` or `{"role": "driver"}` for redirects; RLS uses **app_metadata.role**.

3. **Run**:
   - `npm install`
   - `npm run dev`

## Roles

- **Driver**: Start Trip → `watchPosition()` → throttle 3s → upsert `bus_status`.
- **Student**: Mapbox map + Realtime on `bus_status`; bus marker moves live. When bus is within 2km of the test stop, “Bus is 5 Minutes Away!” and “Request Wait” appear.

## Test stop

Edit `src/constants/stops.ts` to change the static stop (default: Main Campus Stop at 12.9716, 77.5946).

## Increasing sign-in / email rate limits

Rate limits are enforced by Supabase, not by this app. To allow more sign-in or sign-up attempts:

1. **Dashboard**  
   In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **Rate limits** (or **Configuration** → **Rate limits**).  
   There you can adjust:
   - **Email sent** – how many auth emails (sign-up, password reset) can be sent per hour.
   - **OTP** – magic links / OTPs per hour.
   - **Verify** – verification requests per hour.
   - **Token refresh** – token refresh requests per hour.

2. **Email limit (often the bottleneck)**  
   By default Supabase allows only a small number of auth emails per hour (e.g. 2) on their shared SMTP. To increase it:
   - Use **Custom SMTP**: **Project settings** → **Auth** → **SMTP** and configure your own provider (SendGrid, Resend, etc.). Then you’re not limited by Supabase’s shared quota.
   - Or raise the “Email sent” cap in **Authentication** → **Rate limits** if your plan allows it.

3. **Management API**  
   You can read/update auth config (including rate limits) via the [Management API](https://supabase.com/docs/guides/auth/rate-limits#customizable-rate-limits) with `PATCH .../projects/$PROJECT_REF/config/auth` and keys like `rate_limit_email_sent`, `rate_limit_verify`, etc.
