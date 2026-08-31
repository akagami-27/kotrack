import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiRequest } from '../api/client'
import { useAuth } from '../auth/AuthContext'

type UserProfile = {
  id: number
  name: string
  role: string
  is_active: boolean
  created_at: string
  avatar_data: string | null
}

type Balance = {
  user_id: number
  total_owed: string | number
  total_confirmed_payments: string | number
  balance: string | number
}

type SessionParticipant = {
  id: number
  user_id: number
  amount_owed: string | number
}

type DrinkSession = {
  id: number
  session_date: string
  packets_used: string | number
  price_per_packet: string | number
  total_cost: string | number
  created_by: number
  created_at: string
  participants: SessionParticipant[]
}

type Payment = {
  id: number
  user_id: number
  amount: string | number
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
  created_at: string
  confirmed_at: string | null
  confirmed_by: number | null
}

export default function Dashboard() {
  const { user, logout } = useAuth()

  const [profile, setProfile] =
    useState<UserProfile | null>(null)

  const [balance, setBalance] =
    useState<Balance | null>(null)

  const [sessions, setSessions] =
    useState<DrinkSession[]>([])

  const [payments, setPayments] =
    useState<Payment[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  useEffect(() => {
    async function loadDashboard() {
      try {
        setError('')

        const [
          profileData,
          balanceData,
          sessionData,
          paymentData,
        ] = await Promise.all([
          apiRequest<UserProfile>(
            '/api/users/me',
          ),
          apiRequest<Balance>(
            '/api/balance/me',
          ),
          apiRequest<DrinkSession[]>(
            '/api/sessions',
          ),
          apiRequest<Payment[]>(
            '/api/payments/me',
          ),
        ])

        setProfile(profileData)
        setBalance(balanceData)
        setSessions(sessionData)
        setPayments(paymentData)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load dashboard.',
        )
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const currentUserId =
    profile?.id ?? user?.id

  const displayName =
    profile?.name ??
    user?.name ??
    'User'

  const avatar =
    profile?.avatar_data ?? null

  const userSessions = sessions
    .filter((session) =>
      session.participants.some(
        (participant) =>
          participant.user_id === currentUserId,
      ),
    )
    .sort(
      (a, b) =>
        new Date(
          b.session_date,
        ).getTime() -
        new Date(
          a.session_date,
        ).getTime(),
    )

  const pendingPayments =
    payments.filter(
      (payment) =>
        payment.status === 'PENDING',
    )

  const pendingPaymentAmount =
    pendingPayments.reduce(
      (total, payment) =>
        total + Number(payment.amount),
      0,
    )

  const currentBalance =
    Number(balance?.balance ?? 0)

  const totalOwed =
    Number(balance?.total_owed ?? 0)

  const totalConfirmedPayments =
    Number(
      balance?.total_confirmed_payments ?? 0,
    )

  return (
    <main className="min-h-screen bg-[#070910] text-white">

      {/* Header */}
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-8">

          <Link
            to="/"
            className="flex items-center gap-2.5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
              <span className="text-sm font-bold">
                K
              </span>
            </div>

            <div>
              <p className="text-sm font-semibold leading-none">
                KoTrack
              </p>

              <p className="mt-1 text-[9px] uppercase tracking-wider text-white/25">
                Dashboard
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">

            {/* Desktop profile */}
            <Link
              to="/profile"
              className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:bg-white/[0.07] sm:flex"
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  className="h-6 w-6 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.08] text-[10px] font-semibold text-white/70">
                  {displayName
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}

              <span className="max-w-[110px] truncate text-xs text-white/60">
                {displayName}
              </span>
            </Link>

            {/* Mobile profile */}
            <Link
              to="/profile"
              aria-label="Profile"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] sm:hidden"
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  className="h-6 w-6 rounded-md object-cover"
                />
              ) : (
                <span className="text-xs font-semibold text-white/60">
                  {displayName
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}
            </Link>

            {/* Admin */}
            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                className="rounded-lg border border-violet-400/10 bg-violet-400/[0.05] px-2.5 py-1.5 text-[10px] text-violet-300 transition hover:bg-violet-400/[0.10] sm:px-3 sm:text-xs"
              >
                Admin
              </Link>
            )}

            {/* Payments */}
            <Link
              to="/payments"
              className="hidden rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/50 transition hover:bg-white/[0.07] hover:text-white sm:block"
            >
              Payments
            </Link>

            {/* Logout */}
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-white/50 transition hover:border-red-400/20 hover:bg-red-400/[0.06] hover:text-red-300 sm:px-3 sm:text-xs"
            >
              Logout
            </button>

          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">

        {/* Greeting */}
        <section>
          <div className="flex items-center gap-3">

            {avatar ? (
              <img
                src={avatar}
                alt="Profile avatar"
                className="h-11 w-11 rounded-xl border border-white/10 object-cover sm:h-12 sm:w-12"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-lg font-semibold text-white/70 sm:h-12 sm:w-12">
                {displayName
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-[0.16em] text-white/25">
                Overview
              </p>

              <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">
                Welcome back, {displayName}.
              </h1>
            </div>
          </div>

          <p className="mt-2 text-xs leading-5 text-white/35 sm:text-sm">
            Keep track of your drink sessions,
            balances, and payments.
          </p>

          {/* Mobile navigation */}
          <div className="mt-3 flex gap-2 sm:hidden">
            <Link
              to="/sessions"
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] text-white/50 transition hover:bg-white/[0.07] hover:text-white"
            >
              Sessions
            </Link>

            <Link
              to="/payments"
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] text-white/50 transition hover:bg-white/[0.07] hover:text-white"
            >
              Payments
            </Link>
          </div>
        </section>

        {/* Loading */}
        {loading && (
          <section className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-6 text-center">
            <p className="text-xs text-white/35">
              Loading your dashboard...
            </p>
          </section>
        )}

        {/* Error */}
        {!loading && error && (
          <section className="mt-6 rounded-2xl border border-red-400/10 bg-red-400/[0.05] p-4">
            <p className="text-sm font-medium text-red-300">
              Unable to load dashboard
            </p>

            <p className="mt-1 text-xs text-red-300/60">
              {error}
            </p>
          </section>
        )}

        {!loading && !error && (
          <>

            {/* Financial overview */}
            <section className="mt-6 grid grid-cols-2 gap-2.5 sm:mt-8 sm:gap-3 lg:grid-cols-4">

              <StatCard
                label="Current balance"
                value={`RM ${currentBalance.toFixed(2)}`}
                description={
                  currentBalance > 0
                    ? 'Amount currently owed'
                    : 'No outstanding balance'
                }
                warning={currentBalance > 0}
              />

              <StatCard
                label="Total owed"
                value={`RM ${totalOwed.toFixed(2)}`}
                description="Total session amounts owed"
              />

              <StatCard
                label="Confirmed payments"
                value={`RM ${totalConfirmedPayments.toFixed(2)}`}
                description="Payments confirmed by admin"
                positive={
                  totalConfirmedPayments > 0
                }
              />

              <StatCard
                label="Pending payments"
                value={`RM ${pendingPaymentAmount.toFixed(2)}`}
                description={`${pendingPayments.length} awaiting confirmation`}
              />

            </section>

            {/* Recent activity */}
            <section className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-[1.4fr_1fr]">

              {/* Sessions */}
              <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">

                <div className="flex items-center justify-between">

                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-white/25">
                      Activity
                    </p>

                    <h2 className="mt-1 text-base font-semibold">
                      Your recent sessions
                    </h2>
                  </div>

                  <Link
                    to="/sessions"
                    className="text-[10px] text-white/35 transition hover:text-white"
                  >
                    View all
                  </Link>

                </div>

                {userSessions.length === 0 ? (
                  <EmptyState message="You have not participated in any sessions yet." />
                ) : (
                  <div className="mt-3 space-y-2">
                    {userSessions
                      .slice(0, 5)
                      .map((session) => {
                        const participant =
                          session.participants.find(
                            (item) =>
                              item.user_id ===
                              currentUserId,
                          )

                        return (
                          <SessionRow
                            key={session.id}
                            session={session}
                            amountOwed={
                              participant?.amount_owed ??
                              0
                            }
                          />
                        )
                      })}
                  </div>
                )}

              </section>

              {/* Payments */}
              <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">

                <div className="flex items-center justify-between">

                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-white/25">
                      Payments
                    </p>

                    <h2 className="mt-1 text-base font-semibold">
                      Recent payments
                    </h2>
                  </div>

                  <Link
                    to="/payments"
                    className="text-[10px] text-white/35 transition hover:text-white"
                  >
                    View all
                  </Link>
                </div>

                {payments.length === 0 ? (
                  <EmptyState message="No payments submitted yet." />
                ) : (
                  <div className="mt-3 space-y-2">
                    {payments
                      .slice(0, 5)
                      .map((payment) => (
                        <PaymentRow
                          key={payment.id}
                          payment={payment}
                        />
                      ))}
                  </div>
                )}

              </section>
            </section>

            {/* ============================================================ */}
            {/* 2 × 2 ACTION GRID                                             */}
            {/* ============================================================ */}

            <section className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:gap-3">

              <ActionCard
                title="Request a session"
                description="Ask an admin to create a new drink session."
                to="/sessions/new"
              />

              <ActionCard
                title="Submit payment"
                description="Record a payment for your outstanding balance."
                to="/payments"
              />

              <ActionCard
                title="View profile"
                description="Manage your name, avatar, and account information."
                to="/profile"
              />

              {/* Balance calculation */}
              <BalanceCard />

            </section>

          </>
        )}

      </div>
    </main>
  )
}


/* ============================================================================
   STAT CARD
============================================================================ */

function StatCard({
  label,
  value,
  description,
  warning = false,
  positive = false,
}: {
  label: string
  value: string
  description: string
  warning?: boolean
  positive?: boolean
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 sm:rounded-2xl sm:p-4">

      <div className="flex min-h-[18px] items-center justify-between gap-1">

        <p className="truncate text-[8px] uppercase tracking-wider text-white/30 sm:text-[9px]">
          {label}
        </p>

        {warning && (
          <span className="shrink-0 rounded-full border border-amber-400/10 bg-amber-400/[0.06] px-1.5 py-0.5 text-[7px] text-amber-300">
            Due
          </span>
        )}

        {positive && (
          <span className="shrink-0 rounded-full border border-emerald-400/10 bg-emerald-400/[0.06] px-1.5 py-0.5 text-[7px] text-emerald-300">
            Clear
          </span>
        )}

      </div>

      <p className="mt-2 text-lg font-semibold tracking-tight sm:mt-3 sm:text-xl">
        {value}
      </p>

      <p className="mt-0.5 truncate text-[9px] text-white/30 sm:text-[10px]">
        {description}
      </p>

    </div>
  )
}


/* ============================================================================
   SESSION ROW
============================================================================ */

function SessionRow({
  session,
  amountOwed,
}: {
  session: DrinkSession
  amountOwed: string | number
}) {
  const date =
    new Date(
      `${session.session_date}T00:00:00`,
    ).toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2.5">

      <div className="min-w-0">
        <p className="text-xs font-medium">
          Session #{session.id}
        </p>

        <p className="mt-0.5 truncate text-[9px] text-white/30">
          {date} · {session.packets_used} packets
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-xs font-semibold">
          RM {Number(amountOwed).toFixed(2)}
        </p>

        <p className="mt-0.5 text-[8px] text-white/25">
          Your share
        </p>
      </div>

    </div>
  )
}


/* ============================================================================
   PAYMENT ROW
============================================================================ */

function PaymentRow({
  payment,
}: {
  payment: Payment
}) {
  const date =
    new Date(
      payment.created_at,
    ).toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2.5">

      <div className="min-w-0">

        <div className="flex items-center gap-1.5">

          <p className="truncate text-xs font-medium">
            Payment #{payment.id}
          </p>

          <StatusBadge
            status={payment.status}
          />

        </div>

        <p className="mt-0.5 text-[9px] text-white/25">
          {date}
        </p>

      </div>

      <p className="shrink-0 text-xs font-semibold">
        RM {Number(payment.amount).toFixed(2)}
      </p>

    </div>
  )
}


/* ============================================================================
   PAYMENT STATUS
============================================================================ */

function StatusBadge({
  status,
}: {
  status: Payment['status']
}) {
  const classes =
    status === 'CONFIRMED'
      ? 'border-emerald-400/10 bg-emerald-400/[0.06] text-emerald-300'
      : status === 'REJECTED'
        ? 'border-red-400/10 bg-red-400/[0.06] text-red-300'
        : 'border-yellow-400/10 bg-yellow-400/[0.06] text-yellow-300'

  return (
    <span
      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[7px] ${classes}`}
    >
      {status}
    </span>
  )
}


/* ============================================================================
   ACTION CARD
============================================================================ */

function ActionCard({
  title,
  description,
  to,
}: {
  title: string
  description: string
  to: string
}) {
  return (
    <Link
      to={to}
      className="flex min-h-[105px] flex-col rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 transition hover:border-white/[0.14] hover:bg-white/[0.04] sm:min-h-[125px] sm:rounded-2xl sm:p-4"
    >

      <p className="text-xs font-medium sm:text-sm">
        {title}
      </p>

      <p className="mt-1.5 text-[9px] leading-4 text-white/30 sm:mt-2 sm:text-[10px] sm:leading-5">
        {description}
      </p>

      <p className="mt-auto pt-2 text-[9px] text-white/40 sm:pt-3 sm:text-[10px]">
        Open →
      </p>

    </Link>
  )
}


/* ============================================================================
   BALANCE CARD
============================================================================ */

function BalanceCard() {
  return (
    <section className="flex min-h-[105px] flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:min-h-[125px] sm:rounded-2xl sm:p-4">

      <div className="flex items-start gap-2.5">

        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-xs text-white/50">
          i
        </div>

        <div className="min-w-0">

          <h3 className="text-xs font-medium sm:text-sm">
            Balance calculation
          </h3>

          <p className="mt-1.5 text-[9px] leading-4 text-white/30 sm:text-[10px] sm:leading-5">
            Your balance is calculated from
            session amounts owed minus
            confirmed payments.
          </p>

        </div>

      </div>

    </section>
  )
}


/* ============================================================================
   EMPTY STATE
============================================================================ */

function EmptyState({
  message,
}: {
  message: string
}) {
  return (
    <div className="mt-3 rounded-lg border border-white/[0.05] bg-black/10 p-4 text-center">

      <p className="text-[10px] text-white/30">
        {message}
      </p>

    </div>
  )
}