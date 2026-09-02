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

  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetStep, setResetStep] = useState<ResetStep>('request')

  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      await login(name, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResetRequest(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      await apiRequest('/api/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
        }),
      })

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

  async function handleResetConfirm(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      await apiRequest('/api/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          code: resetCode.trim(),
          new_password: newPassword,
        }),
      })

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

  const fieldClass =
    'min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-base text-white outline-none transition-[border-color,background-color,box-shadow] duration-150 ease-out placeholder:text-white/25 hover:border-white/20 focus:border-white/30 focus:bg-white/[0.03] focus:ring-2 focus:ring-white/15 disabled:cursor-not-allowed disabled:opacity-50'

  const primaryButtonClass =
    'flex min-h-11 w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#070910] outline-none transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-white/90 hover:shadow-[0_6px_18px_rgba(255,255,255,0.08)] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#070910] disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <main className="login-page min-h-[100dvh] bg-[#070910] px-4 py-6 text-white sm:px-6 sm:py-10">
      <style>{`
        @keyframes kotrack-page-enter {
          from {
            opacity: 0;
            transform: translateY(4px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes kotrack-card-enter {
          from {
            opacity: 0;
            transform: translateY(4px);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes kotrack-view-enter {
          from {
            opacity: 0;
            transform: translateY(3px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes kotrack-feedback-enter {
          from {
            opacity: 0;
            transform: translateY(-2px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .login-page {
          animation:
            kotrack-page-enter
            280ms
            ease-out
            both;
        }

        .login-card {
          animation:
            kotrack-card-enter
            300ms
            ease-out
            both;
        }

        .login-view {
          animation:
            kotrack-view-enter
            180ms
            ease-out
            both;
        }

        .login-feedback {
          animation:
            kotrack-feedback-enter
            170ms
            ease-out
            both;
        }

        @media (prefers-reduced-motion: reduce) {
          .login-page,
          .login-card,
          .login-view,
          .login-feedback {
            animation: none;
          }
        }
      `}</style>

      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md flex-col justify-center sm:min-h-[calc(100dvh-5rem)]">

        {/* Brand */}
        <Link
          to="/"
          className="mb-6 inline-flex w-fit items-center gap-2.5 self-center rounded-lg px-2 py-1.5 outline-none transition-colors duration-150 hover:text-white/80 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070910]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-sm font-bold">
            K
          </span>

          <span>
            <span className="block text-sm font-semibold leading-none">
              KoTrack
            </span>

            <span className="mt-1 block text-[9px] uppercase tracking-wider text-white/25">
              Sign in
            </span>
          </span>
        </Link>

        {/* Login card */}
        <div className="login-card overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">

          {/* Card header */}
          <div className="border-b border-white/[0.06] px-5 py-4 sm:px-7 sm:py-5">
            <div className="flex items-center gap-3">

              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/60">
                {showForgotPassword ? <KeyIcon /> : <LedgerIcon />}
              </span>

              <div>
                <p className="text-[9px] font-medium uppercase tracking-wider text-white/25">
                  {showForgotPassword
                    ? 'Account recovery'
                    : 'Secure workspace'}
                </p>

                <p className="mt-0.5 text-xs text-white/50">
                  {showForgotPassword
                    ? 'Reset access to your account'
                    : 'Manage sessions and shared costs'}
                </p>
              </div>

            </div>
          </div>

          <div
            key={showForgotPassword ? 'recovery' : 'sign-in'}
            className="login-view p-5 sm:p-7"
          >

            {!showForgotPassword ? (
              <>
                {/* Login heading */}
                <div>
                  <p className="text-sm font-medium text-white/70">
                    Welcome back
                  </p>

                  <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                    Sign in to KoTrack
                  </h1>

                  <p className="mt-3 max-w-sm text-sm leading-6 text-white/40">
                    Track sessions, balances and payments from one place.
                  </p>
                </div>

                {/* Error */}
                {error && <ErrorMessage message={error} />}

                <form
                  onSubmit={handleSubmit}
                  className="mt-7 space-y-5"
                >

                  {/* Name */}
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-2 block text-sm font-medium text-white/70"
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
                      className={fieldClass}
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">

                      <label
                        htmlFor="password"
                        className="block text-sm font-medium text-white/70"
                      >
                        Password
                      </label>

                      <button
                        type="button"
                        onClick={openForgotPassword}
                        className="min-h-11 -my-2 inline-flex items-center rounded-lg px-2 text-sm font-medium text-white/60 outline-none transition-colors duration-150 hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"
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
                      className={fieldClass}
                    />
                  </div>

                  {/* Remember me */}
                  <label className="flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-lg px-1">

                    <input
                      type="checkbox"
                      name="remember"
                      checked={rememberMe}
                      onChange={(event) =>
                        setRememberMe(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-white/20 bg-black/20 accent-white"
                    />

                    <span className="text-sm text-white/60">
                      Remember me
                    </span>

                  </label>

                  {/* Login button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className={primaryButtonClass}
                  >
                    <span
                      className={
                        submitting
                          ? 'opacity-70'
                          : 'opacity-100'
                      }
                    >
                      {submitting
                        ? 'Signing in...'
                        : 'Sign in'}
                    </span>
                  </button>

                </form>

                {/* Register */}
                <p className="mt-6 text-center text-sm text-white/35">
                  Don't have an account?{' '}

                  <Link
                    to="/register"
                    className="rounded-sm font-medium text-white/70 outline-none transition-colors duration-150 hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"
                  >
                    Register
                  </Link>
                </p>
              </>
            ) : (
              <>
                {/* Recovery heading */}
                <div>
                  <p className="text-sm font-medium text-white/70">
                    Account recovery
                  </p>

                  <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                    Reset your password
                  </h1>

                  <p className="mt-3 text-sm leading-6 text-white/40">
                    An administrator must approve your reset request
                    and provide you with a reset code.
                  </p>
                </div>

                {/* Feedback */}
                {error && <ErrorMessage message={error} />}
                {success && <SuccessMessage message={success} />}

                {resetStep === 'request' ? (
                  <form
                    onSubmit={handleResetRequest}
                    className="mt-7 space-y-5"
                  >
                    <div>
                      <label
                        htmlFor="reset-name"
                        className="mb-2 block text-sm font-medium text-white/70"
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
                        className={fieldClass}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className={primaryButtonClass}
                    >
                      {submitting
                        ? 'Submitting...'
                        : 'Request reset code'}
                    </button>

                  </form>
                ) : (
                  <form
                    onSubmit={handleResetConfirm}
                    className="mt-7 space-y-5"
                  >
                    <div>
                      <label
                        htmlFor="reset-code"
                        className="mb-2 block text-sm font-medium text-white/70"
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
                        className={`${fieldClass} tracking-[0.2em] placeholder:tracking-normal`}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="new-password"
                        className="mb-2 block text-sm font-medium text-white/70"
                      >
                        New password
                      </label>

                      <input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(event) =>
                          setNewPassword(event.target.value)
                        }
                        placeholder="At least 8 characters"
                        minLength={8}
                        required
                        autoComplete="new-password"
                        disabled={submitting}
                        className={fieldClass}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className={primaryButtonClass}
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
                      className="min-h-11 w-full rounded-lg px-3 text-sm font-medium text-white/60 outline-none transition-colors duration-150 hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      Request a new code
                    </button>
                  </form>
                )}

                {/* Back to sign in */}
                <button
                  type="button"
                  onClick={closeForgotPassword}
                  className="mt-6 flex min-h-11 w-full items-center justify-center rounded-lg px-3 text-sm font-medium text-white/60 outline-none transition-colors duration-150 hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  <span
                    aria-hidden="true"
                    className="mr-2 transition-transform duration-200"
                  >
                    ←
                  </span>

                  Back to sign in
                </button>
              </>
            )}

          </div>
        </div>

        {/* Back to homepage */}
        <Link
          to="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center self-center rounded-lg px-3 text-sm text-white/35 outline-none transition-colors duration-150 hover:text-white/60 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070910]"
        >
          <span
            aria-hidden="true"
            className="mr-2"
          >
            ←
          </span>

          Back to KoTrack
        </Link>

      </div>
    </main>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="login-feedback mt-6 flex gap-3 rounded-xl border border-red-400/10 bg-red-400/[0.05] px-4 py-3 text-sm leading-5 text-red-300"
    >
      <AlertIcon />

      <span>{message}</span>
    </div>
  )
}

function SuccessMessage({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="login-feedback mt-6 flex gap-3 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.05] px-4 py-3 text-sm leading-5 text-emerald-300"
    >
      <CheckIcon />

      <span>{message}</span>
    </div>
  )
}

function LedgerIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M7 3.75h9.5a2 2 0 0 1 2 2v14.5H7a2.5 2.5 0 0 1 0-5h11.5" />
      <path d="M7 3.75v11.5" />
      <path d="M10 8h5M10 12h5" />
    </svg>
  )
}

function KeyIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <circle cx="8" cy="15" r="3.25" />
      <path d="m10.3 12.7 7.2-7.2 2 2-1.8 1.8 1.4 1.4-2 2-1.4-1.4-2.2 2.2" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg
      className="mt-0.5 shrink-0 text-red-300"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
      <path d="m10.2 4.5-7 12.1A2 2 0 0 0 5 19.5h14a2 2 0 0 0 1.7-2.9l-7-12.1a2 2 0 0 0-3.5 0Z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 shrink-0 text-emerald-300"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="m5 12 4.2 4.2L19 6.5" />
    </svg>
  )
}
