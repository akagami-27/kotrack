import { useEffect, useMemo, useState } from 'react'
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

type Payment = {
  id: number
  user_id: number
  amount: number | string
  status: string
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

type PasswordResetRequest = {
  id: number
  user_id: number
  username: string
  created_at: string
  approved_at: string | null
  expires_at: string | null
}

type PasswordResetApproval = {
  message: string
  request_id: number
  username: string
  code: string
  expires_at: string
}

const USERS_PER_PAGE = 8

export default function AdminDashboard() {
  const { user } = useAuth()

  const [analytics, setAnalytics] =
    useState<AnalyticsResponse | null>(null)

  const [requests, setRequests] =
    useState<SessionRequest[]>([])

  const [payments, setPayments] =
    useState<Payment[]>([])

  const [resetRequests, setResetRequests] =
    useState<PasswordResetRequest[]>([])

  const [resetCode, setResetCode] =
    useState<PasswordResetApproval | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [processingId, setProcessingId] =
    useState<number | null>(null)

  const [paymentProcessingId, setPaymentProcessingId] =
    useState<number | null>(null)

  const [resetProcessingId, setResetProcessingId] =
    useState<number | null>(null)

  const [userPage, setUserPage] = useState(1)

  async function loadAnalytics() {
    setAnalytics(
      await apiRequest<AnalyticsResponse>(
        '/api/admin/analytics',
      ),
    )
  }

  async function loadRequests() {
    setRequests(
      await apiRequest<SessionRequest[]>(
        '/api/session-requests',
      ),
    )
  }

  async function loadPayments() {
    setPayments(
      await apiRequest<Payment[]>(
        '/api/payments',
      ),
    )
  }

  async function loadResetRequests() {
    setResetRequests(
      await apiRequest<PasswordResetRequest[]>(
        '/api/admin/password-reset-requests',
      ),
    )
  }

  async function loadDashboard() {
    setError('')
    setRefreshing(true)

    try {
      await Promise.all([
        loadAnalytics(),
        loadRequests(),
        loadPayments(),
        loadResetRequests(),
      ])

      setUserPage(1)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load admin dashboard.',
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadDashboard()
    }
  }, [user])

  async function handleSessionAction(
    id: number,
    action: 'approve' | 'reject',
  ) {
    setProcessingId(id)
    setError('')

    try {
      await apiRequest(
        `/api/session-requests/${id}/${action}`,
        {
          method: 'POST',
        },
      )

      await loadDashboard()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to ${action} request.`,
      )
    } finally {
      setProcessingId(null)
    }
  }

  async function handlePaymentAction(
    id: number,
    action: 'confirm' | 'reject',
  ) {
    setPaymentProcessingId(id)
    setError('')

    try {
      await apiRequest(
        `/api/payments/${id}/${action}`,
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

  async function handleResetApproval(id: number) {
    setResetProcessingId(id)
    setResetCode(null)
    setError('')

    try {
      const result =
        await apiRequest<PasswordResetApproval>(
          `/api/admin/password-reset-requests/${id}/approve`,
          {
            method: 'POST',
          },
        )

      setResetCode(result)

      await loadResetRequests()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to approve password reset.',
      )
    } finally {
      setResetProcessingId(null)
    }
  }

  const pendingRequests = useMemo(
    () =>
      requests.filter(
        (request) => request.status === 'PENDING',
      ),
    [requests],
  )

  const pendingPayments = useMemo(
    () =>
      payments.filter(
        (payment) => payment.status === 'PENDING',
      ),
    [payments],
  )

  const visibleUsers =
    analytics?.users.slice(
      0,
      userPage * USERS_PER_PAGE,
    ) ?? []

  const hasMoreUsers =
    analytics
      ? visibleUsers.length < analytics.users.length
      : false

  if (user?.role !== 'ADMIN') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#030508] px-6 text-white">
        <div className="relative overflow-hidden rounded-2xl border border-red-400/20 bg-[#080b10] p-8 text-center shadow-[0_0_50px_rgba(239,68,68,0.08)]">
          <div className="absolute inset-x-0 top-0 h-px bg-red-400/50" />

          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-red-300/60">
            Access Control
          </p>

          <h1 className="mt-3 text-xl font-semibold">
            Access denied
          </h1>

          <p className="mt-2 text-sm text-white/35">
            Administrator privileges are required.
          </p>

          <Link
            to="/dashboard"
            className="mt-5 inline-flex rounded-lg bg-white px-5 py-2.5 text-xs font-semibold text-black"
          >
            Return to dashboard
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030508] text-white">

      {/* Cyber grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
        }}
      />

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[20%] top-[-300px] h-[650px] w-[650px] rounded-full bg-cyan-400/[0.035] blur-[160px]" />

        <div className="absolute right-[-250px] top-[25%] h-[600px] w-[600px] rounded-full bg-violet-500/[0.035] blur-[160px]" />
      </div>

      {/* Scan line */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-px bg-cyan-300/20 shadow-[0_0_12px_rgba(103,232,249,0.35)]" />

      {/* HEADER */}
      <header className="relative z-10 border-b border-white/[0.06] bg-[#030508]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">

          <Link
            to="/"
            className="flex items-center gap-3"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/[0.04] font-mono text-sm font-bold text-cyan-200">
              K

              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.9)]" />
            </div>

            <div>
              <p className="font-mono text-sm font-semibold tracking-tight">
                KOTRACK
              </p>

              <p className="font-mono text-[7px] uppercase tracking-[0.3em] text-cyan-300/40">
                Control System
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />

              <span className="font-mono text-[9px] text-emerald-300/50">
                ONLINE
              </span>
            </div>

            <span className="hidden text-xs text-white/35 sm:block">
              {user.name}
            </span>

            <Link
              to="/dashboard"
              className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[9px] text-white/50 transition hover:border-cyan-300/20 hover:text-cyan-200"
            >
              USER VIEW
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-5 sm:px-6">

        {/* TITLE */}
        <div className="flex items-end justify-between gap-4">

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-cyan-300/50">
                SYS / ADMIN / CORE
              </span>

              <span className="h-px w-8 bg-cyan-300/20" />
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Command Center
            </h1>

            <p className="mt-1 font-mono text-[9px] text-white/25">
              REAL-TIME SYSTEM OPERATIONS
            </p>
          </div>

          <button
            type="button"
            onClick={loadDashboard}
            disabled={refreshing}
            className="rounded-lg border border-cyan-300/10 bg-cyan-300/[0.025] px-3 py-2 font-mono text-[9px] text-cyan-200/60 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.05] disabled:opacity-40"
          >
            {refreshing ? 'SYNCING...' : '↻ REFRESH'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-xl border border-red-400/15 bg-red-400/[0.04] px-4 py-2.5 font-mono text-[9px] text-red-300">
            ERROR // {error}
          </div>
        )}

        {/* ============================================================ */}
        {/* TOP ANALYTICS                                                */}
        {/* ============================================================ */}

        <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">

          <CyberStat
            label="USERS"
            value={
              loading
                ? '—'
                : String(
                    analytics?.summary.total_users ?? 0,
                  )
            }
          />

          <CyberStat
            label="SESSIONS"
            value={
              loading
                ? '—'
                : String(
                    analytics?.summary.total_sessions ?? 0,
                  )
            }
          />

          <CyberStat
            label="PACKETS"
            value={
              loading
                ? '—'
                : String(
                    analytics?.summary.total_packets ?? 0,
                  )
            }
          />

          <CyberStat
            label="VALUE"
            value={
              loading
                ? '—'
                : formatRM(
                    analytics?.summary.total_session_value ?? 0,
                  )
            }
          />

          <CyberStat
            label="COLLECTED"
            value={
              loading
                ? '—'
                : formatRM(
                    analytics?.summary.total_confirmed_payments ?? 0,
                  )
            }
            positive
          />

          <CyberStat
            label="OUTSTANDING"
            value={
              loading
                ? '—'
                : formatRM(
                    analytics?.summary.total_outstanding ?? 0,
                  )
            }
            danger
          />

        </section>

        {/* ============================================================ */}
        {/* FINANCIAL + DEBT                                             */}
        {/* ============================================================ */}

        <div className="mt-3 grid gap-3 lg:grid-cols-3">

          <section className="cyber-panel lg:col-span-2">
            <PanelHeader
              code="FIN-01"
              title="Financial Overview"
              subtitle="SYSTEM-WIDE FINANCIAL STATE"
            />

            <div className="mt-3 grid grid-cols-3 gap-2">

              <Metric
                label="SESSION VALUE"
                value={formatRM(
                  analytics?.summary.total_session_value ?? 0,
                )}
              />

              <Metric
                label="COLLECTED"
                value={formatRM(
                  analytics?.summary.total_confirmed_payments ?? 0,
                )}
                positive
              />

              <Metric
                label="OUTSTANDING"
                value={formatRM(
                  analytics?.summary.total_outstanding ?? 0,
                )}
                danger
              />

            </div>

            <div className="mt-3">
              <div className="flex justify-between font-mono text-[8px] text-white/25">
                <span>COLLECTION_RATIO</span>

                <span>
                  {collectionRate(
                    analytics?.summary.total_confirmed_payments ?? 0,
                    analytics?.summary.total_session_value ?? 0,
                  ).toFixed(1)}
                  %
                </span>
              </div>

              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 shadow-[0_0_10px_rgba(103,232,249,0.5)]"
                  style={{
                    width: `${Math.min(
                      collectionRate(
                        analytics?.summary.total_confirmed_payments ?? 0,
                        analytics?.summary.total_session_value ?? 0,
                      ),
                      100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          </section>

          <section className="cyber-panel">
            <PanelHeader
              code="DEBT-01"
              title="Debt Monitor"
              subtitle="HIGHEST OUTSTANDING BALANCES"
            />

            <div className="mt-3 space-y-1.5">
              {analytics?.highest_debt_users
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
          </section>

        </div>

        {/* ============================================================ */}
        {/* PENDING OPERATIONS                                           */}
        {/* ============================================================ */}

        <div className="mt-3 grid gap-3 lg:grid-cols-2">

          {/* PAYMENTS */}
          <section className="cyber-panel">
            <PanelHeader
              code="PAY-01"
              title="Pending Payments"
              subtitle="TRANSACTION REVIEW QUEUE"
              count={pendingPayments.length}
            />

            <div className="mt-3 space-y-2">

              {pendingPayments.length === 0 ? (
                <Empty text="NO PENDING PAYMENT OPERATIONS" />
              ) : (
                pendingPayments.map((payment) => {

                  const userName =
                    analytics?.users.find(
                      (person) =>
                        person.user_id === payment.user_id,
                    )?.name ??
                    `USER #${payment.user_id}`

                  return (
                    <div
                      key={payment.id}
                      className="rounded-xl border border-white/[0.06] bg-black/20 p-3 transition hover:border-cyan-300/10"
                    >
                      <div className="flex items-center justify-between gap-3">

                        <div>
                          <p className="text-[10px] font-medium text-white/65">
                            {userName}
                          </p>

                          <p className="mt-0.5 font-mono text-[8px] text-white/20">
                            TX-{String(payment.id).padStart(4, '0')}
                          </p>
                        </div>

                        <span className="font-mono text-sm font-semibold text-cyan-200/80">
                          {formatRM(
                            Number(payment.amount),
                          )}
                        </span>

                      </div>

                      <div className="mt-2 flex gap-2">

                        <button
                          type="button"
                          disabled={
                            paymentProcessingId ===
                            payment.id
                          }
                          onClick={() =>
                            handlePaymentAction(
                              payment.id,
                              'reject',
                            )
                          }
                          className="flex-1 rounded-lg border border-red-400/10 bg-red-400/[0.03] py-2 font-mono text-[8px] text-red-300/70 transition hover:bg-red-400/[0.07]"
                        >
                          REJECT
                        </button>

                        <button
                          type="button"
                          disabled={
                            paymentProcessingId ===
                            payment.id
                          }
                          onClick={() =>
                            handlePaymentAction(
                              payment.id,
                              'confirm',
                            )
                          }
                          className="flex-1 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.04] py-2 font-mono text-[8px] text-emerald-300/80 transition hover:bg-emerald-400/[0.08]"
                        >
                          CONFIRM
                        </button>

                      </div>
                    </div>
                  )
                })
              )}

            </div>
          </section>

          {/* SESSIONS */}
          <section className="cyber-panel">
            <PanelHeader
              code="SES-01"
              title="Pending Sessions"
              subtitle="SESSION APPROVAL QUEUE"
              count={pendingRequests.length}
            />

            <div className="mt-3 space-y-2">

              {pendingRequests.length === 0 ? (
                <Empty text="NO PENDING SESSION OPERATIONS" />
              ) : (
                pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-xl border border-white/[0.06] bg-black/20 p-3 transition hover:border-cyan-300/10"
                  >
                    <div className="flex items-center justify-between gap-3">

                      <div>
                        <p className="font-mono text-[9px] text-white/55">
                          SESSION-
                          {String(request.id).padStart(
                            4,
                            '0',
                          )}
                        </p>

                        <p className="mt-0.5 text-[8px] text-white/20">
                          USER #{request.requested_by}
                          {' · '}
                          {formatDate(
                            request.session_date,
                          )}
                        </p>
                      </div>

                      <span className="font-mono text-[9px] text-violet-300/60">
                        {request.packets_used} PKT
                      </span>

                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {request.participants.map(
                        (participant) => (
                          <span
                            key={`${request.id}-${participant.user_id}`}
                            className="rounded-md border border-white/[0.05] bg-white/[0.02] px-2 py-1 text-[8px] text-white/35"
                          >
                            {participant.user_name}
                          </span>
                        ),
                      )}
                    </div>

                    <div className="mt-2 flex gap-2">

                      <button
                        type="button"
                        disabled={
                          processingId === request.id
                        }
                        onClick={() =>
                          handleSessionAction(
                            request.id,
                            'reject',
                          )
                        }
                        className="flex-1 rounded-lg border border-red-400/10 bg-red-400/[0.03] py-2 font-mono text-[8px] text-red-300/70 transition hover:bg-red-400/[0.07]"
                      >
                        REJECT
                      </button>

                      <button
                        type="button"
                        disabled={
                          processingId === request.id
                        }
                        onClick={() =>
                          handleSessionAction(
                            request.id,
                            'approve',
                          )
                        }
                        className="flex-1 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.04] py-2 font-mono text-[8px] text-emerald-300/80 transition hover:bg-emerald-400/[0.08]"
                      >
                        APPROVE
                      </button>

                    </div>
                  </div>
                ))
              )}

            </div>
          </section>

        </div>

        {/* ============================================================ */}
        {/* USER BALANCES                                                */}
        {/* ============================================================ */}

        <section className="cyber-panel mt-3">

          <PanelHeader
            code="USR-01"
            title="User Balances"
            subtitle="INDIVIDUAL FINANCIAL POSITION"
            count={analytics?.users.length ?? 0}
          />

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px]">

              <thead>
                <tr className="border-b border-cyan-300/[0.07]">
                  <th className="px-2 py-2 text-left font-mono text-[7px] uppercase tracking-wider text-white/20">
                    Identity
                  </th>

                  <th className="px-2 py-2 text-right font-mono text-[7px] uppercase tracking-wider text-white/20">
                    Owed
                  </th>

                  <th className="px-2 py-2 text-right font-mono text-[7px] uppercase tracking-wider text-white/20">
                    Paid
                  </th>

                  <th className="px-2 py-2 text-right font-mono text-[7px] uppercase tracking-wider text-white/20">
                    Balance
                  </th>
                </tr>
              </thead>

              <tbody>

                {visibleUsers.map((person) => (
                  <tr
                    key={person.user_id}
                    className="border-b border-white/[0.025] transition hover:bg-cyan-300/[0.015]"
                  >
                    <td className="px-2 py-2">

                      <div className="flex items-center gap-2">

                        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.025] font-mono text-[8px] text-cyan-300/50">
                          {person.name
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <p className="text-[9px] text-white/60">
                            {person.name}
                          </p>

                          <p className="font-mono text-[7px] text-white/15">
                            UID-{person.user_id}
                          </p>
                        </div>

                      </div>

                    </td>

                    <td className="px-2 py-2 text-right font-mono text-[9px] text-white/40">
                      {formatRM(person.total_owed)}
                    </td>

                    <td className="px-2 py-2 text-right font-mono text-[9px] text-emerald-300/60">
                      {formatRM(person.total_paid)}
                    </td>

                    <td className="px-2 py-2 text-right">

                      <span
                        className={
                          person.balance > 0
                            ? 'font-mono text-[9px] font-semibold text-red-300'
                            : 'font-mono text-[9px] font-semibold text-emerald-300'
                        }
                      >
                        {formatRM(person.balance)}
                      </span>

                    </td>
                  </tr>
                ))}

              </tbody>
            </table>
          </div>

          {hasMoreUsers && (
            <button
              type="button"
              onClick={() =>
                setUserPage((page) => page + 1)
              }
              className="mt-2 w-full rounded-lg border border-white/[0.06] bg-white/[0.015] py-2 font-mono text-[8px] text-cyan-200/40 transition hover:border-cyan-300/15 hover:text-cyan-200/70"
            >
              LOAD NEXT USER BLOCK
            </button>
          )}

        </section>

        {/* ============================================================ */}
        {/* HIGHEST SPENDING                                             */}
        {/* ============================================================ */}

        <section className="cyber-panel mt-3">

          <PanelHeader
            code="FIN-02"
            title="Highest Spending"
            subtitle="TOP USERS BY ACCUMULATED SESSION COST"
          />

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">

            {analytics?.highest_spenders
              .slice(0, 5)
              .map((person, index) => (
                <div
                  key={person.user_id}
                  className="relative overflow-hidden rounded-xl border border-white/[0.05] bg-black/20 p-3"
                >
                  <div className="absolute right-0 top-0 h-12 w-12 rounded-full bg-violet-400/[0.04] blur-xl" />

                  <p className="font-mono text-[8px] text-violet-300/45">
                    RANK_0{index + 1}
                  </p>

                  <p className="mt-1 truncate text-[9px] text-white/55">
                    {person.name}
                  </p>

                  <p className="mt-1 font-mono text-sm font-semibold text-white/75">
                    {formatRM(person.total_spent)}
                  </p>
                </div>
              ))}

          </div>

        </section>

        {/* ============================================================ */}
        {/* PASSWORD RESET — BOTTOM                                     */}
        {/* ============================================================ */}

        <section className="cyber-panel mt-6 border-violet-400/[0.10]">

          <PanelHeader
            code="SEC-01"
            title="Password Reset Requests"
            subtitle="ADMIN-ASSISTED ACCOUNT RECOVERY"
            count={resetRequests.length}
          />

          {resetCode && (
            <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.025] p-3">

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-emerald-300/50">
                    GENERATED CREDENTIAL
                  </p>

                  <p className="mt-1 text-[10px] text-white/60">
                    Give this code to{' '}
                    <span className="font-semibold text-white/85">
                      {resetCode.username}
                    </span>
                  </p>

                  <p className="mt-1 font-mono text-[7px] text-white/20">
                    EXPIRES{' '}
                    {formatDateTime(
                      resetCode.expires_at,
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">

                  <span className="rounded-lg border border-emerald-300/20 bg-black/30 px-4 py-2 font-mono text-xl font-bold tracking-[0.3em] text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.08)]">
                    {resetCode.code}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        resetCode.code,
                      )
                    }
                    className="rounded-lg border border-white/[0.07] px-3 py-2 font-mono text-[8px] text-white/35 transition hover:border-cyan-300/20 hover:text-cyan-200"
                  >
                    COPY
                  </button>

                </div>

              </div>
            </div>
          )}

          {resetRequests.length === 0 ? (
            <div className="mt-3">
              <Empty text="NO PASSWORD RESET REQUESTS" />
            </div>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">

              {resetRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3"
                >

                  <div className="min-w-0">

                    <p className="truncate text-[10px] font-medium text-white/65">
                      {request.username}
                    </p>

                    <p className="mt-0.5 font-mono text-[7px] text-white/20">
                      RESET-
                      {String(request.id).padStart(
                        4,
                        '0',
                      )}
                      {' · '}
                      {formatDateTime(
                        request.created_at,
                      )}
                    </p>

                  </div>

                  {request.approved_at ? (
                    <span className="shrink-0 rounded-full border border-emerald-400/10 bg-emerald-400/[0.04] px-2 py-1 font-mono text-[7px] text-emerald-300/60">
                      APPROVED
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        resetProcessingId ===
                        request.id
                      }
                      onClick={() =>
                        handleResetApproval(
                          request.id,
                        )
                      }
                      className="shrink-0 rounded-lg border border-violet-400/15 bg-violet-400/[0.04] px-3 py-2 font-mono text-[8px] text-violet-200/70 transition hover:border-violet-300/30 hover:bg-violet-400/[0.08] disabled:opacity-40"
                    >
                      {resetProcessingId ===
                      request.id
                        ? 'GENERATING...'
                        : 'APPROVE'}
                    </button>
                  )}

                </div>
              ))}

            </div>
          )}

        </section>

        {/* Footer */}
        <div className="flex items-center justify-between py-5 font-mono text-[7px] uppercase tracking-[0.2em] text-white/[0.12]">
          <span>KOTRACK // ADMIN CORE</span>
          <span>SECURE SESSION</span>
        </div>

      </div>
    </main>
  )
}

/* ========================================================================== */
/* COMPONENTS                                                                 */
/* ========================================================================== */

function CyberStat({
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
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 transition hover:border-cyan-300/15 hover:bg-cyan-300/[0.015]">

      <div className="absolute left-0 top-0 h-px w-8 bg-cyan-300/30 transition-all group-hover:w-full" />

      <p className="font-mono text-[7px] uppercase tracking-[0.18em] text-white/25">
        {label}
      </p>

      <p
        className={`mt-1 font-mono text-sm font-semibold ${
          danger
            ? 'text-red-300/85'
            : positive
              ? 'text-emerald-300/80'
              : 'text-white/75'
        }`}
      >
        {value}
      </p>

    </div>
  )
}

function PanelHeader({
  code,
  title,
  subtitle,
  count,
}: {
  code: string
  title: string
  subtitle: string
  count?: number
}) {
  return (
    <div className="flex items-start justify-between gap-3">

      <div>
        <div className="flex items-center gap-2">

          <span className="font-mono text-[7px] text-cyan-300/35">
            {code}
          </span>

          <span className="h-px w-4 bg-white/[0.08]" />

          <span className="font-mono text-[7px] uppercase tracking-[0.16em] text-white/20">
            MODULE
          </span>

        </div>

        <h2 className="mt-1 text-sm font-semibold">
          {title}
        </h2>

        <p className="mt-0.5 font-mono text-[7px] text-white/20">
          {subtitle}
        </p>
      </div>

      {count !== undefined && (
        <span className="rounded-full border border-cyan-300/10 bg-cyan-300/[0.025] px-2 py-1 font-mono text-[7px] text-cyan-200/50">
          {String(count).padStart(2, '0')}
        </span>
      )}

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
    <div className="rounded-lg border border-white/[0.05] bg-black/20 p-2.5">

      <p className="font-mono text-[7px] uppercase tracking-wider text-white/20">
        {label}
      </p>

      <p
        className={`mt-1 font-mono text-xs font-semibold ${
          danger
            ? 'text-red-300/80'
            : positive
              ? 'text-emerald-300/70'
              : 'text-white/65'
        }`}
      >
        {value}
      </p>

    </div>
  )
}

function Empty({
  text,
}: {
  text: string
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.06] bg-black/10 p-4 text-center font-mono text-[8px] tracking-wider text-white/15">
      {text}
    </div>
  )
}

/* ========================================================================== */
/* HELPERS                                                                    */
/* ========================================================================== */

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
  })
}

function collectionRate(
  paid: number,
  total: number,
) {
  if (total <= 0) {
    return 0
  }

  return (paid / total) * 100
}