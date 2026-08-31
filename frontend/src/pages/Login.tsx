import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { apiRequest } from '../api/client'

type ResetStep = 'request' | 'confirm'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [submitting, setSubmitting] = useState(false)

  const [showForgotPassword, setShowForgotPassword] =
    useState(false)

  const [resetStep, setResetStep] =
    useState<ResetStep>('request')

  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')

  async function handleSubmit(
    event: SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError('')
    setSuccess('')
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

  async function handleResetRequest(
    event: SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      await apiRequest(
        '/api/auth/password-reset/request',
        {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
          }),
        },
      )

      setSuccess(
        'Reset request submitted. Please contact an administrator for your reset code.',
      )

      setResetStep('confirm')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit reset request',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResetConfirm(
    event: SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      await apiRequest(
        '/api/auth/password-reset/confirm',
        {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            code: resetCode.trim(),
            new_password: newPassword,
          }),
        },
      )

      setSuccess(
        'Password reset successful. You can now sign in with your new password.',
      )

      setPassword('')
      setResetCode('')
      setNewPassword('')
      setShowForgotPassword(false)
      setResetStep('request')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reset password',
      )
    } finally {
      setSubmitting(false)
    }
  }

  function openForgotPassword() {
    setError('')
    setSuccess('')
    setShowForgotPassword(true)
    setResetStep('request')
  }

  function closeForgotPassword() {
    setError('')
    setSuccess('')
    setShowForgotPassword(false)
    setResetStep('request')
    setResetCode('')
    setNewPassword('')
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
            <span className="font-bold">
              K
            </span>
          </div>

          <span className="text-xl font-semibold tracking-tight">
            KoTrack
          </span>
        </Link>

        {/* Card */}
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-7 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-9">

          {!showForgotPassword ? (
            <>
              {/* Login heading */}
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
                    name="username"
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
                  <div className="mb-2 flex items-center justify-between">

                    <label
                      htmlFor="password"
                      className="block text-xs font-medium text-white/50"
                    >
                      Password
                    </label>

                    <button
                      type="button"
                      onClick={openForgotPassword}
                      className="text-xs text-white/45 transition hover:text-white"
                    >
                      Forgot password?
                    </button>

                  </div>

                  <input
                    id="password"
                    name="password"
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

                {/* Remember me */}
                <label className="flex cursor-pointer items-center gap-2.5 select-none">

                  <input
                    type="checkbox"
                    name="remember"
                    checked={rememberMe}
                    onChange={(event) =>
                      setRememberMe(
                        event.target.checked,
                      )
                    }
                    className="h-3.5 w-3.5 rounded border-white/20 bg-black/20 accent-violet-400"
                  />

                  <span className="text-xs text-white/40">
                    Remember me
                  </span>

                </label>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-white py-3.5 text-sm font-semibold text-black transition hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? 'Signing in...'
                    : 'Sign in'}
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
            </>
          ) : (
            <>
              {/* Forgot password */}
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/30">
                  Account recovery
                </p>

                <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                  Reset your password
                </h1>

                <p className="mt-3 text-sm leading-6 text-white/40">
                  An administrator must approve your reset request and provide you with a reset code.
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

              {/* Success */}
              {success && (
                <div
                  role="status"
                  className="mt-6 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.06] px-4 py-3 text-sm leading-5 text-emerald-300"
                >
                  {success}
                </div>
              )}

              {resetStep === 'request' ? (
                <form
                  onSubmit={handleResetRequest}
                  className="mt-8 space-y-5"
                >
                  <div>
                    <label
                      htmlFor="reset-name"
                      className="mb-2 block text-xs font-medium text-white/50"
                    >
                      Name
                    </label>

                    <input
                      id="reset-name"
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

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-white py-3.5 text-sm font-semibold text-black transition hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting
                      ? 'Submitting...'
                      : 'Request reset code'}
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={handleResetConfirm}
                  className="mt-8 space-y-5"
                >
                  <div>
                    <label
                      htmlFor="reset-code"
                      className="mb-2 block text-xs font-medium text-white/50"
                    >
                      Reset code
                    </label>

                    <input
                      id="reset-code"
                      type="text"
                      value={resetCode}
                      onChange={(event) =>
                        setResetCode(
                          event.target.value
                            .replace(/\D/g, '')
                            .slice(0, 6),
                        )
                      }
                      placeholder="Enter 6-digit code"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      disabled={submitting}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm tracking-[0.2em] text-white outline-none transition placeholder:tracking-normal placeholder:text-white/20 focus:border-white/25 focus:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="new-password"
                      className="mb-2 block text-xs font-medium text-white/50"
                    >
                      New password
                    </label>

                    <input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(event) =>
                        setNewPassword(
                          event.target.value,
                        )
                      }
                      placeholder="At least 8 characters"
                      minLength={8}
                      required
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
                    {submitting
                      ? 'Resetting password...'
                      : 'Reset password'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResetStep('request')
                      setError('')
                      setSuccess('')
                      setResetCode('')
                      setNewPassword('')
                    }}
                    className="w-full text-xs text-white/35 transition hover:text-white/60"
                  >
                    Request a new code
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={closeForgotPassword}
                className="mt-7 w-full text-center text-sm text-white/35 transition hover:text-white/70"
              >
                ← Back to sign in
              </button>
            </>
          )}

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