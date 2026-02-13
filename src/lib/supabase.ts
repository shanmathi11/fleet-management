import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in .env')
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')

export type BusStatusRow = {
  id: string
  lat: number
  lng: number
  is_active: boolean
  updated_at: string
}

export type BusStopRow = {
  id: string
  name: string
  lat: number
  lng: number
  order_index: number
  created_at?: string
}

export type Database = {
  public: {
    Tables: {
      bus_status: {
        Row: BusStatusRow
        Insert: Omit<BusStatusRow, 'updated_at'> & { updated_at?: string }
        Update: Partial<Omit<BusStatusRow, 'id'>>
      }
      bus_stops: {
        Row: BusStopRow
        Insert: Omit<BusStopRow, 'created_at'> & { created_at?: string }
        Update: Partial<Omit<BusStopRow, 'id'>>
      }
    }
  }
}
