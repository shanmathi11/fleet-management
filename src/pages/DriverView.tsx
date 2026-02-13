import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bus, MapPin, LogOut, Navigation } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { DEFAULT_BUS_ID } from '../constants/bus'

const THROTTLE_MS = 3000

export default function DriverView() {
  const navigate = useNavigate()
  const { user, loading, signOut } = useAuth()
  const [tripActive, setTripActive] = useState(false)
  const [lastSent, setLastSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const firstSendDoneRef = useRef(false)

  useEffect(() => {
    if (loading) return
    const sessionRole = user?.user_metadata?.role
    if (!user || sessionRole !== 'driver') {
      navigate('/', { replace: true })
      return
    }
  }, [loading, user, navigate])

  const sendPosition = async (lat: number, lng: number) => {
    const { error: err } = await supabase
      .from('bus_status')
      .upsert(
        {
          id: DEFAULT_BUS_ID,
          lat,
          lng,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    setLastSent(new Date().toLocaleTimeString())
  }

  useEffect(() => {
    if (!tripActive) return

    const scheduleSend = () => {
      if (lastPosRef.current) {
        sendPosition(lastPosRef.current.lat, lastPosRef.current.lng)
      }
    }

    intervalRef.current = setInterval(scheduleSend, THROTTLE_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [tripActive])

  const startTrip = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported')
      return
    }
    setError(null)
    setTripActive(true)

    firstSendDoneRef.current = false
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        lastPosRef.current = { lat, lng }
        if (!firstSendDoneRef.current) {
          firstSendDoneRef.current = true
          sendPosition(lat, lng)
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )
    watchIdRef.current = id
  }

  const stopTrip = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    lastPosRef.current = null
    firstSendDoneRef.current = false
    setLastSent(null)
    setTripActive(false)

    await supabase
      .from('bus_status')
      .upsert(
        {
          id: DEFAULT_BUS_ID,
          lat: 0,
          lng: 0,
          is_active: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Bus className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Driver Portal</h1>
            <p className="text-xs text-slate-400">NexaTSync</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="p-2 rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition"
          aria-label="Sign out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 p-4 md:p-6 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        <div className="w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <div className="flex flex-col items-center gap-6">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center transition ${
                tripActive ? 'bg-emerald-500/30 border-2 border-emerald-400' : 'bg-white/10 border border-white/20'
              }`}
            >
              <Navigation className={`w-10 h-10 ${tripActive ? 'text-emerald-400' : 'text-slate-500'}`} />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white">
                {tripActive ? 'Trip in progress' : 'Start your trip'}
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                {tripActive
                  ? 'Location is shared every 3 seconds.'
                  : 'Toggle on to share your live position with students.'}
              </p>
            </div>

            {tripActive && lastSent && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <MapPin className="w-4 h-4 text-emerald-400" />
                Last sent: {lastSent}
              </div>
            )}

            {error && (
              <p className="text-red-400 text-sm text-center" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={tripActive ? stopTrip : startTrip}
              className={`w-full py-4 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
                tripActive
                  ? 'bg-red-500/20 text-red-400 border border-red-400/50 hover:bg-red-500/30'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500'
              }`}
            >
              {tripActive ? 'Stop Trip' : 'Start Trip'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
