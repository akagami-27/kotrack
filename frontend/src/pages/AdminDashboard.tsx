import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiRequest } from '../api/client'
import { useAuth } from '../auth/AuthContext'


// ============================================================================
// TYPES
// ============================================================================

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

type Payment = {
  id: number
  user_id: number
  amount: number | string
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | string
  created_at: string
  confirmed_at: string | null
  confirmed_by: number | null
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


// ============================================================================
// CONSTANTS
// ============================================================================

const USERS_PER_PAGE = 8
const HISTORY_PER_PAGE = 8


// ============================================================================
// PAGE
// ============================================================================

export default function AdminDashboard() {
  const { user } = useAuth()

  const [requests, setRequests] =
    useState<SessionRequest[]>([])

  const [analytics, setAnalytics] =
    useState<AnalyticsResponse | null>(null)

  const [payments, setPayments] =
    useState<Payment[]>([])

  const [paymentsLoading, setPaymentsLoading] =
    useState(true)

  const [paymentProcessingId, setPaymentProcessingId] =
    useState<number | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [analyticsLoading, setAnalyticsLoading] =
    useState(true)

  const [processingId, setProcessingId] =
    useState<number | null>(null)

  const [error, setError] =
    useState('')

  const [userPage, setUserPage] =
    useState(1)

  const [historyPage, setHistoryPage] =
    useState(1)


  // --------------------------------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------------------------------

  async function loadRequests() {
    const data =
      await apiRequest<SessionRequest[]>(
        '/api/session-requests',
      )

    setRequests(data)
  }


  async function loadAnalytics() {
    const data =
      await apiRequest<AnalyticsResponse>(
        '/api/admin/analytics',
      )

    setAnalytics(data)
  }


  async function loadPayments() {
    const data =
      await apiRequest<Payment[]>(
        '/api/payments',
      )

    setPayments(data)
  }


  async function loadDashboard() {
    setError('')
    setLoading(true)
    setAnalyticsLoading(true)
    setPaymentsLoading(true)

    try {
      await Promise.all([
        loadRequests(),
        loadAnalytics(),
        loadPayments(),
      ])

      setUserPage(1)
      setHistoryPage(1)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load admin dashboard.',
      )
    } finally {
      setLoading(false)
      setAnalyticsLoading(false)
      setPaymentsLoading(false)
    }
  }


  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadDashboard()
    }
  }, [user])


  // --------------------------------------------------------------------------
  // REQUEST ACTIONS
  // --------------------------------------------------------------------------

  async function handleApprove(
    requestId: number,
  ) {
    setProcessingId(requestId)
    setError('')

    try {
      await apiRequest(
        `/api/session-requests/${requestId}/approve`,
        {
          method: 'POST',
        },
      )

      await loadDashboard()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to approve request.',
      )
    } finally {
      setProcessingId(null)
    }
  }


  async function handleReject(
    requestId: number,
  ) {
    setProcessingId(requestId)
    setError('')

    try {
      await apiRequest(
        `/api/session-requests/${requestId}/reject`,
        {
          method: 'POST',
        },
      )

      await loadDashboard()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reject request.',
      )
    } finally {
      setProcessingId(null)
    }
  }


  // --------------------------------------------------------------------------
  // PAYMENT ACTIONS
  // --------------------------------------------------------------------------

  async function handlePaymentAction(
    paymentId: number,
    action: 'confirm' | 'reject',
  ) {
    setPaymentProcessingId(paymentId)
    setError('')

    try {
      await apiRequest(
        `/api/payments/${paymentId}/${action}`,
        {
          method: 'PATCH',
        },
      )

      await loadDashboard()
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


  // --------------------------------------------------------------------------
  // REQUEST ANALYTICS
  // --------------------------------------------------------------------------

  const pendingRequests =
    useMemo(
      () =>
        requests.filter(
          (request) =>
            request.status === 'PENDING',
        ),
      [requests],
    )


  const pendingPayments =
    useMemo(
      () =>
        payments.filter(
          (payment) =>
            payment.status === 'PENDING',
        ),
      [payments],
    )


  const approvedRequests =
    useMemo(
      () =>
        requests.filter(
          (request) =>
            request.status === 'APPROVED',
        ),
      [requests],
    )


  const totalRequestedPackets =
    useMemo(
      () =>
        requests.reduce(
          (total, request) =>
            total +
            Number(
              request.packets_used || 0,
            ),
          0,
        ),
      [requests],
    )


  const approvedPackets =
    useMemo(
      () =>
        approvedRequests.reduce(
          (total, request) =>
            total +
            Number(
              request.packets_used || 0,
            ),
          0,
        ),
      [approvedRequests],
    )


  // --------------------------------------------------------------------------
  // PAGINATION
  // --------------------------------------------------------------------------

  const visibleUsers =
    useMemo(() => {
      const end =
        userPage * USERS_PER_PAGE

      return (
        analytics?.users.slice(
          0,
          end,
        ) ?? []
      )
    }, [
      analytics,
      userPage,
    ])


  const hasMoreUsers =
    Boolean(
      analytics &&
      visibleUsers.length <
        analytics.users.length,
    )


  const visibleHistory =
    useMemo(() => {
      const end =
        historyPage *
        HISTORY_PER_PAGE

      return requests.slice(
        0,
        end,
      )
    }, [
      requests,
      historyPage,
    ])


  const hasMoreHistory =
    visibleHistory.length <
    requests.length


  // --------------------------------------------------------------------------
  // ACCESS DENIED
  // --------------------------------------------------------------------------

  if (user?.role !== 'ADMIN') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#05060a] px-6 text-white">

        <div className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-white/[0.035] p-8 text-center shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl">

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/10 bg-red-400/[0.06]">
            <span className="text-xl text-red-300">
              !
            </span>
          </div>

          <h1 className="mt-5 text-2xl font-semibold">
            Access denied
          </h1>

          <p className="mt-2 text-sm leading-6 text-white/40">
            Administrator access is required to view this dashboard.
          </p>

          <Link
            to="/dashboard"
            className="mt-7 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Return to dashboard
          </Link>

        </div>

      </main>
    )
  }


  // --------------------------------------------------------------------------
  // MAIN DASHBOARD
  // --------------------------------------------------------------------------

  return (
    <main className="min-h-screen overflow-hidden bg-[#05060a] text-white">

      {/* ================================================================== */}
      {/* FUTURISTIC BACKGROUND                                              */}
      {/* ================================================================== */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">

        <div className="absolute left-1/2 top-[-300px] h-[650px] w-[650px] -translate-x-1/2 rounded-full bg-violet-500/[0.07] blur-[160px]" />

        <div className="absolute right-[-250px] top-[25%] h-[500px] w-[500px] rounded-full bg-blue-500/[0.05] blur-[150px]" />

        <div className="absolute bottom-[-300px] left-[-200px] h-[550px] w-[550px] rounded-full bg-cyan-500/[0.04] blur-[160px]" />

      </div>


      {/* ================================================================== */}
      {/* HEADER                                                             */}
      {/* ================================================================== */}

      <header className="relative z-10 border-b border-white/[0.06] bg-black/20 backdrop-blur-xl">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">

          <Link
            to="/"
            className="flex items-center gap-3"
          >

            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <span className="font-bold">
                K
              </span>
            </div>

            <div>
              <p className="text-sm font-semibold">
                KoTrack
              </p>

              <p className="text-[9px] uppercase tracking-[0.2em] text-violet-300/50">
                Command Center
              </p>
            </div>

          </Link>


          <div className="flex items-center gap-2 sm:gap-3">

            <div className="hidden text-right sm:block">
              <p className="text-xs text-white/60">
                {user.name}
              </p>

              <p className="text-[10px] uppercase tracking-wider text-white/25">
                Master Admin
              </p>
            </div>

            <Link
              to="/dashboard"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] text-white/60 transition hover:bg-white/[0.06] hover:text-white sm:px-4 sm:text-xs"
            >
              User Dashboard
            </Link>

          </div>

        </div>

      </header>


      {/* ================================================================== */}
      {/* CONTENT                                                            */}
      {/* ================================================================== */}

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">

        {/* ---------------------------------------------------------------- */}
        {/* TITLE                                                             */}
        {/* ---------------------------------------------------------------- */}

        <section>

          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">

            <div>

              <div className="flex items-center gap-2">

                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />

                <p className="text-[9px] uppercase tracking-[0.22em] text-emerald-300/60">
                  System online
                </p>

              </div>

              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
                Admin Command Center
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/35">
                Monitor requests, sessions, users and financial activity from one centralized dashboard.
              </p>

            </div>


            <div className="flex gap-2 sm:gap-3">

              <button
                type="button"
                onClick={loadDashboard}
                disabled={
                  loading ||
                  analyticsLoading
                }
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-5 sm:text-sm"
              >
                {loading ||
                analyticsLoading
                  ? 'Refreshing...'
                  : 'Refresh'}
              </button>

              <Link
                to="/admin/sessions/create"
                className="flex-1 inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-xs font-semibold text-black transition hover:bg-white/90 sm:flex-none sm:px-5 sm:text-sm"
              >
                + Session
              </Link>

            </div>

          </div>

        </section>


        {/* ---------------------------------------------------------------- */}
        {/* ERROR                                                             */}
        {/* ---------------------------------------------------------------- */}

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-400/10 bg-red-400/[0.05] px-5 py-4 text-sm text-red-300"
          >
            {error}
          </div>
        )}


        {/* ================================================================= */}
        {/* TOP STATISTICS                                                     */}
        {/* ================================================================= */}

        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">

          <StatCard
            label="Users"
            value={
              analyticsLoading
                ? '—'
                : String(
                    analytics?.summary.total_users ??
                    0,
                  )
            }
            description="Active accounts"
          />

          <StatCard
            label="Sessions"
            value={
              analyticsLoading
                ? '—'
                : String(
                    analytics?.summary.total_sessions ??
                    0,
                  )
            }
            description="Recorded sessions"
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
            description="Session requests"
          />

          <StatCard
            label="Payments"
            value={
              analyticsLoading
                ? '—'
                : String(
                    analytics?.summary.pending_payments ??
                    0,
                  )
            }
            description="Pending payments"
          />

          <StatCard
            label="Packets"
            value={
              analyticsLoading
                ? '—'
                : String(
                    analytics?.summary.total_packets ??
                    0,
                  )
            }
            description="Consumed"
          />

          <StatCard
            label="Collection"
            value={
              analyticsLoading
                ? '—'
                : `${(
                    calculateCollectionRate(
                      analytics?.summary.total_confirmed_payments ??
                      0,
                      analytics?.summary.total_session_value ??
                      0,
                    )
                  ).toFixed(1)}%`
            }
            description="Collection rate"
          />

        </section>


        {/* ================================================================= */}
        {/* FINANCIAL OVERVIEW                                                 */}
        {/* ================================================================= */}

        <section className="mt-5 grid gap-5 lg:grid-cols-3">

          <AnalyticsCard
            title="Financial Overview"
            eyebrow="Live analytics"
            className="lg:col-span-2"
          >

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

              <Metric
                label="Total owed"
                value={
                  analyticsLoading
                    ? 'RM —'
                    : formatRM(
                        analytics?.summary.total_session_value ??
                        0,
                      )
                }
                description="Total session value"
              />

              <Metric
                label="Collected"
                value={
                  analyticsLoading
                    ? 'RM —'
                    : formatRM(
                        analytics?.summary.total_confirmed_payments ??
                        0,
                      )
                }
                description="Confirmed payments"
              />

              <Metric
                label="Outstanding"
                value={
                  analyticsLoading
                    ? 'RM —'
                    : formatRM(
                        analytics?.summary.total_outstanding ??
                        0,
                      )
                }
                description="Remaining debt"
                highlight
              />

            </div>


            <div className="mt-5 rounded-2xl border border-white/[0.06] bg-black/20 p-4 sm:p-5">

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-xs font-medium text-white/60">
                    Collection progress
                  </p>

                  <p className="mt-1 text-[10px] text-white/25">
                    Confirmed payments versus session value
                  </p>
                </div>

                <span className="text-sm font-semibold text-emerald-300">
                  {analyticsLoading
                    ? '—'
                    : `${(
                        calculateCollectionRate(
                          analytics?.summary.total_confirmed_payments ??
                          0,
                          analytics?.summary.total_session_value ??
                          0,
                        )
                      ).toFixed(1)}%`}
                </span>

              </div>


              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.05]">

                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-400 via-blue-400 to-emerald-400 transition-all duration-700"
                  style={{
                    width: `${
                      Math.min(
                        calculateCollectionRate(
                          analytics?.summary.total_confirmed_payments ??
                          0,
                          analytics?.summary.total_session_value ??
                          0,
                        ),
                        100,
                      )
                    }%`,
                  }}
                />

              </div>

            </div>


            <div className="mt-3 grid grid-cols-2 gap-3">

              <MiniMetric
                label="Requested packets"
                value={totalRequestedPackets.toFixed(2)}
              />

              <MiniMetric
                label="Approved packets"
                value={approvedPackets.toFixed(2)}
              />

            </div>

          </AnalyticsCard>


          {/* ---------------------------------------------------------------- */}
          {/* DEBT MONITOR                                                     */}
          {/* ---------------------------------------------------------------- */}

          <AnalyticsCard
            title="Debt Monitor"
            eyebrow="Highest outstanding"
          >

            {analyticsLoading ? (
              <LoadingBox text="Loading debt data..." />
            ) : analytics?.highest_debt_users.length === 0 ? (
              <EmptyBox
                title="No debt recorded"
                description="Users with outstanding balances will appear here."
              />
            ) : (
              <div className="space-y-2.5">

                {analytics?.highest_debt_users.map(
                  (person, index) => (
                    <DebtRankingRow
                      key={person.user_id}
                      person={person}
                      rank={index + 1}
                    />
                  ),
                )}

              </div>
            )}

          </AnalyticsCard>

        </section>


        {/* ================================================================= */}
        {/* INDIVIDUAL DEBT LEDGER                                             */}
        {/* ================================================================= */}

        <section className="mt-5 rounded-3xl border border-white/[0.08] bg-white/[0.025] p-4 shadow-[0_25px_100px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:p-6">

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">

            <div>

              <p className="text-[9px] uppercase tracking-[0.18em] text-white/25">
                Financial intelligence
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                Individual debt ledger
              </h2>

              <p className="mt-1 text-xs text-white/30">
                Every active user's debt, confirmed payments and remaining balance.
              </p>

            </div>

            <span className="w-fit rounded-full border border-violet-400/10 bg-violet-400/[0.05] px-3 py-1.5 text-[9px] uppercase tracking-wider text-violet-300/70">
              Live database
            </span>

          </div>


          {analyticsLoading ? (
            <div className="mt-5">
              <LoadingBox text="Loading user balances..." />
            </div>
          ) : analytics?.users.length === 0 ? (
            <div className="mt-5">
              <EmptyBox
                title="No users found"
                description="Active users will appear here."
              />
            </div>
          ) : (

            <>

              {/* MOBILE CARDS */}

              <div className="mt-5 space-y-2.5 md:hidden">

                {visibleUsers.map(
                  (person) => (
                    <MobileDebtCard
                      key={person.user_id}
                      person={person}
                    />
                  ),
                )}

              </div>


              {/* DESKTOP TABLE */}

              <div className="mt-5 hidden overflow-x-auto md:block">

                <table className="w-full">

                  <thead>

                    <tr className="border-b border-white/[0.06] text-left">

                      <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-white/25">
                        User
                      </th>

                      <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-white/25">
                        Owed
                      </th>

                      <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-white/25">
                        Paid
                      </th>

                      <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-white/25">
                        Outstanding
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {visibleUsers.map(
                      (person) => (
                        <DebtTableRow
                          key={person.user_id}
                          person={person}
                        />
                      ),
                    )}

                  </tbody>

                </table>

              </div>


              {hasMoreUsers && (
                <button
                  type="button"
                  onClick={() =>
                    setUserPage(
                      (page) =>
                        page + 1,
                    )
                  }
                  className="mt-4 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 text-xs font-medium text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Load more users
                </button>
              )}

              {!hasMoreUsers &&
                analytics &&
                analytics.users.length >
                  USERS_PER_PAGE && (
                  <p className="mt-4 text-center text-[10px] text-white/20">
                    All {analytics.users.length} users shown
                  </p>
              )}

            </>

          )}

        </section>


        {/* ================================================================= */}
        {/* SPENDING RANKING                                                   */}
        {/* ================================================================= */}

        <section className="mt-5 rounded-3xl border border-white/[0.08] bg-white/[0.025] p-4 backdrop-blur-xl sm:p-6">

          <div>

            <p className="text-[9px] uppercase tracking-[0.18em] text-white/25">
              Usage intelligence
            </p>

            <h2 className="mt-2 text-xl font-semibold">
              Highest spending users
            </h2>

            <p className="mt-1 text-xs text-white/30">
              Users with the highest accumulated session costs.
            </p>

          </div>


          {analyticsLoading ? (
            <div className="mt-5">
              <LoadingBox text="Loading spending data..." />
            </div>
          ) : analytics?.highest_spenders.length === 0 ? (
            <div className="mt-5">
              <EmptyBox
                title="No spending data"
                description="Session participation will appear here."
              />
            </div>
          ) : (

            <div className="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">

              {analytics?.highest_spenders.map(
                (person, index) => (
                  <SpenderCard
                    key={person.user_id}
                    person={person}
                    rank={index + 1}
                  />
                ),
              )}

            </div>

          )}

        </section>


        {/* ================================================================= */}
        {/* PENDING PAYMENTS                                                   */}
        {/* ================================================================= */}

        <section className="mt-5 rounded-3xl border border-white/[0.08] bg-white/[0.025] p-4 shadow-[0_25px_100px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/25">
                Finance operations
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                Pending payment approvals
              </h2>

              <p className="mt-1 text-xs text-white/30">
                Review user-submitted payments before they affect balances.
              </p>
            </div>

            <span className="w-fit rounded-full border border-blue-400/10 bg-blue-400/[0.05] px-3 py-1.5 text-[9px] uppercase tracking-wider text-blue-300/70">
              {pendingPayments.length} pending
            </span>
          </div>

          {paymentsLoading ? (
            <div className="mt-5">
              <LoadingBox text="Loading payments..." />
            </div>
          ) : pendingPayments.length === 0 ? (
            <div className="mt-5">
              <EmptyBox
                title="No pending payments"
                description="New user payment submissions will appear here."
              />
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {pendingPayments.map((payment) => (
                <PaymentCard
                  key={payment.id}
                  payment={payment}
                  userName={
                    analytics?.users.find(
                      (person) =>
                        person.user_id === payment.user_id,
                    )?.name ?? `User #${payment.user_id}`
                  }
                  processing={
                    paymentProcessingId === payment.id
                  }
                  onConfirm={() =>
                    handlePaymentAction(
                      payment.id,
                      'confirm',
                    )
                  }
                  onReject={() =>
                    handlePaymentAction(
                      payment.id,
                      'reject',
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>


        {/* ================================================================= */}
        {/* PENDING REQUESTS                                                   */}
        {/* ================================================================= */}

        <section className="mt-5 rounded-3xl border border-white/[0.08] bg-white/[0.025] p-4 shadow-[0_25px_100px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:p-6">

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

            <div>

              <p className="text-[9px] uppercase tracking-[0.18em] text-white/25">
                Operations
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                Pending session requests
              </h2>

              <p className="mt-1 text-xs text-white/30">
                Review and approve requests submitted by users.
              </p>

            </div>

            <span className="w-fit rounded-full border border-yellow-400/10 bg-yellow-400/[0.05] px-3 py-1.5 text-[9px] uppercase tracking-wider text-yellow-300/70">
              {pendingRequests.length} pending
            </span>

          </div>


          {loading ? (
            <LoadingBox text="Loading requests..." />
          ) : pendingRequests.length === 0 ? (
            <EmptyBox
              title="No pending requests"
              description="New user requests will appear here."
            />
          ) : (

            <div className="mt-5 space-y-3">

              {pendingRequests.map(
                (request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    processing={
                      processingId ===
                      request.id
                    }
                    onApprove={
                      handleApprove
                    }
                    onReject={
                      handleReject
                    }
                  />
                ),
              )}

            </div>

          )}

        </section>


        {/* ================================================================= */}
        {/* REQUEST HISTORY                                                    */}
        {/* ================================================================= */}

        <section className="mt-5 rounded-3xl border border-white/[0.08] bg-white/[0.025] p-4 backdrop-blur-xl sm:p-6">

          <div>

            <p className="text-[9px] uppercase tracking-[0.18em] text-white/25">
              Audit trail
            </p>

            <h2 className="mt-2 text-xl font-semibold">
              Recent requests
            </h2>

            <p className="mt-1 text-xs text-white/30">
              Recent activity across the session request system.
            </p>

          </div>


          {loading ? (
            <div className="mt-5">
              <LoadingBox text="Loading history..." />
            </div>
          ) : requests.length === 0 ? (
            <div className="mt-5">
              <EmptyBox
                title="No requests yet"
                description="Session request history will appear here."
              />
            </div>
          ) : (

            <>

              <div className="mt-5 space-y-2.5">

                {visibleHistory.map(
                  (request) => (
                    <HistoryRow
                      key={request.id}
                      request={request}
                    />
                  ),
                )}

              </div>


              {hasMoreHistory && (
                <button
                  type="button"
                  onClick={() =>
                    setHistoryPage(
                      (page) =>
                        page + 1,
                    )
                  }
                  className="mt-4 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 text-xs font-medium text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Load more history
                </button>
              )}

            </>

          )}

        </section>


        {/* ================================================================= */}
        {/* CAPABILITIES                                                       */}
        {/* ================================================================= */}

        <section className="mt-5 grid gap-3 sm:grid-cols-3">

          <Capability
            title="Session control"
            description="Create and approve sessions."
          />

          <Capability
            title="Financial analytics"
            description="Track payments and individual debt."
          />

          <Capability
            title="User oversight"
            description="Review users and activity."
          />

        </section>


        <p className="mt-8 pb-4 text-center text-[9px] uppercase tracking-[0.18em] text-white/15">
          KoTrack Administration System
        </p>

      </div>

    </main>
  )
}


// ============================================================================
// COMPONENTS
// ============================================================================

function StatCard({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 transition hover:border-white/[0.14] hover:bg-white/[0.04] sm:p-5">

      <div className="flex items-center justify-between">

        <p className="text-[9px] uppercase tracking-[0.16em] text-white/30">
          {label}
        </p>

        <span className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_12px_rgba(196,181,253,0.7)]" />

      </div>

      <p className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        {value}
      </p>

      <p className="mt-1.5 text-[10px] text-white/25">
        {description}
      </p>

    </div>
  )
}


function AnalyticsCard({
  title,
  eyebrow,
  children,
  className = '',
}: {
  title: string
  eyebrow: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-3xl border border-white/[0.08] bg-white/[0.025] p-4 backdrop-blur-xl sm:p-6 ${className}`}
    >

      <p className="text-[9px] uppercase tracking-[0.18em] text-violet-300/40">
        {eyebrow}
      </p>

      <h2 className="mt-2 text-lg font-semibold">
        {title}
      </h2>

      <div className="mt-4">
        {children}
      </div>

    </div>
  )
}


function Metric({
  label,
  value,
  description,
  highlight = false,
}: {
  label: string
  value: string
  description: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? 'border-red-400/10 bg-red-400/[0.04]'
          : 'border-white/[0.06] bg-black/15'
      }`}
    >

      <p className="text-[9px] uppercase tracking-wider text-white/25">
        {label}
      </p>

      <p
        className={`mt-2 text-xl font-semibold ${
          highlight
            ? 'text-red-300'
            : 'text-white'
        }`}
      >
        {value}
      </p>

      <p className="mt-1 text-[10px] text-white/20">
        {description}
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
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3.5">

      <p className="text-[9px] uppercase tracking-wider text-white/20">
        {label}
      </p>

      <p className="mt-1.5 text-lg font-semibold text-white/70">
        {value}
      </p>

    </div>
  )
}


// ============================================================================
// DEBT COMPONENTS
// ============================================================================

function DebtRankingRow({
  person,
  rank,
}: {
  person: UserAnalytics
  rank: number
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/10 p-3">

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-400/10 bg-violet-400/[0.05] text-[10px] font-semibold text-violet-300">
        #{rank}
      </div>

      <div className="min-w-0 flex-1">

        <p className="truncate text-xs font-medium text-white/70">
          {person.name}
        </p>

        <p className="mt-0.5 text-[9px] text-white/25">
          Owes {formatRM(person.total_owed)}
        </p>

      </div>

      <p className="text-sm font-semibold text-red-300">
        {formatRM(person.balance)}
      </p>

    </div>
  )
}


function MobileDebtCard({
  person,
}: {
  person: UserAnalytics
}) {
  const outstanding =
    person.balance > 0

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">

      <div className="flex items-center gap-3">

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-xs font-semibold text-white/60">
          {person.name
            .charAt(0)
            .toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">

          <p className="truncate text-sm font-medium text-white/75">
            {person.name}
          </p>

          <p className="text-[9px] text-white/20">
            User #{person.user_id}
          </p>

        </div>

        <span
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
            outstanding
              ? 'border-red-400/10 bg-red-400/[0.05] text-red-300'
              : 'border-emerald-400/10 bg-emerald-400/[0.05] text-emerald-300'
          }`}
        >
          {formatRM(person.balance)}
        </span>

      </div>


      <div className="mt-4 grid grid-cols-2 gap-2">

        <SmallFinancialValue
          label="Owed"
          value={formatRM(person.total_owed)}
        />

        <SmallFinancialValue
          label="Paid"
          value={formatRM(person.total_paid)}
        />

      </div>

    </div>
  )
}


function SmallFinancialValue({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">

      <p className="text-[9px] uppercase tracking-wider text-white/20">
        {label}
      </p>

      <p className="mt-1 text-xs font-medium text-white/60">
        {value}
      </p>

    </div>
  )
}


function DebtTableRow({
  person,
}: {
  person: UserAnalytics
}) {
  const outstanding =
    person.balance > 0

  return (
    <tr className="border-b border-white/[0.04] transition hover:bg-white/[0.025]">

      <td className="px-4 py-4">

        <div className="flex items-center gap-3">

          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-xs font-semibold text-white/60">
            {person.name
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>

            <p className="text-sm font-medium text-white/70">
              {person.name}
            </p>

            <p className="text-[9px] text-white/20">
              User #{person.user_id}
            </p>

          </div>

        </div>

      </td>


      <td className="px-4 py-4 text-right text-sm text-white/60">
        {formatRM(person.total_owed)}
      </td>


      <td className="px-4 py-4 text-right text-sm text-emerald-300/70">
        {formatRM(person.total_paid)}
      </td>


      <td className="px-4 py-4 text-right">

        <span
          className={`inline-flex rounded-lg border px-3 py-1.5 text-xs font-semibold ${
            outstanding
              ? 'border-red-400/10 bg-red-400/[0.05] text-red-300'
              : 'border-emerald-400/10 bg-emerald-400/[0.05] text-emerald-300'
          }`}
        >
          {formatRM(person.balance)}
        </span>

      </td>

    </tr>
  )
}


// ============================================================================
// SPENDING
// ============================================================================

function SpenderCard({
  person,
  rank,
}: {
  person: HighestSpender
  rank: number
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4 transition hover:border-violet-400/20 hover:bg-violet-400/[0.025]">

      <div className="flex items-center justify-between">

        <span className="text-[10px] font-semibold text-violet-300/60">
          #{rank}
        </span>

      </div>

      <p className="mt-3 truncate text-sm font-medium text-white/65">
        {person.name}
      </p>

      <p className="mt-2 text-lg font-semibold">
        {formatRM(person.total_spent)}
      </p>

      <p className="mt-1 text-[9px] text-white/20">
        accumulated session cost
      </p>

    </div>
  )
}


// ============================================================================
// REQUESTS
// ============================================================================

function PaymentCard({
  payment,
  userName,
  processing,
  onConfirm,
  onReject,
}: {
  payment: Payment
  userName: string
  processing: boolean
  onConfirm: () => void
  onReject: () => void
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-4 transition hover:border-white/[0.12] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/10 bg-blue-400/[0.05] text-sm font-semibold text-blue-200">
              RM
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">
                  Payment #{payment.id}
                </h3>

                <span className="rounded-full border border-yellow-400/10 bg-yellow-400/[0.05] px-2.5 py-1 text-[9px] uppercase tracking-wider text-yellow-300/70">
                  Pending
                </span>
              </div>

              <p className="mt-1 text-xs text-white/30">
                {userName} (User #{payment.user_id})
                {' · '}
                Submitted {formatDateTime(payment.created_at)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Detail
              label="Amount"
              value={formatRM(Number(payment.amount || 0))}
            />

            <Detail
              label="Submitted"
              value={formatDateTime(payment.created_at)}
            />
          </div>
        </div>

        <div className="flex shrink-0 gap-2 lg:flex-col">
          <button
            type="button"
            disabled={processing}
            onClick={onReject}
            className="flex-1 rounded-xl border border-red-400/10 bg-red-400/[0.04] px-4 py-3 text-xs font-medium text-red-300 transition hover:bg-red-400/[0.08] disabled:cursor-not-allowed disabled:opacity-40 lg:min-w-[120px]"
          >
            {processing ? 'Processing...' : 'Reject'}
          </button>

          <button
            type="button"
            disabled={processing}
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-white px-4 py-3 text-xs font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40 lg:min-w-[120px]"
          >
            {processing ? 'Processing...' : 'Confirm'}
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
    <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-4 transition hover:border-white/[0.12] sm:p-5">

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

        <div className="min-w-0 flex-1">

          <div className="flex items-start gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/10 bg-violet-400/[0.05] text-sm font-semibold text-violet-200">
              {request.participants[0]?.user_name
                ?.charAt(0)
                .toUpperCase() ?? '?'}
            </div>

            <div className="min-w-0">

              <div className="flex flex-wrap items-center gap-2">

                <h3 className="text-sm font-semibold">
                  Request #{request.id}
                </h3>

                <span className="rounded-full border border-yellow-400/10 bg-yellow-400/[0.05] px-2.5 py-1 text-[9px] uppercase tracking-wider text-yellow-300/70">
                  Pending
                </span>

              </div>

              <p className="mt-1 text-xs text-white/30">
                Requested by user #{request.requested_by}
              </p>

            </div>

          </div>


          <div className="mt-4 grid gap-2 sm:grid-cols-3">

            <Detail
              label="Session date"
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
              label="Participants"
              value={`${request.participants.length} people`}
            />

          </div>


          <div className="mt-4">

            <p className="text-[9px] uppercase tracking-wider text-white/20">
              Participants
            </p>

            <div className="mt-2 flex flex-wrap gap-2">

              {request.participants.map(
                (participant) => (
                  <span
                    key={`${request.id}-${participant.user_id}`}
                    className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-white/50"
                  >
                    {participant.user_name}
                  </span>
                ),
              )}

            </div>

          </div>


          {request.note && (
            <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">

              <p className="text-[9px] uppercase tracking-wider text-white/20">
                Note
              </p>

              <p className="mt-1 text-xs leading-5 text-white/40">
                {request.note}
              </p>

            </div>
          )}

        </div>


        <div className="flex shrink-0 gap-2 lg:flex-col">

          <button
            type="button"
            disabled={processing}
            onClick={() =>
              onReject(request.id)
            }
            className="flex-1 rounded-xl border border-red-400/10 bg-red-400/[0.04] px-4 py-3 text-xs font-medium text-red-300 transition hover:bg-red-400/[0.08] disabled:cursor-not-allowed disabled:opacity-40 lg:min-w-[120px]"
          >
            {processing
              ? 'Processing...'
              : 'Reject'}
          </button>

          <button
            type="button"
            disabled={processing}
            onClick={() =>
              onApprove(request.id)
            }
            className="flex-1 rounded-xl bg-white px-4 py-3 text-xs font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40 lg:min-w-[120px]"
          >
            {processing
              ? 'Processing...'
              : 'Approve'}
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
      ? 'border-emerald-400/10 bg-emerald-400/[0.05] text-emerald-300'
      : request.status === 'REJECTED'
        ? 'border-red-400/10 bg-red-400/[0.05] text-red-300'
        : 'border-yellow-400/10 bg-yellow-400/[0.05] text-yellow-300'

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-black/10 p-4 sm:flex-row sm:items-center sm:justify-between">

      <div>

        <p className="text-sm font-medium">
          Request #{request.id}
        </p>

        <p className="mt-1 text-xs text-white/30">
          User #{request.requested_by}
          {' · '}
          {formatDate(
            request.session_date,
          )}
          {' · '}
          {request.participants.length}{' '}
          participants
        </p>

      </div>

      <span
        className={`w-fit rounded-full border px-3 py-1 text-[9px] uppercase tracking-wider ${statusClass}`}
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
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">

      <p className="text-[9px] uppercase tracking-wider text-white/20">
        {label}
      </p>

      <p className="mt-1.5 text-sm font-medium text-white/60">
        {value}
      </p>

    </div>
  )
}


// ============================================================================
// STATES
// ============================================================================

function LoadingBox({
  text,
}: {
  text: string
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-8 text-center">

      <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />

      <p className="mt-4 text-sm text-white/30">
        {text}
      </p>

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
    <div className="rounded-2xl border border-dashed border-white/[0.07] bg-black/10 p-8 text-center">

      <p className="text-sm text-white/40">
        {title}
      </p>

      <p className="mt-2 text-xs text-white/20">
        {description}
      </p>

    </div>
  )
}


function Capability({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-white/[0.12] hover:bg-white/[0.035] sm:p-5">

      <p className="text-sm font-medium text-white/65">
        {title}
      </p>

      <p className="mt-2 text-xs leading-5 text-white/25">
        {description}
      </p>

    </div>
  )
}


// ============================================================================
// HELPERS
// ============================================================================

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
  const date =
    new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString(
    'en-MY',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  )
}


function formatDateTime(value: string) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}


function calculateCollectionRate(
  paid: number,
  total: number,
) {
  if (total <= 0) {
    return 0
  }

  return (
    (paid / total) *
    100
  )
}