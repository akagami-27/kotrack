import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { apiRequest } from '../api/client'
import { useAuth } from '../auth/AuthContext'

type Participant = {
  user_id: number
  user_name: string
}

type SessionRequest = {
  id: number
  requested_by: number
  session_date: string
  packets_used: string | number
  note: string | null
  status: string
  created_at: string
  reviewed_at: string | null
  reviewed_by: number | null
  participants: Participant[]
}

type ManagedUser = {
  id: number
  name: string
  role: string
  is_active: boolean
  created_at?: string
  avatar_data?: string | null
}

type DrinkSession = {
  id: number
  session_date: string
  packets_used: string | number
  price_per_packet: string | number
  total_cost: string | number
  created_by: number
  participants: Participant[]
}

type UserAnalytics = {
  user_id: number
  name: string
  total_owed: number
  total_paid: number
  balance: number
}

type HighestSpender = {
  user_id: number
  name: string
  total_spent: number
}

type Payment = {
  id: number
  user_id: number
  amount: number | string
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | string
  created_at: string
}

type AnalyticsResponse = {
  summary: {
    total_users: number
    total_sessions: number
    total_packets: number
    total_session_value: number
    total_confirmed_payments: number
    total_outstanding: number
    pending_payments: number
    pending_session_requests: number
  }
  users: UserAnalytics[]
  highest_debt_users: UserAnalytics[]
  highest_spenders: HighestSpender[]
}

const PAGE_SIZE = 5

export default function AdminDashboard() {
  const { user } = useAuth()

  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString('en-MY', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  )

  const [requests, setRequests] = useState<SessionRequest[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [sessions, setSessions] = useState<DrinkSession[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [paymentsLoading, setPaymentsLoading] = useState(true)

  const [processingId, setProcessingId] = useState<number | null>(null)
  const [processingUserId, setProcessingUserId] = useState<number | null>(null)
  const [processingSessionId, setProcessingSessionId] = useState<number | null>(null)
  const [paymentProcessingId, setPaymentProcessingId] = useState<number | null>(null)

  const [userSearch, setUserSearch] = useState('')
  const [userVisibleCount, setUserVisibleCount] = useState(PAGE_SIZE)
  const [sessionVisibleCount, setSessionVisibleCount] = useState(PAGE_SIZE)
  const [ledgerVisibleCount, setLedgerVisibleCount] = useState(PAGE_SIZE)

  const [error, setError] = useState('')
  const [userError, setUserError] = useState('')
  const [sessionError, setSessionError] = useState('')

  const [editingSession, setEditingSession] = useState<DrinkSession | null>(null)
  const [deletingSession, setDeletingSession] = useState<DrinkSession | null>(null)

  async function loadRequests() {
    try {
      const data = await apiRequest<SessionRequest[]>('/api/session-requests')
      setRequests(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load session requests.')
    } finally {
      setLoading(false)
    }
  }

  async function loadUsers() {
    try {
      setUserError('')
      const data = await apiRequest<ManagedUser[]>('/api/users/admin/all')
      setUsers(data)
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Unable to load users.')
    } finally {
      setLoadingUsers(false)
    }
  }

  async function loadSessions() {
    try {
      setSessionError('')
      const data = await apiRequest<DrinkSession[]>('/api/sessions')
      setSessions(data)
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : 'Unable to load sessions.')
    } finally {
      setLoadingSessions(false)
    }
  }

  async function loadAnalytics() {
    try {
      const data = await apiRequest<AnalyticsResponse>('/api/admin/analytics')
      setAnalytics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load analytics.')
    } finally {
      setAnalyticsLoading(false)
    }
  }

  async function loadPayments() {
    try {
      const data = await apiRequest<Payment[]>('/api/payments/admin/pending')
      setPayments(data.filter((payment) => payment.status === 'PENDING'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load pending payments.')
    } finally {
      setPaymentsLoading(false)
    }
  }

  async function handlePaymentAction(
    paymentId: number,
    action: 'confirm' | 'reject',
  ) {
    setPaymentProcessingId(paymentId)
    setError('')

    try {
      await apiRequest<Payment>(`/api/payments/${paymentId}/${action}`, {
        method: 'PATCH',
      })

      await Promise.all([loadPayments(), loadAnalytics()])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to ${action} payment.`,
      )
    } finally {
      setPaymentProcessingId(null)
    }
  }

  async function loadDashboard() {
    setError('')
    setLoading(true)
    setLoadingUsers(true)
    setLoadingSessions(true)
    setAnalyticsLoading(true)
    setPaymentsLoading(true)

    await Promise.all([
      loadRequests(),
      loadUsers(),
      loadSessions(),
      loadAnalytics(),
      loadPayments(),
    ])
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('en-MY', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      )
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      void loadDashboard()
    }
  }, [user])

  async function handleApprove(requestId: number) {
    setProcessingId(requestId)
    setError('')

    try {
      await apiRequest(`/api/session-requests/${requestId}/approve`, {
        method: 'POST',
      })

      await Promise.all([loadRequests(), loadSessions(), loadAnalytics()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve request.')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(requestId: number) {
    setProcessingId(requestId)
    setError('')

    try {
      await apiRequest(`/api/session-requests/${requestId}/reject`, {
        method: 'POST',
      })

      await Promise.all([loadRequests(), loadAnalytics()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reject request.')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleToggleUser(account: ManagedUser) {
    if (account.id === user?.id) {
      setUserError('You cannot deactivate your own admin account.')
      return
    }

    setProcessingUserId(account.id)
    setUserError('')

    const action = account.is_active ? 'deactivate' : 'activate'

    try {
      const updated = await apiRequest<ManagedUser>(
        `/api/users/admin/${account.id}/${action}`,
        { method: 'PATCH' },
      )

      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
    } catch (err) {
      setUserError(
        err instanceof Error ? err.message : `Unable to ${action} user.`,
      )
    } finally {
      setProcessingUserId(null)
    }
  }

  async function handleDeleteSession(sessionId: number) {
    setProcessingSessionId(sessionId)
    setSessionError('')

    try {
      await apiRequest(`/api/sessions/${sessionId}`, { method: 'DELETE' })

      setSessions((current) =>
        current.filter((session) => session.id !== sessionId),
      )
      setDeletingSession(null)
      await loadAnalytics()
    } catch (err) {
      setSessionError(
        err instanceof Error ? err.message : 'Unable to delete session.',
      )
    } finally {
      setProcessingSessionId(null)
    }
  }

  async function handleSaveSession(updated: DrinkSession) {
    setSessions((current) =>
      current.map((session) => (session.id === updated.id ? updated : session)),
    )
    setEditingSession(null)

    // Reload the actual session records so all packet analytics reflect
    // the saved session values, including edits to older sessions.
    await Promise.all([loadSessions(), loadAnalytics()])
  }

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === 'PENDING'),
    [requests],
  )

  const approvedRequests = useMemo(
    () => requests.filter((request) => request.status === 'APPROVED'),
    [requests],
  )

  const rejectedRequests = useMemo(
    () => requests.filter((request) => request.status === 'REJECTED'),
    [requests],
  )

  const activeUsers = useMemo(
    () => users.filter((account) => account.is_active),
    [users],
  )

  const inactiveUsers = useMemo(
    () => users.filter((account) => !account.is_active),
    [users],
  )

  const normalizedSearch = userSearch.trim().toLowerCase()

  const filteredUsers = useMemo(
    () =>
      normalizedSearch
        ? users.filter((account) =>
            account.name.toLowerCase().includes(normalizedSearch),
          )
        : users,
    [users, normalizedSearch],
  )

  const visibleUsers = filteredUsers.slice(0, userVisibleCount)
  const visibleSessions = sessions.slice(0, sessionVisibleCount)
  const visibleLedgerUsers =
    analytics?.users.slice(0, ledgerVisibleCount) ?? []

  // Packet analytics must come from the actual DrinkSession records.
  // SessionRequest.packets_used can become stale when an existing session
  // is edited, so all three packet values use the current session data.
  const totalConsumedPackets = useMemo(
    () =>
      sessions.reduce(
        (total, session) => total + Number(session.packets_used || 0),
        0,
      ),
    [sessions],
  )

  const totalRequestedPackets = totalConsumedPackets
  const approvedPackets = totalConsumedPackets

  const totalSessionValue = Math.max(
    Number(analytics?.summary.total_session_value ?? 0),
    0,
  )

  const totalConfirmedPayments = Math.max(
    Number(analytics?.summary.total_confirmed_payments ?? 0),
    0,
  )

  const safeOutstanding = Math.max(
    totalSessionValue - totalConfirmedPayments,
    0,
  )

  const collectionRate =
    totalSessionValue > 0
      ? Math.min(
          (totalConfirmedPayments / totalSessionValue) * 100,
          100,
        )
      : 0

  if (user?.role !== 'ADMIN') {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#05070d] px-6 pb-[env(safe-area-inset-bottom)] pt-[max(1.5rem,env(safe-area-inset-top))] text-white">
        <div className="text-center">
          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.3em] text-cyan-300/50">
            Access / denied
          </p>

          <h1 className="text-2xl font-semibold">
            Access denied
          </h1>

          <p className="mt-2 text-sm text-white/40">
            Administrator access is required.
          </p>

          <Link
            to="/dashboard"
            className="mt-6 inline-block rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black"
          >
            Return to dashboard
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main
      className="relative min-h-[100dvh] overflow-x-hidden overflow-y-auto bg-[#05070d] text-white"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Cyber background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(80,220,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(80,220,255,.5) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="absolute left-1/2 top-[-180px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-cyan-400/[0.045] blur-[140px]" />

        <div className="absolute bottom-[-260px] right-[-160px] h-[520px] w-[520px] rounded-full bg-violet-500/[0.035] blur-[150px]" />

        <div className="absolute left-0 right-0 top-[96px] h-px bg-gradient-to-r from-transparent via-cyan-300/10 to-transparent" />
      </div>

      <header
        className="relative z-10 border-b border-cyan-300/[0.08] bg-[#05070d]/90 backdrop-blur-xl"
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 pb-4 sm:px-6 sm:pb-5">
          <Link to="/" className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.035] shadow-[0_0_25px_rgba(34,211,238,0.06)]">
              <span className="font-bold text-cyan-200">
                K
              </span>

              <span className="absolute -right-px -top-px h-2 w-2 rounded-full bg-cyan-300/70 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            </div>

            <div>
              <p className="text-sm font-semibold tracking-tight">
                KoTrack
              </p>

              <p className="font-mono text-[8px] uppercase tracking-[0.24em] text-cyan-300/45">
                Control // Admin
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-300/45">
                {currentTime}
              </p>

              <p className="font-mono text-[8px] text-white/20">
                MY / LOCAL
              </p>
            </div>

            <div className="hidden text-right md:block">
              <p className="text-xs text-white/60">
                {user.name}
              </p>

              <p className="font-mono text-[8px] uppercase tracking-wider text-white/20">
                Master Admin
              </p>
            </div>

            <Link
              to="/dashboard"
              className="rounded-xl border border-cyan-300/[0.10] bg-white/[0.025] px-3 py-2 text-[10px] text-white/55 transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.04] hover:text-cyan-100 sm:px-4 sm:py-2.5 sm:text-xs"
            >
              User View
            </Link>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-10">
        {/* Heading */}
        <section>
          <div className="flex items-center gap-2">
            <span className="h-px w-7 bg-cyan-300/50" />

            <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-cyan-300/55">
              SYS / ADMIN / CORE
            </p>
          </div>

          <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-[2rem] font-semibold leading-none tracking-[-0.035em] sm:text-4xl">
                Command Center
              </h1>

              <p className="mt-2 max-w-2xl text-xs leading-5 text-white/35 sm:text-sm sm:leading-6">
                Real-time system operations, financial intelligence, user
                control and session management.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void loadDashboard()}
                disabled={
                  loading ||
                  loadingUsers ||
                  loadingSessions ||
                  analyticsLoading ||
                  paymentsLoading
                }
                className="rounded-xl border border-cyan-300/[0.10] bg-cyan-300/[0.025] px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-cyan-100/60 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.055] hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading || analyticsLoading
                  ? 'Syncing...'
                  : '↻ Refresh'}
              </button>

              <Link
                to="/admin/sessions/create"
                className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.055] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-100 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.09]"
              >
                + Session
              </Link>
            </div>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-400/15 bg-red-400/[0.055] px-4 py-3 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {/* Top system statistics */}
        <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Users"
            value={
              analyticsLoading
                ? '—'
                : String(analytics?.summary.total_users ?? 0)
            }
            description="Active accounts"
            accent="cyan"
          />

          <StatCard
            label="Sessions"
            value={
              analyticsLoading
                ? '—'
                : String(
                    analytics?.summary.total_sessions ??
                      sessions.length,
                  )
            }
            description="Recorded sessions"
            accent="cyan"
          />

          <StatCard
            label="Pending"
            value={
              analyticsLoading
                ? '—'
                : String(
                    analytics?.summary.pending_session_requests ??
                      pendingRequests.length,
                  )
            }
            description="Requests"
            accent="yellow"
          />

          <StatCard
            label="Payments"
            value={
              analyticsLoading
                ? '—'
                : String(
                    analytics?.summary.pending_payments ??
                      payments.length,
                  )
            }
            description="Pending payments"
            accent="yellow"
          />

          <StatCard
            label="Packets"
            value={
              analyticsLoading
                ? '—'
                : totalConsumedPackets.toFixed(2)
            }
            description="Consumed"
            accent="cyan"
          />

          <StatCard
            label="Collection"
            value={
              analyticsLoading
                ? '—'
                : `${collectionRate.toFixed(1)}%`
            }
            description="Collection rate"
            accent="green"
          />
        </section>

        {/* Financial overview + debt monitor */}
        <section className="mt-5 grid gap-3 lg:grid-cols-3">
          <section className="cyber-panel rounded-2xl border border-cyan-300/[0.08] bg-black/20 p-4 lg:col-span-2 sm:p-5">
            <PanelHeader
              code="FIN-01"
              title="Financial Overview"
              subtitle="SYSTEM-WIDE FINANCIAL STATE"
            />

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Metric
                label="SESSION VALUE"
                value={formatRM(totalSessionValue)}
              />

              <Metric
                label="COLLECTED"
                value={formatRM(totalConfirmedPayments)}
                positive
              />

              <Metric
                label="OUTSTANDING"
                value={formatRM(safeOutstanding)}
                danger
              />
            </div>

            <div className="mt-3">
              <div className="flex justify-between font-mono text-[8px] text-white/25">
                <span>COLLECTION_RATIO</span>
                <span>{collectionRate.toFixed(1)}%</span>
              </div>

              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 shadow-[0_0_10px_rgba(103,232,249,0.5)] transition-all duration-700"
                  style={{
                    width: `${Math.min(collectionRate, 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniMetric
                label="REQUESTED PACKETS"
                value={totalRequestedPackets.toFixed(2)}
              />

              <MiniMetric
                label="APPROVED PACKETS"
                value={approvedPackets.toFixed(2)}
              />
            </div>
          </section>

          <section className="cyber-panel rounded-2xl border border-cyan-300/[0.08] bg-black/20 p-4 sm:p-5">
            <PanelHeader
              code="DEBT-01"
              title="Debt Monitor"
              subtitle="HIGHEST OUTSTANDING BALANCES"
            />

            {analyticsLoading ? (
              <LoadingBox text="Loading debt data..." />
            ) : (analytics?.highest_debt_users ?? []).length === 0 ? (
              <EmptyBox
                title="No outstanding debt recorded."
                description=""
              />
            ) : (
              <div className="mt-3 space-y-1.5">
                {(analytics?.highest_debt_users ?? [])
                  .slice(0, 5)
                  .map((person, index) => (
                    <div
                      key={person.user_id}
                      className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-2"
                    >
                      <span className="font-mono text-[8px] text-cyan-300/40">
                        0{index + 1}
                      </span>

                      <span className="min-w-0 flex-1 truncate text-[9px] text-white/55">
                        {person.name}
                      </span>

                      <span className="font-mono text-[9px] font-semibold text-red-300/80">
                        {formatRM(person.balance)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </section>
        </section>

        {/* Pending payment approvals */}
        <section className="cyber-panel mt-5 rounded-2xl border border-cyan-300/[0.08] bg-black/20 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <PanelHeader
              code="PAYMENT-01"
              title="Pending Payment Approvals"
              subtitle="PAYMENT QUEUE / CONFIRM OR REJECT"
            />

            <span className="rounded-full border border-yellow-400/10 bg-yellow-400/[0.055] px-2.5 py-1 font-mono text-[8px] text-yellow-300">
              {payments.length} pending
            </span>
          </div>

          {paymentsLoading ? (
            <LoadingBox text="Loading pending payments..." />
          ) : payments.length === 0 ? (
            <EmptyBox
              title="No pending payments."
              description="All submitted payments have been reviewed."
            />
          ) : (
            <div className="mt-4 space-y-2">
              {payments.map((payment) => {
                const processing =
                  paymentProcessingId === payment.id

                return (
                  <div
                    key={payment.id}
                    className="rounded-xl border border-white/[0.055] bg-black/15 p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[9px] text-cyan-300/55">
                            PAYMENT-
                            {String(payment.id).padStart(4, '0')}
                          </span>

                          <span className="rounded-full border border-yellow-400/10 bg-yellow-400/[0.055] px-2 py-0.5 font-mono text-[8px] text-yellow-300">
                            PENDING
                          </span>
                        </div>

                        <p className="mt-1 text-[10px] text-white/35">
                          User #{payment.user_id}
                          {' · '}
                          {formatDateTime(payment.created_at)}
                        </p>

                        <p className="mt-1 text-base font-semibold text-white/80">
                          {formatRM(Number(payment.amount))}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:w-[210px]">
                        <button
                          type="button"
                          disabled={processing}
                          onClick={() =>
                            void handlePaymentAction(
                              payment.id,
                              'reject',
                            )
                          }
                          className="rounded-xl border border-red-400/10 bg-red-400/[0.035] px-3 py-2.5 text-[10px] font-medium text-red-300 transition hover:border-red-300/20 hover:bg-red-400/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {processing ? '...' : 'Reject'}
                        </button>

                        <button
                          type="button"
                          disabled={processing}
                          onClick={() =>
                            void handlePaymentAction(
                              payment.id,
                              'confirm',
                            )
                          }
                          className="rounded-xl border border-cyan-200/20 bg-cyan-100 px-3 py-2.5 text-[10px] font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {processing
                            ? '...'
                            : 'Confirm payment'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Individual debt ledger */}
        <section className="cyber-panel mt-5 rounded-2xl border border-cyan-300/[0.08] bg-black/20 p-4 sm:p-5">
          <PanelHeader
            code="DEBT-02"
            title="Individual Debt Ledger"
            subtitle="USER BALANCES / CONFIRMED PAYMENTS / OUTSTANDING"
          />

          {analyticsLoading ? (
            <LoadingBox text="Loading user balances..." />
          ) : (analytics?.users ?? []).length === 0 ? (
            <EmptyBox
              title="No user balance data found."
              description=""
            />
          ) : (
            <>
              {/* Mobile ledger */}
              <div className="mt-3 grid gap-2 md:hidden">
                {visibleLedgerUsers.map((person) => (
                  <div
                    key={person.user_id}
                    className="rounded-xl border border-white/[0.05] bg-black/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-white/70">
                          {person.name}
                        </p>

                        <p className="font-mono text-[8px] text-white/20">
                          NODE-
                          {String(person.user_id).padStart(
                            4,
                            '0',
                          )}
                        </p>
                      </div>

                      <span
                        className={`font-mono text-[10px] font-semibold ${
                          person.balance > 0
                            ? 'text-red-300/80'
                            : 'text-emerald-300/80'
                        }`}
                      >
                        {formatRM(person.balance)}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <MiniMetric
                        label="OWED"
                        value={formatRM(person.total_owed)}
                      />

                      <MiniMetric
                        label="PAID"
                        value={formatRM(person.total_paid)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop ledger */}
              <div className="mt-3 hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-left">
                      <th className="px-3 py-2 font-mono text-[8px] uppercase tracking-wider text-white/25">
                        User
                      </th>

                      <th className="px-3 py-2 text-right font-mono text-[8px] uppercase tracking-wider text-white/25">
                        Owed
                      </th>

                      <th className="px-3 py-2 text-right font-mono text-[8px] uppercase tracking-wider text-white/25">
                        Paid
                      </th>

                      <th className="px-3 py-2 text-right font-mono text-[8px] uppercase tracking-wider text-white/25">
                        Outstanding
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleLedgerUsers.map((person) => (
                      <tr
                        key={person.user_id}
                        className="border-b border-white/[0.04] hover:bg-cyan-300/[0.015]"
                      >
                        <td className="px-3 py-3">
                          <span className="text-xs text-white/65">
                            {person.name}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-right text-xs text-white/45">
                          {formatRM(person.total_owed)}
                        </td>

                        <td className="px-3 py-3 text-right text-xs text-emerald-300/65">
                          {formatRM(person.total_paid)}
                        </td>

                        <td className="px-3 py-3 text-right text-xs font-semibold text-red-300/80">
                          {formatRM(person.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {analytics &&
                analytics.users.length > ledgerVisibleCount && (
                  <LoadMoreButton
                    shown={visibleLedgerUsers.length}
                    total={analytics.users.length}
                    onClick={() =>
                      setLedgerVisibleCount(
                        (count) => count + PAGE_SIZE,
                      )
                    }
                  />
                )}
            </>
          )}
        </section>

        {/* Highest spenders */}
        <section className="cyber-panel mt-5 rounded-2xl border border-cyan-300/[0.08] bg-black/20 p-4 sm:p-5">
          <PanelHeader
            code="USAGE-01"
            title="Highest Spending Users"
            subtitle="ACCUMULATED SESSION COST"
          />

          {analyticsLoading ? (
            <LoadingBox text="Loading spending data..." />
          ) : (analytics?.highest_spenders ?? []).length === 0 ? (
            <EmptyBox
              title="No spending data available."
              description=""
            />
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {(analytics?.highest_spenders ?? [])
                .slice(0, 5)
                .map((person, index) => (
                  <div
                    key={person.user_id}
                    className="rounded-xl border border-white/[0.05] bg-black/20 p-3 transition hover:border-cyan-300/[0.12]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] text-cyan-300/50">
                        #{index + 1}
                      </span>

                      <span className="font-mono text-[8px] text-white/20">
                        NODE-
                        {String(person.user_id).padStart(
                          4,
                          '0',
                        )}
                      </span>
                    </div>

                    <p className="mt-2 truncate text-xs text-white/60">
                      {person.name}
                    </p>

                    <p className="mt-1 text-base font-semibold">
                      {formatRM(person.total_spent)}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* User management */}
        <section className="cyber-panel mt-5 rounded-2xl border border-cyan-300/[0.08] bg-black/20 p-4 sm:p-5">
          <PanelHeader
            code="USER-01"
            title="User Management"
            subtitle="ACCOUNT DIRECTORY / ACCESS CONTROL"
          />

          {userError && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-400/10 bg-red-400/[0.06] px-3 py-2.5 text-xs text-red-300"
            >
              {userError}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="search"
              value={userSearch}
              onChange={(event) => {
                setUserSearch(event.target.value)
                setUserVisibleCount(PAGE_SIZE)
              }}
              placeholder="Search users..."
              className="w-full rounded-xl border border-cyan-300/[0.08] bg-black/30 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-cyan-300/25 sm:max-w-sm"
            />

            <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/25">
              {activeUsers.length} active
              <span className="mx-2 text-cyan-300/20">
                /
              </span>
              {inactiveUsers.length} inactive
            </div>
          </div>

          {loadingUsers ? (
            <LoadingBox text="Loading user directory..." />
          ) : filteredUsers.length === 0 ? (
            <EmptyBox
              title="No users found."
              description=""
            />
          ) : (
            <>
              <div className="mt-4 space-y-2">
                {visibleUsers.map((account) => {
                  const isCurrentAdmin =
                    account.id === user.id
                  const processing =
                    processingUserId === account.id

                  return (
                    <div
                      key={account.id}
                      className="group flex items-center gap-3 rounded-xl border border-white/[0.055] bg-black/15 p-3 transition hover:border-cyan-300/[0.12] hover:bg-cyan-300/[0.018]"
                    >
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-cyan-300/[0.10] bg-white/[0.035]">
                        {account.avatar_data ? (
                          <img
                            src={account.avatar_data}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-cyan-100/45">
                            {account.name
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">
                            {account.name}
                          </p>

                          {account.role === 'ADMIN' && (
                            <span className="rounded-full border border-cyan-300/10 bg-cyan-300/[0.045] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-cyan-200/70">
                              Admin
                            </span>
                          )}
                        </div>

                        <p className="mt-0.5 font-mono text-[8px] text-white/22">
                          NODE-
                          {String(account.id).padStart(4, '0')}
                        </p>
                      </div>

                      <span
                        className={
                          account.is_active
                            ? 'hidden rounded-full border border-emerald-400/10 bg-emerald-400/[0.045] px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-emerald-300 sm:inline-flex'
                            : 'hidden rounded-full border border-red-400/10 bg-red-400/[0.045] px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-red-300 sm:inline-flex'
                        }
                      >
                        {account.is_active
                          ? 'Active'
                          : 'Inactive'}
                      </span>

                      <button
                        type="button"
                        disabled={
                          processing || isCurrentAdmin
                        }
                        onClick={() =>
                          void handleToggleUser(account)
                        }
                        title={
                          isCurrentAdmin
                            ? 'You cannot deactivate your own admin account'
                            : undefined
                        }
                        className={
                          account.is_active
                            ? 'rounded-lg border border-red-400/10 bg-red-400/[0.035] px-3 py-2 text-[10px] font-medium text-red-300 transition hover:border-red-300/20 hover:bg-red-400/[0.07] disabled:cursor-not-allowed disabled:opacity-30'
                            : 'rounded-lg border border-emerald-400/10 bg-emerald-400/[0.035] px-3 py-2 text-[10px] font-medium text-emerald-300 transition hover:border-emerald-300/20 hover:bg-emerald-400/[0.07] disabled:cursor-not-allowed disabled:opacity-30'
                        }
                      >
                        {processing
                          ? '...'
                          : account.is_active
                            ? 'Deactivate'
                            : 'Activate'}
                      </button>
                    </div>
                  )
                })}
              </div>

              {filteredUsers.length > userVisibleCount && (
                <LoadMoreButton
                  shown={visibleUsers.length}
                  total={filteredUsers.length}
                  onClick={() =>
                    setUserVisibleCount(
                      (count) => count + PAGE_SIZE,
                    )
                  }
                />
              )}
            </>
          )}
        </section>

        {/* Session management */}
        <section className="cyber-panel mt-5 rounded-2xl border border-cyan-300/[0.08] bg-black/20 p-4 sm:p-5">
          <PanelHeader
            code="SESSION-01"
            title="Drink Sessions"
            subtitle="SESSION CONTROL / EDIT / DELETE"
          />

          {sessionError && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-400/10 bg-red-400/[0.06] px-3 py-2.5 text-xs text-red-300"
            >
              {sessionError}
            </div>
          )}

          {loadingSessions ? (
            <LoadingBox text="Loading session records..." />
          ) : sessions.length === 0 ? (
            <EmptyBox
              title="No drink sessions found."
              description=""
            />
          ) : (
            <>
              <div className="mt-4 space-y-2">
                {visibleSessions.map((session) => (
                  <SessionAdminRow
                    key={session.id}
                    session={session}
                    processing={
                      processingSessionId === session.id
                    }
                    onEdit={() =>
                      setEditingSession(session)
                    }
                    onDelete={() =>
                      setDeletingSession(session)
                    }
                  />
                ))}
              </div>

              {sessions.length > sessionVisibleCount && (
                <LoadMoreButton
                  shown={visibleSessions.length}
                  total={sessions.length}
                  onClick={() =>
                    setSessionVisibleCount(
                      (count) => count + PAGE_SIZE,
                    )
                  }
                />
              )}
            </>
          )}
        </section>

        {/* Pending requests */}
        <section className="cyber-panel mt-5 rounded-2xl border border-cyan-300/[0.08] bg-black/20 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <PanelHeader
              code="REQUEST-01"
              title="Pending Session Requests"
              subtitle="REQUEST QUEUE / APPROVAL"
            />

            <span className="rounded-full border border-yellow-400/10 bg-yellow-400/[0.055] px-2.5 py-1 font-mono text-[8px] text-yellow-300">
              {pendingRequests.length} pending
            </span>
          </div>

          {loading ? (
            <LoadingBox text="Loading requests..." />
          ) : pendingRequests.length === 0 ? (
            <EmptyBox
              title="No pending session requests."
              description=""
            />
          ) : (
            <div className="mt-4 space-y-3">
              {pendingRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  processing={
                    processingId === request.id
                  }
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </div>
          )}
        </section>

        {/* Create session */}
        <section className="cyber-panel mt-5 rounded-2xl border border-cyan-300/[0.08] bg-black/20 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <PanelHeader
              code="SESSION-02"
              title="Create a Session"
              subtitle="ADMIN SESSION PROVISIONING"
            />

            <Link
              to="/admin/sessions/create"
              className="inline-flex justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.055] px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-cyan-100 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.09]"
            >
              + Create session
            </Link>
          </div>
        </section>

        {/* Request history */}
        <section className="cyber-panel mt-5 rounded-2xl border border-cyan-300/[0.08] bg-black/20 p-4 sm:p-5">
          <PanelHeader
            code="AUDIT-01"
            title="Recent Requests"
            subtitle="REQUEST HISTORY / AUDIT TRAIL"
          />

          {loading ? (
            <LoadingBox text="Loading history..." />
          ) : requests.length === 0 ? (
            <EmptyBox
              title="No session requests yet."
              description=""
            />
          ) : (
            <div className="mt-4 space-y-2">
              {requests.slice(0, 10).map((request) => (
                <HistoryRow
                  key={request.id}
                  request={request}
                />
              ))}
            </div>
          )}
        </section>

        {/* System status */}
        <section className="cyber-panel mt-5 rounded-2xl border border-cyan-300/[0.08] bg-black/20 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <SystemStatus
              label="USER DIRECTORY"
              value={`${users.length} records`}
            />

            <SystemStatus
              label="SESSION ENGINE"
              value={`${sessions.length} records`}
            />

            <SystemStatus
              label="REQUEST ENGINE"
              value={`${approvedRequests.length} approved / ${rejectedRequests.length} rejected`}
            />
          </div>
        </section>

        <p className="mt-7 pb-4 text-center font-mono text-[8px] uppercase tracking-[0.2em] text-white/15">
          KoTrack // Administration System // Secure Control Layer
        </p>
      </div>

      {editingSession && (
        <EditSessionModal
          session={editingSession}
          users={users}
          onClose={() => setEditingSession(null)}
          onSaved={(updated) =>
            void handleSaveSession(updated)
          }
        />
      )}

      {deletingSession && (
        <DeleteSessionModal
          session={deletingSession}
          deleting={
            processingSessionId === deletingSession.id
          }
          onClose={() => setDeletingSession(null)}
          onConfirm={() =>
            void handleDeleteSession(
              deletingSession.id,
            )
          }
        />
      )}
    </main>
  )
}

function PanelHeader({
  code,
  title,
  subtitle,
}: {
  code: string
  title: string
  subtitle: string
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="h-px w-5 bg-cyan-300/35" />

        <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-cyan-300/45">
          {code}
        </p>
      </div>

      <h2 className="mt-1.5 text-base font-semibold">
        {title}
      </h2>

      <p className="mt-0.5 font-mono text-[7px] uppercase tracking-[0.16em] text-white/20">
        {subtitle}
      </p>
    </div>
  )
}

function StatCard({
  label,
  value,
  description,
  accent,
}: {
  label: string
  value: string
  description: string
  accent: 'cyan' | 'yellow' | 'green' | 'red'
}) {
  const accentClass = {
    cyan: 'border-cyan-300/[0.10] text-cyan-200/70',
    yellow: 'border-yellow-300/[0.10] text-yellow-200/70',
    green: 'border-emerald-300/[0.10] text-emerald-200/70',
    red: 'border-red-300/[0.10] text-red-200/70',
  }[accent]

  return (
    <div
      className={`rounded-xl border bg-white/[0.018] p-3 sm:rounded-2xl sm:p-4 ${accentClass}`}
    >
      <div className="flex items-center justify-between">
        <p className="font-mono text-[8px] uppercase tracking-[0.16em] opacity-60">
          {label}
        </p>

        <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
      </div>

      <p className="mt-1.5 text-lg font-semibold text-white sm:mt-2 sm:text-2xl">
        {value}
      </p>

      <p className="mt-0.5 text-[9px] text-white/25">
        {description}
      </p>
    </div>
  )
}

function Metric({
  label,
  value,
  positive = false,
  danger = false,
}: {
  label: string
  value: string
  positive?: boolean
  danger?: boolean
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-black/25 p-3">
      <p className="font-mono text-[8px] uppercase tracking-wider text-white/20">
        {label}
      </p>

      <p
        className={`mt-1.5 text-base font-semibold ${
          positive
            ? 'text-emerald-300/85'
            : danger
              ? 'text-red-300/85'
              : 'text-white/75'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function MiniMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-white/[0.015] p-2.5">
      <p className="font-mono text-[7px] uppercase tracking-wider text-white/20">
        {label}
      </p>

      <p className="mt-1 text-xs font-semibold text-white/60">
        {value}
      </p>
    </div>
  )
}

function SystemStatus({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-cyan-300/[0.06] bg-cyan-300/[0.012] p-3">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]" />

        <p className="font-mono text-[7px] uppercase tracking-wider text-cyan-300/40">
          {label}
        </p>
      </div>

      <p className="mt-1.5 text-[10px] text-white/40">
        {value}
      </p>
    </div>
  )
}

function SessionAdminRow({
  session,
  processing,
  onEdit,
  onDelete,
}: {
  session: DrinkSession
  processing: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const participantCount = session.participants.length

  return (
    <div className="rounded-xl border border-white/[0.055] bg-black/15 p-3 transition hover:border-cyan-300/[0.12]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[9px] text-cyan-300/55">
              SESSION-
              {String(session.id).padStart(4, '0')}
            </span>

            <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-0.5 text-[8px] text-white/35">
              {participantCount}{' '}
              {participantCount === 1
                ? 'person'
                : 'people'}
            </span>
          </div>

          <p className="mt-1 text-[10px] text-white/35">
            {formatDate(session.session_date)}
            {' · '}
            {session.packets_used} packets
            {' · '}
            {formatRM(Number(session.total_cost))}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {session.participants
              .slice(0, 5)
              .map((participant) => (
                <span
                  key={`${session.id}-${participant.user_id}`}
                  className="rounded-lg border border-white/[0.055] bg-white/[0.02] px-2 py-1 text-[8px] text-white/40"
                >
                  {participant.user_name}
                </span>
              ))}

            {participantCount > 5 && (
              <span className="rounded-lg border border-cyan-300/[0.08] bg-cyan-300/[0.025] px-2 py-1 text-[8px] text-cyan-200/45">
                +{participantCount - 5}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:w-[170px]">
          <button
            type="button"
            disabled={processing}
            onClick={onEdit}
            className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.035] px-3 py-2.5 text-[10px] font-medium text-cyan-100/70 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.07] disabled:cursor-not-allowed disabled:opacity-30"
          >
            Edit
          </button>

          <button
            type="button"
            disabled={processing}
            onClick={onDelete}
            className="rounded-xl border border-red-400/10 bg-red-400/[0.035] px-3 py-2.5 text-[10px] font-medium text-red-300/80 transition hover:border-red-300/20 hover:bg-red-400/[0.07] disabled:cursor-not-allowed disabled:opacity-30"
          >
            {processing ? '...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditSessionModal({
  session,
  users,
  onClose,
  onSaved,
}: {
  session: DrinkSession
  users: ManagedUser[]
  onClose: () => void
  onSaved: (session: DrinkSession) => void
}) {
  const [sessionDate, setSessionDate] = useState(
    session.session_date,
  )

  const [packets, setPackets] = useState(
    String(session.packets_used),
  )

  const [price, setPrice] = useState(
    String(session.price_per_packet),
  )

  const [participants, setParticipants] = useState<
    number[]
  >(
    session.participants.map(
      (item) => item.user_id,
    ),
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleParticipant(id: number) {
    setParticipants((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    )
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (participants.length === 0) {
      setError('Select at least one participant.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const updated = await apiRequest<DrinkSession>(
        `/api/sessions/${session.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            session_date: sessionDate,
            packets_used: Number(packets),
            participant_user_ids: participants,
            price_per_packet: Number(price),
          }),
        },
      )

      onSaved(updated)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update session.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-cyan-300/[0.12] bg-[#080b13] p-4 shadow-[0_0_80px_rgba(34,211,238,0.07)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[8px] uppercase tracking-[0.24em] text-cyan-300/55">
              Session // Modify
            </p>

            <h3 className="mt-2 text-xl font-semibold">
              Edit session
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-9 min-w-9 rounded-lg px-2 py-1 text-lg text-white/30 hover:bg-white/[0.05] hover:text-white"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-400/10 bg-red-400/[0.05] px-4 py-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <form
          onSubmit={submit}
          className="mt-5 space-y-4"
        >
          <label className="block">
            <span className="mb-2 block font-mono text-[9px] uppercase tracking-wider text-white/35">
              Session date
            </span>

            <input
              type="date"
              value={sessionDate}
              onChange={(event) =>
                setSessionDate(event.target.value)
              }
              required
              disabled={saving}
              className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/25 disabled:opacity-50"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-2 block font-mono text-[9px] uppercase tracking-wider text-white/35">
                Packets
              </span>

              <input
                type="number"
                min="0.001"
                step="0.001"
                value={packets}
                onChange={(event) =>
                  setPackets(event.target.value)
                }
                required
                disabled={saving}
                className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/25 disabled:opacity-50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block font-mono text-[9px] uppercase tracking-wider text-white/35">
                RM / packet
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(event) =>
                  setPrice(event.target.value)
                }
                required
                disabled={saving}
                className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/25 disabled:opacity-50"
              />
            </label>
          </div>

          <div>
            <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-white/35">
              Participants
            </p>

            <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-white/[0.07] bg-black/20 p-2">
              {users
                .filter(
                  (account) => account.is_active,
                )
                .map((account) => {
                  const checked =
                    participants.includes(account.id)

                  return (
                    <label
                      key={account.id}
                      className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-xs text-white/60 hover:bg-cyan-300/[0.025]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={saving}
                        onChange={() =>
                          toggleParticipant(
                            account.id,
                          )
                        }
                        className="h-4 w-4 accent-cyan-300"
                      />

                      <span className="truncate">
                        {account.name}
                      </span>
                    </label>
                  )
                })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="min-h-11 rounded-xl border border-white/10 px-4 py-2.5 text-xs text-white/50 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving || participants.length === 0
              }
              className="min-h-11 rounded-xl border border-cyan-200/20 bg-cyan-100 px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving
                ? 'Saving...'
                : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteSessionModal({
  session,
  deleting,
  onClose,
  onConfirm,
}: {
  session: DrinkSession
  deleting: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-4">
      <div className="w-full max-w-md rounded-3xl border border-red-300/[0.12] bg-[#080b13] p-4 shadow-[0_0_80px_rgba(248,113,113,0.06)] sm:p-6">
        <p className="font-mono text-[8px] uppercase tracking-[0.24em] text-red-300/55">
          Session // Destructive action
        </p>

        <h3 className="mt-2 text-xl font-semibold">
          Delete session?
        </h3>

        <p className="mt-3 text-sm leading-6 text-white/35">
          SESSION-
          {String(session.id).padStart(4, '0')} and its
          participant cost records will be permanently
          removed. This cannot be undone.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="min-h-11 rounded-xl border border-white/10 px-4 py-2.5 text-xs text-white/50 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="min-h-11 rounded-xl bg-red-400 px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-red-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting
              ? 'Deleting...'
              : 'Delete session'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RequestCard({
  request,
  processing,
  onApprove,
  onReject,
}: {
  request: SessionRequest
  processing: boolean
  onApprove: (id: number) => void
  onReject: (id: number) => void
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/10 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-yellow-300/10 bg-yellow-300/[0.035] text-xs font-semibold text-yellow-100/60">
              {request.participants[0]?.user_name
                ?.charAt(0)
                .toUpperCase() ?? '?'}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">
                  Request #{request.id}
                </h3>

                <span className="rounded-full border border-yellow-400/10 bg-yellow-400/[0.06] px-2 py-0.5 font-mono text-[8px] text-yellow-300">
                  PENDING
                </span>
              </div>

              <p className="mt-1 font-mono text-[9px] text-white/30">
                Requested by user #
                {request.requested_by}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <Detail
              label="Date"
              value={formatDate(
                request.session_date,
              )}
            />

            <Detail
              label="Packets"
              value={String(
                request.packets_used,
              )}
            />

            <Detail
              label="People"
              value={String(
                request.participants.length,
              )}
            />
          </div>

          <div className="mt-3">
            <p className="font-mono text-[8px] uppercase tracking-wider text-white/20">
              Participants
            </p>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {request.participants.map(
                (participant) => (
                  <span
                    key={`${request.id}-${participant.user_id}`}
                    className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[9px] text-white/45"
                  >
                    {participant.user_name}
                  </span>
                ),
              )}
            </div>
          </div>

          {request.note && (
            <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="font-mono text-[8px] uppercase tracking-wider text-white/20">
                Note
              </p>

              <p className="mt-1 text-[11px] leading-5 text-white/35">
                {request.note}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 lg:w-[120px] lg:grid-cols-1">
          <button
            type="button"
            disabled={processing}
            onClick={() =>
              onReject(request.id)
            }
            className="rounded-xl border border-red-400/10 bg-red-400/[0.04] px-3 py-2.5 text-[10px] font-medium text-red-300 transition hover:bg-red-400/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {processing ? '...' : 'Reject'}
          </button>

          <button
            type="button"
            disabled={processing}
            onClick={() =>
              onApprove(request.id)
            }
            className="rounded-xl border border-cyan-200/20 bg-cyan-100 px-3 py-2.5 text-[10px] font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {processing ? '...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HistoryRow({
  request,
}: {
  request: SessionRequest
}) {
  const statusClass =
    request.status === 'APPROVED'
      ? 'border-emerald-400/10 bg-emerald-400/[0.06] text-emerald-300'
      : request.status === 'REJECTED'
        ? 'border-red-400/10 bg-red-400/[0.06] text-red-300'
        : 'border-yellow-400/10 bg-yellow-400/[0.06] text-yellow-300'

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/10 p-3">
      <div className="min-w-0">
        <p className="text-xs font-medium">
          Request #{request.id}
        </p>

        <p className="mt-1 truncate font-mono text-[9px] text-white/25">
          User #{request.requested_by}
          {' · '}
          {formatDate(request.session_date)}
          {' · '}
          {request.participants.length} participants
        </p>
      </div>

      <span
        className={`shrink-0 rounded-full border px-2 py-1 font-mono text-[8px] ${statusClass}`}
      >
        {request.status}
      </span>
    </div>
  )
}

function Detail({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
      <p className="font-mono text-[8px] uppercase tracking-wider text-white/20">
        {label}
      </p>

      <p className="mt-1.5 truncate text-[11px] font-medium text-white/55">
        {value}
      </p>
    </div>
  )
}

function LoadingBox({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/10 p-6 text-center text-xs text-white/30">
      <span className="mr-2 text-cyan-300/50">
        ●
      </span>

      {text}
    </div>
  )
}

function EmptyBox({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-white/[0.07] bg-black/10 p-6 text-center">
      <p className="text-xs text-white/30">
        {title}
      </p>

      {description && (
        <p className="mt-1 text-[10px] text-white/20">
          {description}
        </p>
      )}
    </div>
  )
}

function LoadMoreButton({
  shown,
  total,
  onClick,
}: {
  shown: number
  total: number
  onClick: () => void
}) {
  const remaining = total - shown

  return (
    <div className="mt-4 flex justify-center">
      <button
        type="button"
        onClick={onClick}
        className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.025] px-5 py-2.5 font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-cyan-100/60 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.055] hover:text-cyan-100"
      >
        Load more

        <span className="ml-2 text-cyan-300/35">
          +{Math.min(PAGE_SIZE, remaining)}
        </span>
      </button>
    </div>
  )
}

function formatRM(value: number) {
  return `RM ${Number(value || 0).toLocaleString(
    'en-MY',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )}`
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}