import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Bus, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { BusStatusRow, BusStopRow } from '../lib/supabase'
import { haversineKm } from '../utils/distance'
import { GEOFENCE_RADIUS_KM } from '../constants/stops'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

type LatLng = { lat: number; lng: number }

function computeBearing(from: LatLng, to: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const lat1 = toRad(from.lat)
  const lat2 = toRad(to.lat)
  const dLon = toRad(to.lng - from.lng)

  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  const brng = Math.atan2(y, x)
  const deg = (brng * 180) / Math.PI
  return (deg + 360) % 360
}

export default function StudentView() {
  const navigate = useNavigate()
  const { user, loading, signOut } = useAuth()

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const busMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const busIconRef = useRef<HTMLDivElement | null>(null)
  const stopMarkersRef = useRef<mapboxgl.Marker[]>([])

  const lastBusPosRef = useRef<LatLng | null>(null)
  const animFromRef = useRef<LatLng | null>(null)
  const animToRef = useRef<LatLng | null>(null)
  const animStartRef = useRef<number | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const headingRef = useRef<number>(0)

  const [bus, setBus] = useState<BusStatusRow | null>(null)
  const [busStops, setBusStops] = useState<BusStopRow[]>([])
  const [nearestStopName, setNearestStopName] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [busOnline, setBusOnline] = useState(false)

  const [studentPos, setStudentPos] = useState<LatLng | null>(null)
  const [studentError, setStudentError] = useState<string | null>(null)
  const [distanceKm, setDistanceKm] = useState<number | null>(null)

  useEffect(() => {
    if (loading) return
    const sessionRole = user?.user_metadata?.role
    if (!user || sessionRole !== 'student') {
      navigate('/', { replace: true })
      return
    }
  }, [loading, user, navigate])

  // Fetch bus_stops on load
  useEffect(() => {
    supabase
      .from('bus_stops')
      .select('*')
      .order('order_index', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setBusStops(data as BusStopRow[])
      })
  }, [])

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || !MAPBOX_TOKEN) return

    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: [77.5946, 12.9716],
      zoom: 13,
    })
    mapRef.current = map

    const busOuter = document.createElement('div')
    busOuter.className = 'bus-marker-outer'
    const busInner = document.createElement('div')
    busInner.className = 'bus-marker-inner'
    busInner.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="3" y="5" width="18" height="11" rx="2" ry="2" />
        <rect x="5" y="7" width="6" height="4" fill="rgba(15,23,42,0.9)" />
        <rect x="13" y="7" width="6" height="4" fill="rgba(15,23,42,0.9)" />
        <circle cx="8" cy="17" r="1.5" />
        <circle cx="16" cy="17" r="1.5" />
      </svg>
    `
    busOuter.appendChild(busInner)
    busIconRef.current = busInner

    const marker = new mapboxgl.Marker({ element: busOuter })
      .setLngLat([77.5946, 12.9716])
      .addTo(map)
    busMarkerRef.current = marker

    return () => {
      stopMarkersRef.current.forEach((m) => m.remove())
      stopMarkersRef.current = []
      map.remove()
      mapRef.current = null
      busMarkerRef.current = null
      busIconRef.current = null
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
    }
  }, [])

  // Plot bus_stops on map when map and stops are ready
  useEffect(() => {
    const map = mapRef.current
    if (!map || busStops.length === 0) return

    stopMarkersRef.current.forEach((m) => m.remove())
    stopMarkersRef.current = []

    busStops.forEach((stop) => {
      const el = document.createElement('div')
      el.className = 'stop-marker'
      const m = new mapboxgl.Marker({ element: el })
        .setLngLat([stop.lng, stop.lat])
        .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(`<strong>${stop.name}</strong>`))
        .addTo(map)
      stopMarkersRef.current.push(m)
    })
  }, [busStops])

  const startBusAnimation = (nextPos: LatLng, bearingFromRow?: number) => {
    const marker = busMarkerRef.current
    const map = mapRef.current
    if (!marker || !map) return

    const from = lastBusPosRef.current ?? nextPos
    const to = nextPos

    animFromRef.current = from
    animToRef.current = to
    animStartRef.current = performance.now()

    const newHeading =
      typeof bearingFromRow === 'number'
        ? bearingFromRow
        : from && (from.lat !== to.lat || from.lng !== to.lng)
          ? computeBearing(from, to)
          : headingRef.current
    headingRef.current = newHeading

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }

    const step = (t: number) => {
      const start = animStartRef.current ?? t
      const duration = 800
      const progress = Math.min((t - start) / duration, 1)

      const fromPos = animFromRef.current ?? to
      const toPos = animToRef.current ?? to

      const lat = fromPos.lat + (toPos.lat - fromPos.lat) * progress
      const lng = fromPos.lng + (toPos.lng - fromPos.lng) * progress

      marker.setLngLat([lng, lat])

      if (busIconRef.current) {
        busIconRef.current.style.transform = `rotate(${headingRef.current}deg)`
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step)
      } else {
        animFrameRef.current = null
      }
    }

    animFrameRef.current = requestAnimationFrame(step)
    lastBusPosRef.current = nextPos
  }

  const applyBusRow = (row: BusStatusRow) => {
    setBus(row)
    const active = !!row.is_active && row.lat != null && row.lng != null
    setBusOnline(active)
    if (!active) return

    const pos = { lat: row.lat, lng: row.lng }
    startBusAnimation(pos, row.bearing)
  }

  // Realtime subscription + initial fetch
  useEffect(() => {
    supabase
      .from('bus_status')
      .select('*')
      .maybeSingle()
      .then(({ data }) => {
        if (data) applyBusRow(data as BusStatusRow)
      })

    const channel = supabase
      .channel('public:bus_status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bus_status' },
        (payload) => {
          applyBusRow(payload.new as BusStatusRow)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsLive(true)
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setIsLive(false)
        }
      })

    return () => {
      supabase.removeChannel(channel)
      setIsLive(false)
    }
  }, [])

  // Compute nearest stop to live bus
  useEffect(() => {
    if (!busOnline || !bus || bus.lat == null || bus.lng == null || busStops.length === 0) {
      setNearestStopName(null)
      return
    }
    let closest: BusStopRow | null = null
    let minDist = Infinity
    for (const stop of busStops) {
      const d = haversineKm(bus.lat, bus.lng, stop.lat, stop.lng)
      if (d < minDist) {
        minDist = d
        closest = stop
      }
    }
    setNearestStopName(closest?.name ?? null)
  }, [busOnline, bus, busStops])

  // Track student geolocation
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setStudentError('Location is not supported on this device.')
      return
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setStudentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setStudentError(null)
      },
      (err) => {
        setStudentError(err.message)
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    )
    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  // Distance between bus and student
  useEffect(() => {
    if (!busOnline || !bus || bus.lat == null || bus.lng == null || !studentPos) {
      setDistanceKm(null)
      return
    }
    const d = haversineKm(bus.lat, bus.lng, studentPos.lat, studentPos.lng)
    setDistanceKm(d)
  }, [busOnline, bus, studentPos])

  const handleSignOut = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Loading…
      </div>
    )
  }

  const isApproaching =
    distanceKm != null && distanceKm <= GEOFENCE_RADIUS_KM && busOnline

  return (
    <div className="min-h-screen flex flex-col text-white">
      {/* Top navigation / pulse bar */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-400/40 shadow-sm">
            <Bus className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="leading-tight">
            <p className="text-xs text-slate-400">Student Transit Dashboard</p>
            <p className="text-sm font-semibold tracking-tight">NexaTSync</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border ${
              isLive
                ? 'border-red-500/60 bg-red-500/15 text-red-300 animate-pulse'
                : 'border-slate-500/50 bg-slate-900/80 text-slate-400'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isLive ? 'bg-red-400 shadow-[0_0_0_4px_rgba(248,113,113,0.45)]' : 'bg-slate-500'
              }`}
            />
            Live
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
            aria-label="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Active route info */}
      <section className="relative z-10 px-4 pt-3 pb-2">
        <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-slate-950/60 backdrop-blur-xl px-4 py-3 shadow-lg">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
            Active route
          </p>
          <p className="mt-1 text-sm md:text-base font-medium text-white">
            Main City Route:{' '}
            <span className="text-emerald-300">
              {busOnline
                ? nearestStopName ?? 'Calculating nearest stop…'
                : 'No active bus'}
            </span>
          </p>
        </div>
      </section>

      {/* Map + arrival intelligence */}
      <main className="relative flex-1">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Arrival intelligence panel */}
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border bg-slate-950/80 backdrop-blur-2xl px-4 py-3 shadow-2xl border-white/10">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Time to arrival
            </p>

            {(!bus || !busOnline) && (
              <p className="mt-2 text-sm text-slate-300">
                Bus currently off-duty. Check back soon.
              </p>
            )}

            {busOnline && distanceKm == null && (
              <p className="mt-2 text-sm text-slate-300">
                {studentError
                  ? `Enable location to see distance: ${studentError}`
                  : 'Getting your location to estimate distance…'}
              </p>
            )}

            {busOnline && distanceKm != null && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400">
                    Bus is currently
                  </p>
                  <p
                    className={`mt-0.5 text-lg font-semibold ${
                      isApproaching ? 'text-emerald-300' : 'text-white'
                    }`}
                  >
                    {distanceKm.toFixed(1)} km away
                  </p>
                  {nearestStopName && (
                    <p className="mt-1 text-xs text-slate-400">
                      Nearest stop: <span className="text-slate-200">{nearestStopName}</span>
                    </p>
                  )}
                </div>
                <div
                  className={`rounded-xl px-3 py-2 text-xs font-medium ${
                    isApproaching
                      ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/60'
                      : 'bg-slate-900/80 text-slate-300 border border-white/10'
                  }`}
                >
                  {isApproaching
                    ? 'Bus Approaching: Prepare to board!'
                    : 'Relax – we will notify as it gets closer.'}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
