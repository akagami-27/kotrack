import { useCallback, useEffect, useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import { apiRequest } from '../api/client'
import { isAdminRole, isSuperAdminRole } from '../auth/roles'

type ResetStep = 'request' | 'confirm'
type AuthenticationState = 'form' | 'verifying' | 'welcome'
type LoginStep = 'identifier' | 'password'

type LoginLocationState = {
  from?: {
    pathname?: string
    search?: string
    hash?: string
  }
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, user } = useAuth()

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [authenticationState, setAuthenticationState] =
    useState<AuthenticationState>('form')
  const [authenticatedName, setAuthenticatedName] = useState('')
  const [authenticatedAvatar, setAuthenticatedAvatar] = useState<string | null>(null)
  const [loginStep, setLoginStep] = useState<LoginStep>('identifier')
  const passwordInputRef = useRef<HTMLInputElement | null>(null)
  const redirectTimerRef = useRef<number | null>(null)
  const verificationTimerRef = useRef<number | null>(null)
  const resolveVerificationDelayRef = useRef<(() => void) | null>(null)
  const verificationStartedAtRef = useRef<number | null>(null)
  const mountedRef = useRef(false)

  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetStep, setResetStep] = useState<ResetStep>('request')

  const [newPassword, setNewPassword] = useState('')
  const [resetStatus, setResetStatus] = useState('PENDING')

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (redirectTimerRef.current !== null) window.clearTimeout(redirectTimerRef.current)
      if (verificationTimerRef.current !== null) window.clearTimeout(verificationTimerRef.current)
      resolveVerificationDelayRef.current?.()
    }
  }, [])

  useEffect(() => {
    if (!showForgotPassword && loginStep === 'password' && authenticationState === 'form') {
      passwordInputRef.current?.focus()
    }
  }, [showForgotPassword, loginStep, authenticationState])

  const getReturnPath = useCallback((role?: string): string => {
    const state = location.state as LoginLocationState | null
    const from = state?.from
    const pathname = from?.pathname
    const defaultDestination = '/dashboard'

    if (!pathname || !pathname.startsWith('/') || pathname.startsWith('//')) {
      return defaultDestination
    }

    const isAdminDestination = pathname === '/admin' || pathname.startsWith('/admin/')
    const isSuperAdminDestination = pathname === '/admin/users' || pathname.startsWith('/admin/users/')

    if (isSuperAdminDestination && !isSuperAdminRole(role)) return defaultDestination
    if (isAdminDestination && !isAdminRole(role)) return '/dashboard'

    return `${pathname}${from.search ?? ''}${from.hash ?? ''}`
  }, [location.state])

  useEffect(() => {
    if (user && authenticationState === 'form' && !submitting) {
      navigate(getReturnPath(user.role), { replace: true })
    }
  }, [user, authenticationState, submitting, getReturnPath, navigate])

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (!name.trim() || !password) {
      setError('Enter your name and password to sign in.')
      return
    }

    if (submitting) return

    setSubmitting(true)

    try {
      const authenticatedUser = await login(name, password, () => {
        if (!mountedRef.current) return
        verificationStartedAtRef.current = Date.now()
        setAuthenticationState('verifying')
      })
      if (!mountedRef.current) return
      const verificationElapsed = verificationStartedAtRef.current === null
        ? 0
        : Date.now() - verificationStartedAtRef.current
      const verificationDisplayRemainder = Math.max(0, 500 - verificationElapsed)
      if (verificationDisplayRemainder > 0) {
        await new Promise<void>((resolve) => {
          const finish = () => {
            verificationTimerRef.current = null
            resolveVerificationDelayRef.current = null
            resolve()
          }
          resolveVerificationDelayRef.current = finish
          verificationTimerRef.current = window.setTimeout(finish, verificationDisplayRemainder)
        })
      }
      if (!mountedRef.current) return
      setAuthenticatedName(authenticatedUser.name?.trim() || name.trim() || 'User')
      setAuthenticatedAvatar(authenticatedUser.avatar_data ?? null)
      setAuthenticationState('welcome')
      redirectTimerRef.current = window.setTimeout(() => {
        navigate(getReturnPath(authenticatedUser.role), { replace: true })
      }, 2000)
    } catch (err) {
      if (!mountedRef.current) return
      verificationStartedAtRef.current = null
      setAuthenticationState('form')
      setLoginStep('password')
      const message = err instanceof Error ? err.message : ''
      setError(
        message === 'Incorrect name or password'
          ? 'Invalid username or password. Please try again.'
          : message || 'Unable to connect to the server. Please try again.',
      )
    } finally {
      if (mountedRef.current) setSubmitting(false)
    }
  }

  function continueToPassword(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Enter the name on your KoTrack account to continue.')
      return
    }
    setLoginStep('password')
  }

  function backToIdentifier() {
    setPassword('')
    setShowPassword(false)
    setError('')
    setLoginStep('identifier')
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
        credentials: 'include',
      })

      setSuccess(
        'If the account is eligible, the request has been recorded for Super Admin review. Keep this browser open to continue after approval.',
      )

      setResetStep('confirm')
      setResetStatus('PENDING')
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
      const state = await apiRequest<{ status: string }>('/api/auth/password-reset/status', {
        credentials: 'include',
      })
      setResetStatus(state.status)
      if (state.status !== 'APPROVED') {
        setSuccess(state.status === 'PENDING'
          ? 'Your request is awaiting Super Admin review.'
          : state.status === 'REJECTED'
            ? 'This request was rejected. Contact a Super Admin to confirm next steps.'
            : 'This recovery session is unavailable or expired. Submit a new request.')
        return
      }
      await apiRequest('/api/auth/password-reset/complete', {
        method: 'POST',
        body: JSON.stringify({
          new_password: newPassword,
        }),
        credentials: 'include',
      })

      setSuccess(
        'Password reset successful. You can now sign in with your new password.',
      )

      setPassword('')
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

  async function refreshResetStatus() {
    setSubmitting(true)
    setError('')
    try {
      const state = await apiRequest<{ status: string }>('/api/auth/password-reset/status', { credentials: 'include' })
      setResetStatus(state.status)
      setSuccess(state.status === 'APPROVED'
        ? 'Approved. Set your new password below.'
        : state.status === 'PENDING'
          ? 'Your request is awaiting Super Admin review.'
          : 'This recovery session is unavailable or expired.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check request status')
    } finally {
      setSubmitting(false)
    }
  }

  function openForgotPassword() {
    setError('')
    setSuccess('')
    setShowForgotPassword(true)
    setResetStep('request')
    void apiRequest<{ status: string }>('/api/auth/password-reset/status', {
      credentials: 'include',
    }).then((state) => {
      if (state.status === 'PENDING' || state.status === 'APPROVED' || state.status === 'REJECTED') {
        setResetStatus(state.status)
        setResetStep('confirm')
      }
    }).catch(() => {
      // No existing private recovery session; show the request form.
    })
  }

  function closeForgotPassword() {
    setError('')
    setSuccess('')
    setShowForgotPassword(false)
    setResetStep('request')
    setNewPassword('')
  }

  const fieldClass =
    'min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-base text-white outline-none transition-[border-color,background-color,box-shadow] duration-150 ease-out placeholder:text-white/25 hover:border-white/20 focus:border-white/30 focus:bg-white/[0.03] focus:ring-2 focus:ring-white/15 disabled:cursor-not-allowed disabled:opacity-50'

  const primaryButtonClass =
    'flex min-h-11 w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#070910] outline-none transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-white/90 hover:shadow-[0_6px_18px_rgba(255,255,255,0.08)] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#070910] disabled:cursor-not-allowed disabled:opacity-50'

  if (user && authenticationState === 'form' && !submitting) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#070910] text-white" role="status" aria-live="polite">
        <p className="text-sm text-white/45">Opening your KoTrack workspace...</p>
      </main>
    )
  }

  return (
    <main className="login-page min-h-[100dvh] bg-[#070910] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-white sm:px-6 sm:py-10">
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

        @keyframes kotrack-field-enter {
          from {
            opacity: 0;
            transform: translateY(5px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes kotrack-error-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }

        @keyframes kotrack-spinner {
          to { transform: rotate(360deg); }
        }

        @keyframes kotrack-success-ring {
          from { stroke-dashoffset: 176; }
          to { stroke-dashoffset: 0; }
        }

        @keyframes kotrack-success-check {
          from { stroke-dashoffset: 36; opacity: 0; }
          to { stroke-dashoffset: 0; opacity: 1; }
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

        .login-stagger {
          animation: kotrack-field-enter 240ms ease-out both;
        }

        .login-stagger:nth-child(2) { animation-delay: 45ms; }
        .login-stagger:nth-child(3) { animation-delay: 90ms; }
        .login-stagger:nth-child(4) { animation-delay: 135ms; }

        .login-form-error {
          animation: kotrack-error-shake 240ms ease-out;
        }

        .login-spinner {
          animation: kotrack-spinner 700ms linear infinite;
        }

        .login-success-ring {
          stroke-dasharray: 176;
          stroke-dashoffset: 176;
          animation: kotrack-success-ring 520ms ease-out forwards;
        }

        .login-success-check {
          stroke-dasharray: 36;
          stroke-dashoffset: 36;
          animation: kotrack-success-check 300ms 360ms ease-out forwards;
        }

        .login-step-enter {
          animation: kotrack-field-enter 260ms ease-out both;
        }

        .login-avatar-pulse {
          animation: kotrack-avatar-pulse 1.6s ease-in-out infinite;
        }

        .login-shield-glow {
          animation: kotrack-shield-glow 1.8s ease-in-out infinite;
        }

        .login-welcome-avatar {
          animation: kotrack-avatar-enter 420ms cubic-bezier(.22,1,.36,1) both;
        }

        .login-welcome-check {
          animation: kotrack-check-pop 280ms 180ms cubic-bezier(.22,1,.36,1) both;
          transform-origin: center;
        }

        @keyframes kotrack-avatar-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.02); }
          50% { box-shadow: 0 0 0 7px rgba(255, 255, 255, 0.05); }
        }

        @keyframes kotrack-shield-glow {
          0%, 100% { opacity: .45; transform: scale(.96); }
          50% { opacity: 1; transform: scale(1.03); }
        }

        @keyframes kotrack-avatar-enter {
          from { opacity: 0; transform: translateY(8px) scale(.92); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes kotrack-check-pop {
          from { opacity: 0; transform: scale(.5); }
          to { opacity: 1; transform: scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-page,
          .login-card,
          .login-view,
          .login-feedback {
            animation: none;
          }

          .login-stagger,
          .login-form-error,
          .login-spinner,
          .login-success-ring,
          .login-success-check {
            animation: none;
          }

          .login-step-enter,
          .login-avatar-pulse,
          .login-shield-glow,
          .login-welcome-avatar,
          .login-welcome-check {
            animation: none;
          }

          .login-success-ring,
          .login-success-check {
            stroke-dashoffset: 0;
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

              <LoginAvatarHero
                name={authenticatedName || name}
                avatar={authenticatedAvatar}
                status={authenticationState === 'verifying' ? 'verifying' : authenticationState === 'welcome' ? 'success' : submitting ? 'pending' : 'idle'}
              />

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
              authenticationState === 'verifying' ? (
                <AccountVerification />
              ) : authenticationState === 'welcome' ? (
                <LoginSuccess key={`${authenticatedName}:${authenticatedAvatar ?? ''}`} name={authenticatedName || name.trim() || 'User'} avatar={authenticatedAvatar} />
              ) : (
                <>
                {/* Login heading */}
                <div className="login-stagger">
                  <p className="text-sm font-medium text-white/70">
                    {loginStep === 'password' ? `Welcome back, ${name.trim()}` : 'Welcome back'}
                  </p>

                  <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                    Sign in to KoTrack
                  </h1>

                  <p className="mt-3 max-w-sm text-sm leading-6 text-white/40">
                    {loginStep === 'identifier'
                      ? 'Track sessions, balances and payments from one place.'
                      : 'Enter your password to continue to your account.'}
                  </p>
                </div>

                {/* Error */}
                {error && <ErrorMessage message={error} />}

                {loginStep === 'identifier' ? (
                  <form
                    key="identifier"
                    onSubmit={continueToPassword}
                    className={`login-step-enter mt-7 space-y-5 ${error ? 'login-form-error' : ''}`}
                  >
                    <div className="login-stagger">
                      <label htmlFor="name" className="mb-2 block text-sm font-medium text-white/70">
                        Name or username
                      </label>
                      <div className="relative">
                        <UserIdentifierIcon />
                        <input
                          id="name"
                          name="username"
                          type="text"
                          value={name}
                          onChange={(event) => { setName(event.target.value); setError('') }}
                          placeholder="Enter the name on your account"
                          required
                          autoComplete="username"
                          autoCapitalize="none"
                          spellCheck={false}
                          disabled={submitting}
                          aria-invalid={error ? true : undefined}
                          className={`${fieldClass} pl-11 ${error ? 'border-red-400/35 focus:border-red-300/60 focus:ring-red-300/20' : ''}`}
                        />
                      </div>
                      <p className="mt-2 text-xs text-white/35">Use the name registered with your KoTrack account.</p>
                    </div>
                    <button type="submit" disabled={submitting} className={`login-stagger ${primaryButtonClass}`}>
                      <span>Continue</span>
                      <ArrowRightIcon />
                    </button>
                  </form>
                ) : (
                  <form
                    key="password"
                    onSubmit={handleSubmit}
                    className={`login-step-enter mt-7 space-y-5 ${error ? 'login-form-error' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-sm font-semibold text-white/75">
                          {name.trim().charAt(0).toUpperCase() || 'K'}
                        </span>
                        <span className="truncate text-sm text-white/70">{name.trim()}</span>
                      </div>
                      <button type="button" onClick={backToIdentifier} disabled={submitting} className="min-h-9 shrink-0 rounded-lg px-2 text-xs font-medium text-white/55 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50">
                        Change
                      </button>
                    </div>

                    <div className="login-stagger">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <label htmlFor="password" className="block text-sm font-medium text-white/70">Password</label>
                        <button type="button" onClick={openForgotPassword} disabled={submitting} className="min-h-9 -my-1 inline-flex items-center rounded-lg px-2 text-xs font-medium text-white/60 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-50">
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <PasswordFieldIcon />
                        <input
                          ref={passwordInputRef}
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(event) => { setPassword(event.target.value); setError('') }}
                          placeholder="Enter your password"
                          required
                          autoComplete="current-password"
                          disabled={submitting}
                          aria-invalid={error ? true : undefined}
                          className={`${fieldClass} pl-11 pr-12 ${error ? 'border-red-400/35 focus:border-red-300/60 focus:ring-red-300/20' : ''}`}
                        />
                        <button type="button" onClick={() => setShowPassword((visible) => !visible)} disabled={submitting} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center rounded-r-xl text-white/45 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-50">
                          <PasswordVisibilityIcon visible={showPassword} />
                        </button>
                      </div>
                    </div>

                    <label className="login-stagger flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-lg px-1">
                      <input type="checkbox" name="remember" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} disabled={submitting} className="h-4 w-4 rounded border-white/20 bg-black/20 accent-white disabled:cursor-not-allowed" />
                      <span className="text-sm text-white/60">Remember me</span>
                    </label>

                    <button type="submit" disabled={submitting} className={`login-stagger ${primaryButtonClass}`}>
                      {submitting ? <LoadingSpinner /> : <ArrowRightIcon />}
                      <span>{submitting ? 'Authenticating...' : 'Sign in'}</span>
                    </button>
                    {submitting && <p role="status" aria-live="polite" className="text-center text-xs text-white/45">Verifying your credentials...</p>}
                  </form>
                )}

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
              )
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
                    A Super Admin reviews your request. Approval is returned only to this browser session.
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
                        : 'Request password reset'}
                    </button>

                  </form>
                ) : (
                  <form
                    onSubmit={handleResetConfirm}
                    className="mt-7 space-y-5"
                  >
                    <p className="text-sm text-white/55" role="status">
                      Request status: {resetStatus.toLowerCase().replace('_', ' ')}.
                    </p>

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
                      disabled={submitting || resetStatus !== 'APPROVED'}
                      className={primaryButtonClass}
                    >
                      {submitting
                        ? 'Resetting password...'
                        : 'Set new password'}
                    </button>

                    <button
                      type="button"
                      onClick={() => void refreshResetStatus()}
                      disabled={submitting}
                      className="min-h-11 w-full rounded-lg px-3 text-sm font-medium text-white/60 outline-none transition-colors duration-150 hover:text-white focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      Check approval status
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

function LoginAvatarHero({
  name,
  avatar,
  status,
}: {
  name: string
  avatar: string | null
  status: 'idle' | 'pending' | 'verifying' | 'success'
}) {
  const initial = name.trim().charAt(0).toUpperCase() || 'K'
  return (
    <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.05] text-base font-semibold text-white/80 ${status === 'pending' || status === 'verifying' ? 'login-avatar-pulse' : ''}`} aria-label={status === 'success' ? `Signed in as ${name}` : 'KoTrack account avatar'}>
      {status === 'success' && avatar ? (
        <img src={avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
      {(status === 'pending' || status === 'verifying') && <span className="absolute inset-0 rounded-xl border border-white/35" aria-hidden="true" />}
      {status === 'success' && <span className="login-welcome-check absolute -bottom-0.5 -right-0.5 rounded-tl-md bg-emerald-300 p-0.5 text-[#070910]" aria-hidden="true"><SmallCheckIcon /></span>}
    </span>
  )
}

function AccountVerification() {
  return (
    <section className="login-step-enter py-7 text-center" role="status" aria-live="polite" aria-atomic="true">
      <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-cyan-200/10 bg-cyan-200/[0.035]">
        <span className="login-shield-glow absolute inset-1 rounded-full border border-cyan-200/25" aria-hidden="true" />
        <ShieldCheckIcon className="relative h-12 w-12 text-cyan-100/90" />
      </div>
      <p className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-cyan-100/70">Your account is securely verified</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Verifying your account</h1>
      <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-white/50">
        Your credentials have been successfully verified. Preparing your secure session.
      </p>
    </section>
  )
}

function UserIdentifierIcon() {
  return (
    <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 20v-1.2a6.5 6.5 0 0 1 13 0V20z" strokeLinejoin="round" />
    </svg>
  )
}

function PasswordFieldIcon() {
  return (
    <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="4.5" y="10" width="15" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" strokeLinecap="round" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg className="ml-1 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LoginSuccess({ name, avatar }: { name: string; avatar: string | null }) {
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)

  return (
    <div className="login-step-enter py-7 text-center" role="status" aria-live="polite" aria-atomic="true">
      <div className="relative mx-auto h-24 w-24">
        <div className="login-welcome-avatar flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-emerald-200/25 bg-white/[0.06] text-3xl font-semibold text-white/75 shadow-[0_0_32px_rgba(110,231,183,0.1)]">
          {avatar && !avatarLoadFailed ? (
            <img src={avatar} alt="" onError={() => setAvatarLoadFailed(true)} className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden="true">{name.trim().charAt(0).toUpperCase() || 'K'}</span>
          )}
        </div>
        <span className="login-welcome-check absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-4 border-[#0b0d15] bg-emerald-300 text-[#070910]" aria-label="Verified">
          <SmallCheckIcon />
        </span>
      </div>
      <p className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-emerald-200/70">Signed in securely</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Welcome back, {name.trim() || 'User'}
      </h1>
      <p className="mt-3 text-sm leading-6 text-white/50">
        You're ready to pick up where you left off.
      </p>
      <p className="mt-7 text-xs text-white/40">Taking you to KoTrack...</p>
    </div>
  )
}

function ShieldCheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M24 4.5 39 10v11.5c0 10.1-6.5 17.5-15 22-8.5-4.5-15-11.9-15-22V10l15-5.5Z" strokeLinejoin="round" />
      <path d="m16.5 23.5 5 5 10-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SmallCheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="m3 8 3.2 3.2L13 4.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LoadingSpinner() {
  return (
    <svg
      className="login-spinner -ml-1 mr-2 h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
    </svg>
  )
}

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M3 3l18 18" strokeLinecap="round" />
      <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.3A10.7 10.7 0 0 1 12 4c5.2 0 8.7 5.1 9 8-.1 1.1-.7 2.5-1.6 3.8M6.2 6.2C4.3 7.8 3.1 10 3 12c.3 2.9 3.8 8 9 8 1.5 0 2.9-.4 4.1-1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M3 12s3.3-6 9-6 9 6 9 6-3.3 6-9 6-9-6-9-6Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.75" />
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
