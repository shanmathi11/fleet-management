import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bus, GraduationCap, LogIn, UserPlus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getAuthErrorMessage } from '../utils/authErrors'

export default function Landing() {
  const navigate = useNavigate()
  const { user, role, loading, signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState<'driver' | 'student'>('student')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Redirect if already logged in by role
  if (!loading && user && role) {
    if (role === 'driver') navigate('/driver', { replace: true })
    else navigate('/student', { replace: true })
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const fn = isSignUp ? signUp : signIn
    const { error: err } = await fn(email, password, selectedRole)
    setSubmitting(false)
    if (err) {
      setError(getAuthErrorMessage(err))
      return
    }
    if (isSignUp) {
      setError(null)
      // After sign up, redirect by selected role (app_metadata may need to be set in Dashboard for RLS)
      if (selectedRole === 'driver') navigate('/driver', { replace: true })
      else navigate('/student', { replace: true })
    }
  }

  const handlePortalClick = (portalRole: 'driver' | 'student') => {
    setSelectedRole(portalRole)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 mb-4">
            <Bus className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            NexaTSync
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Real-time fleet management</p>
        </div>

        {/* Role selection cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => handlePortalClick('driver')}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border backdrop-blur-xl transition-all ${
              selectedRole === 'driver'
                ? 'bg-emerald-500/20 border-emerald-400/50 text-white'
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
            }`}
          >
            <Bus className="w-6 h-6" />
            <span className="text-sm font-medium">Driver Portal</span>
          </button>
          <button
            type="button"
            onClick={() => handlePortalClick('student')}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border backdrop-blur-xl transition-all ${
              selectedRole === 'student'
                ? 'bg-emerald-500/20 border-emerald-400/50 text-white'
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
            }`}
          >
            <GraduationCap className="w-6 h-6" />
            <span className="text-sm font-medium">Student Portal</span>
          </button>
        </div>

        {/* Auth form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6"
        >
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition ${
                !isSignUp ? 'bg-white/15 text-white' : 'text-slate-400 hover:bg-white/5'
              }`}
            >
              <LogIn className="w-4 h-4" /> Log in
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition ${
                isSignUp ? 'bg-white/15 text-white' : 'text-slate-400 hover:bg-white/5'
              }`}
            >
              <UserPlus className="w-4 h-4" /> Sign up
            </button>
          </div>

          <label className="block text-sm text-slate-400 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mb-4"
            placeholder="you@example.com"
          />
          <label className="block text-sm text-slate-400 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mb-4"
            placeholder="••••••••"
          />

          {error && (
            <p className="text-red-400 text-sm mb-4" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? 'Please wait…' : isSignUp ? 'Sign up' : 'Log in'}
          </button>
        </form>

        <p className="text-center text-slate-500 text-xs mt-4">
          Driver writes require app_metadata.role = &apos;driver&apos; in Supabase Dashboard.
        </p>
      </div>
    </div>
  )
}
