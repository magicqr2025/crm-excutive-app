import { useState, type FocusEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BellRing, CheckCircle2, Eye, EyeOff, Lock, Mail, Phone } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { APP_VERSION } from '@/config/appVersion'

// Palette for this screen only (violet, matching the logo):
// primary #6d4cff · deep #4c32d9 · ink #1d1638 · lavender wash #f4f1ff · pink glow #ec4899

/** Waveform bars of a live call. Decorative. */
function Waveform() {
  const bars = [6, 12, 18, 10, 22, 14, 8, 16, 20, 9, 13, 7]
  return (
    <span aria-hidden className="flex h-6 items-center gap-[3px]">
      {bars.map((h, i) => (
        <span
          key={i}
          className="login-bar w-[3px] rounded-full bg-[#6d4cff] motion-reduce:animate-none"
          style={{ height: h, animationDelay: `${i * 0.09}s` }}
        />
      ))}
    </span>
  )
}

/** The hero: a preview of what the shift looks like — a live call card with the follow-up and meeting it leads to. */
function CallPreview() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[300px] select-none">
      {/* Live call card */}
      <div className="login-float relative z-10 rounded-3xl bg-white/90 p-4 shadow-[0_24px_48px_-20px_rgba(76,50,217,0.45)] ring-1 ring-white backdrop-blur dark:bg-[#1d1638]/90 dark:ring-white/10 motion-reduce:animate-none">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#f9a8d4] to-[#c4b5fd] text-[14px] font-bold text-[#1d1638]">MB</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-[#1d1638] dark:text-white">MagicBolt AI</p>
            <p className="font-mono-num text-[12px] text-[#6b6590] dark:text-white/60">95595 69393</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#22c55e]/12 px-2 py-1 text-[11px] font-semibold text-[#15803d] dark:text-[#4ade80]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22c55e] motion-reduce:animate-none" />
            On call
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#f4f1ff] px-3 py-2.5 dark:bg-white/5">
          <Waveform />
          <span className="font-mono-num text-[13px] font-semibold text-[#4c32d9] dark:text-[#b4a5ff]">02:14</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ef4444] text-white">
            <Phone size={14} className="rotate-[135deg]" />
          </span>
        </div>
      </div>
      {/* What the call turns into */}
      <div className="relative -mt-3 ml-6 mr-2 flex flex-col gap-2 pt-6">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-[12px] font-medium text-[#1d1638] shadow-[0_8px_18px_-10px_rgba(76,50,217,0.5)] backdrop-blur dark:bg-[#1d1638]/85 dark:text-white">
          <BellRing size={13} className="text-[#d97706]" /> Follow-up set for 4:30 PM
        </span>
        <span className="ml-8 inline-flex w-fit items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-[12px] font-medium text-[#1d1638] shadow-[0_8px_18px_-10px_rgba(76,50,217,0.5)] backdrop-blur dark:bg-[#1d1638]/85 dark:text-white">
          <CheckCircle2 size={13} className="text-[#16a34a]" /> Demo booked for tomorrow
        </span>
      </div>
    </div>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // The keyboard takes a moment to open and shrink the screen; then scroll the field to the middle.
  function revealField(e: FocusEvent<HTMLInputElement>) {
    const el = e.currentTarget
    window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({ email, password })
      navigate('/home', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  const field =
    'login-field h-[52px] w-full rounded-2xl border border-[#e4defc] bg-white pl-11 text-[15px] text-[#1d1638] outline-none transition-[border-color,box-shadow] placeholder:text-[#9a94b8] focus:border-[#6d4cff] focus:ring-4 focus:ring-[#6d4cff]/15 dark:border-white/10 dark:bg-white/5 dark:text-white'

  return (
    <div className="relative h-dvh overflow-y-auto overscroll-contain bg-[#f4f1ff] dark:bg-[#0f0b1f]">
      <style>{`
        @keyframes login-bar { 0%,100% { transform: scaleY(.45); } 50% { transform: scaleY(1); } }
        .login-bar { animation: login-bar 1.1s ease-in-out infinite; transform-origin: center; }
        @keyframes login-float { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-6px) rotate(-2deg); } }
        .login-float { animation: login-float 5s ease-in-out infinite; transform: rotate(-2deg); }
        /* Keyboard open (or a very short screen): drop the picture, keep the form. */
        @media (max-height: 560px) { .login-hero { display: none; } }
        .login-field:-webkit-autofill,
        .login-field:-webkit-autofill:hover,
        .login-field:-webkit-autofill:focus {
          -webkit-text-fill-color: #1d1638;
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset;
          transition: background-color 9999s ease-out 0s;
        }
      `}</style>

      {/* Soft colour glows behind everything */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#8b6cff]/35 blur-3xl" />
      <div className="absolute -right-20 top-32 h-72 w-72 rounded-full bg-[#ec4899]/20 blur-3xl" />
      <div className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-[#6d4cff]/15 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] md:grid md:grid-cols-2 md:items-center md:gap-12 md:px-10">
        {/* Brand bar */}
        <header className="flex items-center justify-between md:absolute md:left-10 md:right-10 md:top-8">
          <span className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-9 w-9 rounded-full shadow-[0_6px_14px_-6px_rgba(76,50,217,0.6)]" />
            <span className="font-display text-[16px] font-semibold tracking-[-0.01em] text-[#1d1638] dark:text-white">Staff Crm</span>
          </span>
          <span className="rounded-full bg-white/70 px-2.5 py-1 font-mono-num text-[11px] text-[#6b6590] backdrop-blur dark:bg-white/10 dark:text-white/60">v{APP_VERSION}</span>
        </header>

        {/* Hero */}
        <div className="login-hero mt-8 md:mt-0">
          <CallPreview />
        </div>

        {/* Form */}
        <main className="mt-8 flex flex-1 flex-col md:mt-0 md:flex-none">
          <h1 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#1d1638] dark:text-white">
            Start your
            <br />
            <span className="bg-gradient-to-r from-[#6d4cff] to-[#d946ef] bg-clip-text text-transparent">calling shift</span>
          </h1>
          <p className="mt-2 text-[14px] text-[#6b6590] dark:text-white/60">Sign in with the email and password your admin gave you.</p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3.5">
            {error && (
              <p role="alert" className="rounded-2xl border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-[13px] text-[var(--error)]">
                {error}
              </p>
            )}
            <label className="relative block">
              <span className="sr-only">Email</span>
              <Mail size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8a83ad]" />
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                inputMode="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={revealField}
                className={`${field} pr-4`}
              />
            </label>
            <label className="relative block">
              <span className="sr-only">Password</span>
              <Lock size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8a83ad]" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={revealField}
                className={`${field} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-2xl text-[#8a83ad] hover:text-[#1d1638] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#6d4cff] dark:hover:text-white"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="group mt-2 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#6d4cff] to-[#4c32d9] text-[15px] font-semibold text-white shadow-[0_14px_28px_-12px_rgba(76,50,217,0.8)] transition-[filter,transform] hover:brightness-110 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d4cff] disabled:opacity-60 motion-reduce:transition-none"
            >
              {submitting ? (
                'Signing in…'
              ) : (
                <>
                  Sign in
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </>
              )}
            </button>
          </form>
        </main>
      </div>
    </div>
  )
}
