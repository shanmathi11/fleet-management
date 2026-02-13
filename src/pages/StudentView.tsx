import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Bus, LogOut, MapPin, Bell } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { BusStatusRow, BusStopRow } from '../lib/supabase'
import { haversineKm } from '../utils/distance'
import { GEOFENCE_RADIUS_KM } from '../constants/stops'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

export default function StudentView() {
  const navigate = useNavigate()
  const { user, loading, signOut } = useAuth()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const stopMarkersRef = useRef<mapboxgl.Marker[]>([])
  const [bus, setBus] = useState<BusStatusRow | null>(null)
  const [busStops, setBusStops] = useState<BusStopRow[]>([])
  const [nearStop, setNearStop] = useState(false)
  const [nearStopName, setNearStopName] = useState<string | null>(null)
  const [requestWait, setRequestWait] = useState(false)

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

  // Map init
  useEffect(() => {
    if (!mapContainerRef.current || !MAPBOX_TOKEN) return

    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [77.5946, 12.9716],
      zoom: 12,
    })
    mapRef.current = map

    const el = document.createElement('div')
    el.className = 'bus-marker'
    el.innerHTML = '<span style="font-size:24px">🚌</span>'
    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([77.5946, 12.9716])
      .addTo(map)
    markerRef.current = marker

    return () => {
      stopMarkersRef.current.forEach((m) => m.remove())
      stopMarkersRef.current = []
      map.remove()
      mapRef.current = null
      markerRef.current = null
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
      el.innerHTML = '<span style="font-size:16px">📍</span>'
      const m = new mapboxgl.Marker({ element: el })
        .setLngLat([stop.lng, stop.lat])
        .setPopup(new mapboxgl.Popup({ offset: 20 }).setHTML(`<strong>${stop.name}</strong>`))
        .addTo(map)
      stopMarkersRef.current.push(m)
    })
  }, [busStops])

  const applyBusPosition = (row: BusStatusRow) => {
    setBus(row)
    if (row.lat != null && row.lng != null && markerRef.current) {
      markerRef.current.setLngLat([row.lng, row.lat])
    }
  }

  // Constantly check distance between live bus and each bus_stop using Haversine
  useEffect(() => {
    if (!bus?.is_active || bus.lat == null || bus.lng == null || busStops.length === 0) {
      setNearStop(false)
      setNearStopName(null)
      return
    }
    for (const stop of busStops) {
      const distanceKm = haversineKm(bus.lat, bus.lng, stop.lat, stop.lng)
      if (distanceKm <= GEOFENCE_RADIUS_KM) {
        setNearStop(true)
        setNearStopName(stop.name)
        return
      }
    }
    setNearStop(false)
    setNearStopName(null)
  }, [bus, busStops])

  // Initial fetch + Realtime subscription
  useEffect(() => {
    supabase
      .from('bus_status')
      .select('*')
      .maybeSingle()
      .then(({ data }) => {
        if (data) applyBusPosition(data as BusStatusRow)
      })

    const channel = supabase
      .channel('bus_status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bus_status' },
        (payload) => {
          applyBusPosition(payload.new as BusStatusRow)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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
      <header className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40 backdrop-blur-xl z-10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Bus className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Student Portal</h1>
            <p className="text-xs text-slate-400">
              {bus?.is_active ? 'Live' : 'NexaTSync'}
            </p>
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

      {/* Map full width/height */}
      <div ref={mapContainerRef} className="flex-1 w-full min-h-[50vh]" />

      {/* Geofence notification */}
      {nearStop && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm rounded-2xl border border-emerald-400/50 bg-slate-900/95 backdrop-blur-xl p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/30 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white">Bus is 5 Minutes Away!</p>
              <p className="text-sm text-slate-400 mt-0.5">
                The bus is within 2 km of {nearStopName ?? 'this stop'}.
              </p>
              <button
                type="button"
                onClick={() => setRequestWait(true)}
                className="mt-3 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                {requestWait ? 'Request sent' : 'Request Wait'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
