import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bus, LogOut, Navigation } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { haversineKm } from '../utils/distance'

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

const MIN_DISTANCE_METERS = 10
const MAX_INTERVAL_MS = 5000

export default function DriverView() {
  const navigate = useNavigate()
  const { user, loading, signOut } = useAuth()

  const [tripActive, setTripActive] = useState(false)
  const [lastSyncOk, setLastSyncOk] = useState<boolean | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [currentPos, setCurrentPos] = useState<LatLng | null>(null)
  const [speedKmh, setSpeedKmh] = useState<number | null>(null)
  const [gpsWarning, setGpsWarning] = useState<string | null>(null)

  const watchIdRef = useRef<number | null>(null)
  const lastSentPosRef = useRef<LatLng | null>(null)
  const lastSentAtRef = useRef<number | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (loading) return
    const sessionRole = user?.user_metadata?.role ?? user?.app_metadata?.role
    if (!user || sessionRole !== 'driver') {
      navigate('/', { replace: true })
      return
    }
  }, [loading, user, navigate])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && tripActive) {
        requestWakeLock()
      } else {
        releaseWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      releaseWakeLock()
    }
  }, [tripActive])

  const requestWakeLock = async () => {
    try {
      const anyNavigator = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> }
      }
      if (anyNavigator.wakeLock && !wakeLockRef.current) {
        wakeLockRef.current = await anyNavigator.wakeLock.request('screen')
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null
        })
      }
    } catch {
      // Ignore if not available
    }
  }

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release()
        wakeLockRef.current = null
      }
    } catch {
      wakeLockRef.current = null
    }
  }

  const shouldSendUpdate = (pos: LatLng): boolean => {
    const now = performance.now()
    const lastSentAt = lastSentAtRef.current
    const lastPos = lastSentPosRef.current

    const timeOk =
      lastSentAt == null || now - lastSentAt >= MAX_INTERVAL_MS

    let distanceOk = false
    if (lastPos) {
      const dKm = haversineKm(lastPos.lat, lastPos.lng, pos.lat, pos.lng)
      distanceOk = dKm * 1000 >= MIN_DISTANCE_METERS
    } else {
      distanceOk = true
    }

    return timeOk || distanceOk
  }

  const upsertBusStatus = async (pos: LatLng) => {
    if (!user) return
    const bearing =
      lastSentPosRef.current && (lastSentPosRef.current.lat !== pos.lat || lastSentPosRef.current.lng !== pos.lng)
        ? computeBearing(lastSentPosRef.current, pos)
        : undefined

    const location = `SRID=4326;POINT(${pos.lng} ${pos.lat})`

    const { error } = await supabase.from('bus_status').upsert(
      {
        driver_id: user.id,
        lat: pos.lat,
        lng: pos.lng,
        is_active: true,
        updated_at: new Date().toISOString(),
        location,
        bearing,
      },
      { onConflict: 'driver_id' }
    )

    if (error) {
      setLastSyncOk(false)
      setSyncError(error.message)
    } else {
      setLastSyncOk(true)
      setSyncError(null)
      lastSentAtRef.current = performance.now()
      lastSentPosRef.current = pos
    }
  }

  const handleStart = () => {
    if (!navigator.geolocation) {
      setSyncError('Geolocation is not supported')
      return
    }
    if (!user) {
      setSyncError('You must be logged in as a driver')
      return
    }

    setTripActive(true)
    setGpsWarning(null)
    requestWakeLock()

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const speed = pos.coords.speed // m/s or null

        const position = { lat, lng }
        setCurrentPos(position)

        if (speed != null && !Number.isNaN(speed)) {
          setSpeedKmh(speed * 3.6)
        } else if (lastSentPosRef.current && lastSentAtRef.current != null) {
          const now = performance.now()
          const dtSeconds = (now - lastSentAtRef.current) / 1000
          if (dtSeconds > 0) {
            const dKm = haversineKm(
              lastSentPosRef.current.lat,
              lastSentPosRef.current.lng,
              lat,
              lng
            )
            setSpeedKmh((dKm / dtSeconds) * 3600)
          }
        }

        setGpsWarning(null)

        if (shouldSendUpdate(position)) {
          void upsertBusStatus(position)
        }
      },
      (err) => {
        setGpsWarning('GPS Signal Lost - Moving to Last Known Position.')
        setSyncError(err.message)
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    )
    watchIdRef.current = id
  }

  const handleStop = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    await releaseWakeLock()
    setTripActive(false)

    lastSentAtRef.current = null
    lastSentPosRef.current = null

    if (user) {
      await supabase.from('bus_status').delete().eq('driver_id', user.id)
    }
  }

  const handleSignOut = async () => {
    await handleStop()
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

  return (
    <div className="min-h-screen flex flex-col text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-400/40 shadow-sm">
            <Bus className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="leading-tight">
            <p className="text-xs text-slate-400">Driver GPS Transmitter</p>
            <p className="text-sm font-semibold tracking-tight">NexaTSync</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {/* Mission control + telemetry */}
      <main className="flex-1 px-4 py-5 flex flex-col items-center">
        <div className="w-full max-w-md space-y-4">
          {/* Mission control button */}
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                    tripActive
                      ? 'border-emerald-400/70 bg-emerald-500/20'
                      : 'border-slate-600/80 bg-slate-800/60'
                  }`}
                >
                  <Navigation
                    className={`h-5 w-5 ${
                      tripActive ? 'text-emerald-300' : 'text-slate-400'
                    }`}
                  />
                </div>
                <div className="leading-tight">
                  <p className="text-xs text-slate-400">Trip status</p>
                  <p className="text-sm font-semibold">
                    {tripActive ? 'Broadcasting live GPS' : 'Trip idle'}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium border ${
                  tripActive
                    ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                    : 'border-slate-600/80 bg-slate-900 text-slate-400'
                }`}
              >
                {tripActive ? 'ON AIR' : 'STANDBY'}
              </span>
            </div>
            <button
              type="button"
              onClick={tripActive ? handleStop : handleStart}
              className={`mt-2 w-full py-3.5 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
                tripActive
                  ? 'bg-red-500/80 hover:bg-red-500 text-white shadow-lg shadow-red-500/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
              }`}
            >
              {tripActive ? 'End Trip' : 'Start Trip'}
            </button>
          </div>

          {/* Live telemetry */}
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-xl p-5 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-3">
              Live telemetry
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-500 mb-1">Latitude</p>
                <p className="font-mono text-sm text-slate-100">
                  {currentPos ? currentPos.lat.toFixed(6) : '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Longitude</p>
                <p className="font-mono text-sm text-slate-100">
                  {currentPos ? currentPos.lng.toFixed(6) : '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Speed</p>
                <p className="font-mono text-sm text-slate-100">
                  {speedKmh != null ? `${speedKmh.toFixed(1)} km/h` : '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Sync status</p>
                <div className="flex items-center gap-1.5 text-sm">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      lastSyncOk == null
                        ? 'bg-slate-500'
                        : lastSyncOk
                          ? 'bg-emerald-400'
                          : 'bg-red-400'
                    }`}
                  />
                  <span className="text-slate-100">
                    {lastSyncOk == null
                      ? 'Idle'
                      : lastSyncOk
                        ? 'Last update synced'
                        : 'Sync error'}
                  </span>
                </div>
              </div>
            </div>

            {gpsWarning && (
              <p className="mt-3 text-xs text-amber-300">
                {gpsWarning}
              </p>
            )}
            {syncError && (
              <p className="mt-2 text-xs text-red-400">{syncError}</p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
