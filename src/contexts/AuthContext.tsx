import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

type Role = 'driver' | 'student'

type AuthState = {
  user: User | null
  role: Role | null
  loading: boolean
  signIn: (email: string, password: string, role: Role) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, role: Role) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      const r = session?.user?.user_metadata?.role as Role | undefined
      setRole(r === 'driver' || r === 'student' ? r : null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      const r = session?.user?.user_metadata?.role as Role | undefined
      setRole(r === 'driver' || r === 'student' ? r : null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string, _role: Role) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error }
    // Role is set in app_metadata by signUp or in Dashboard
    return { error: null }
  }

  const signUp = async (email: string, password: string, role: Role) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role }, // user_metadata.role for redirect; set app_metadata in Dashboard for RLS
      },
    })
    if (error) return { error }
    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setRole(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, role, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
