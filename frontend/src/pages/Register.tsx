import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../api/client'

export default function Register() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(
    event: SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSubmitting(true)

    try {
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name,
          password,
        }),
      })

      setSuccess('Account created successfully.')

      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 800)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create account',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070910] px-6 text-white">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-300px] h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet-500/[0.08] blur-[150px]" />

        <div className="absolute bottom-[-250px] right-[-150px] h-[500px] w-[500px] rounded-full bg-blue-500/[0.06] blur-[150px]" />
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

        {/* Card */}
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-7 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-9">
          <p className="text-xs uppercase tracking-[0.16em] text-white/30">
            Get started
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Create your account
          </h1>

          <p className="mt-3 text-sm leading-6 text-white/40">
            Start tracking shared drink expenses with KoTrack.
          </p>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-400/10 bg-red-400/[0.06] px-4 py-3 text-sm leading-5 text-red-300"
            >
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div
              role="status"
              className="mt-6 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.06] px-4 py-3 text-sm leading-5 text-emerald-300"
            >
              {success}
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
                placeholder="Choose your name"
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
                placeholder="Create a password"
                required
                minLength={8}
                autoComplete="new-password"
                disabled={submitting}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/25 focus:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Confirm password */}
            <div>
              <label
                htmlFor="confirm-password"
                className="mb-2 block text-xs font-medium text-white/50"
              >
                Confirm password
              </label>

              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                placeholder="Repeat your password"
                required
                minLength={8}
                autoComplete="new-password"
                disabled={submitting}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/25 focus:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-white py-3.5 text-sm font-semibold text-black transition hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-white/35">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-white/70 transition hover:text-white"
            >
              Sign in
            </Link>
          </p>
        </div>

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