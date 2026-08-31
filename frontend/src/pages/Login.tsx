import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(
    event: SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError('')
    setSubmitting(true)

    try {
      await login(name, password)

      navigate('/dashboard', {
        replace: true,
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to sign in',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070910] px-6 text-white">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-300px] h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet-500/[0.08] blur-[150px]" />

        <div className="absolute bottom-[-250px] left-[-150px] h-[500px] w-[500px] rounded-full bg-blue-500/[0.06] blur-[150px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <Link
          to="/"
          className="mb-10 flex items-center justify-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
            <span className="font-bold">K</span>
          </div>

          <span className="text-xl font-semibold tracking-tight">
            KoTrack
          </span>
        </Link>

        {/* Login card */}
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-7 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-9">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-white/30">
              Welcome back
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Sign in to KoTrack
            </h1>

            <p className="mt-3 text-sm leading-6 text-white/40">
              Track sessions, balances and payments from one place.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-400/10 bg-red-400/[0.06] px-4 py-3 text-sm leading-5 text-red-300"
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5"
          >
            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-xs font-medium text-white/50"
              >
                Name
              </label>

              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Enter your name"
                required
                autoComplete="username"
                disabled={submitting}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/25 focus:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-xs font-medium text-white/50"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                disabled={submitting}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/25 focus:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-white py-3.5 text-sm font-semibold text-black transition hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Register */}
          <p className="mt-7 text-center text-sm text-white/35">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-white/70 transition hover:text-white"
            >
              Register
            </Link>
          </p>
        </div>

        {/* Back */}
        <Link
          to="/"
          className="mt-6 block text-center text-xs text-white/25 transition hover:text-white/50"
        >
          ← Back to KoTrack
        </Link>
      </div>
    </main>
  )
}