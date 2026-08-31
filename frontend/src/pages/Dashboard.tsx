import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiRequest } from '../api/client'
import { useAuth } from '../auth/AuthContext'

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

  const [balance, setBalance] =
    useState<Balance | null>(null)

  const [sessions, setSessions] =
    useState<DrinkSession[]>([])

  const [payments, setPayments] =
    useState<Payment[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadDashboard() {
      try {
        setError('')

        const [
          balanceData,
          sessionData,
          paymentData,
        ] = await Promise.all([
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

  const currentUserId = user?.id

  const displayName =
    user?.name ?? 'User'

  const avatar =
    user?.avatar_data ?? null

  const userSessions = sessions
    .filter((session) =>
      session.participants.some(
        (participant) =>
          participant.user_id === currentUserId,
      ),
    )
    .sort(
      (a, b) =>
        new Date(b.session_date).getTime() -
        new Date(a.session_date).getTime(),
    )

  const pendingPayments = payments.filter(
    (payment) =>
      payment.status === 'PENDING',
  )

  const pendingPaymentAmount =
    pendingPayments.reduce(
      (total, payment) =>
        total + Number(payment.amount),
      0,
    )

  const currentBalance = Number(
    balance?.balance ?? 0,
  )

  const totalOwed = Number(
    balance?.total_owed ?? 0,
  )

  const totalConfirmedPayments = Number(
    balance?.total_confirmed_payments ?? 0,
  )

  return (
    <main className="min-h-screen bg-[#070910] text-white">

      {/* Header */}
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">

          {/* Brand */}
          <Link
            to="/"
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <span className="font-bold">
                K
              </span>
            </div>

            <div>
              <p className="text-sm font-semibold">
                KoTrack
              </p>

              <p className="text-[10px] uppercase tracking-wider text-white/25">
                Dashboard
              </p>
            </div>
          </Link>

          {/* Header actions */}
          <div className="flex items-center gap-2">

            {/* User profile */}
            <Link
              to="/profile"
              className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 transition hover:bg-white/[0.07] sm:flex"
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  className="h-6 w-6 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.08] text-[10px] font-semibold text-white/70">
                  {displayName
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}

              <span className="max-w-[120px] truncate text-xs text-white/60">
                {displayName}
              </span>
            </Link>

            {/* Mobile profile */}
            <Link
              to="/profile"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] sm:hidden"
              aria-label="Profile"
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  className="h-7 w-7 rounded-lg object-cover"
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
                className="rounded-xl border border-violet-400/10 bg-violet-400/[0.05] px-4 py-2 text-xs text-violet-300 transition hover:bg-violet-400/[0.10]"
              >
                Admin
              </Link>
            )}

            {/* Payments */}
            <Link
              to="/payments"
              className="hidden rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/50 transition hover:bg-white/[0.07] hover:text-white sm:block"
            >
              Payments
            </Link>

            {/* Logout */}
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/50 transition hover:border-red-400/20 hover:bg-red-400/[0.06] hover:text-red-300"
            >
              Logout
            </button>

          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">

        {/* Greeting */}
        <section>
          <div className="flex items-center gap-4">

            {avatar ? (
              <img
                src={avatar}
                alt="Profile avatar"
                className="h-14 w-14 rounded-2xl border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl font-semibold text-white/70">
                {displayName
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-white/25">
                Overview
              </p>

              <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                Welcome back, {displayName}.
              </h1>
            </div>

          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/35">
            Keep track of your drink sessions, balances, and
            payments.
          </p>

          {/* Mobile actions */}
          <div className="mt-5 flex gap-2 sm:hidden">

            <Link
              to="/profile"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/50 transition hover:bg-white/[0.07] hover:text-white"
            >
              Profile
            </Link>

            <Link
              to="/payments"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/50 transition hover:bg-white/[0.07] hover:text-white"
            >
              Payments
            </Link>

          </div>
        </section>

        {/* Loading */}
        {loading && (
          <section className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-8 text-center">
            <p className="text-sm text-white/35">
              Loading your dashboard...
            </p>
          </section>
        )}

        {/* Error */}
        {!loading && error && (
          <section className="mt-10 rounded-2xl border border-red-400/10 bg-red-400/[0.05] p-5">
            <p className="text-sm font-medium text-red-300">
              Unable to load dashboard
            </p>

            <p className="mt-2 text-xs text-red-300/60">
              {error}
            </p>
          </section>
        )}

        {/* Dashboard */}
        {!loading && !error && (
          <>
            {/* Financial overview */}
            <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

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
                positive={totalConfirmedPayments > 0}
              />

              <StatCard
                label="Pending payments"
                value={`RM ${pendingPaymentAmount.toFixed(2)}`}
                description={`${pendingPayments.length} awaiting confirmation`}
              />

            </section>

            {/* Main content */}
            <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">

              {/* Sessions */}
              <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6">

                <div className="flex items-center justify-between">

                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/25">
                      Activity
                    </p>

                    <h2 className="mt-2 text-lg font-semibold">
                      Your recent sessions
                    </h2>
                  </div>

                  <Link
                    to="/sessions"
                    className="text-xs text-white/35 transition hover:text-white"
                  >
                    View all
                  </Link>

                </div>

                {userSessions.length === 0 ? (
                  <EmptyState message="You have not participated in any sessions yet." />
                ) : (
                  <div className="mt-6 space-y-3">

                    {userSessions
                      .slice(0, 5)
                      .map((session) => {
                        const participant =
                          session.participants.find(
                            (item) =>
                              item.user_id === currentUserId,
                          )

                        return (
                          <SessionRow
                            key={session.id}
                            session={session}
                            amountOwed={
                              participant?.amount_owed ?? 0
                            }
                          />
                        )
                      })}

                  </div>
                )}

              </section>

              {/* Payments */}
              <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6">

                <div className="flex items-center justify-between">

                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/25">
                      Payments
                    </p>

                    <h2 className="mt-2 text-lg font-semibold">
                      Recent payments
                    </h2>
                  </div>

                  <Link
                    to="/payments"
                    className="text-xs text-white/35 transition hover:text-white"
                  >
                    View all
                  </Link>

                </div>

                {payments.length === 0 ? (
                  <EmptyState message="No payments submitted yet." />
                ) : (
                  <div className="mt-6 space-y-3">

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

            {/* Quick actions */}
            <section className="mt-6 grid gap-4 md:grid-cols-3">

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

            </section>

            {/* Balance explanation */}
            <section className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">

              <div className="flex gap-4">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white/50">
                  i
                </div>

                <div>
                  <h3 className="text-sm font-medium">
                    Balance calculation
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-white/30">
                    Your balance is calculated by the backend
                    from your session amounts owed minus confirmed
                    payments. Pending payments do not reduce the
                    balance until an administrator confirms them.
                  </p>
                </div>

              </div>

            </section>
          </>
        )}

      </div>
    </main>
  )
}


/* -------------------------------------------------------------------------- */
/* Components                                                                 */
/* -------------------------------------------------------------------------- */

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
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">

      <div className="flex items-center justify-between">

        <p className="text-xs uppercase tracking-wider text-white/30">
          {label}
        </p>

        {warning && (
          <span className="rounded-full border border-amber-400/10 bg-amber-400/[0.06] px-2 py-1 text-[9px] text-amber-300">
            Due
          </span>
        )}

        {positive && (
          <span className="rounded-full border border-emerald-400/10 bg-emerald-400/[0.06] px-2 py-1 text-[9px] text-emerald-300">
            Clear
          </span>
        )}

      </div>

      <p className="mt-4 text-2xl font-semibold tracking-tight">
        {value}
      </p>

      <p className="mt-1 text-xs text-white/30">
        {description}
      </p>

    </div>
  )
}


function SessionRow({
  session,
  amountOwed,
}: {
  session: DrinkSession
  amountOwed: string | number
}) {
  const date = new Date(
    `${session.session_date}T00:00:00`,
  ).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/10 p-4">

      <div>
        <p className="text-sm font-medium">
          Session #{session.id}
        </p>

        <p className="mt-1 text-xs text-white/30">
          {date} · {session.packets_used} packets
        </p>
      </div>

      <div className="text-right">

        <p className="text-sm font-semibold">
          RM {Number(amountOwed).toFixed(2)}
        </p>

        <p className="mt-1 text-[10px] text-white/25">
          Your share
        </p>

      </div>

    </div>
  )
}


function PaymentRow({
  payment,
}: {
  payment: Payment
}) {
  const date = new Date(
    payment.created_at,
  ).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/10 p-4">

      <div>

        <div className="flex items-center gap-2">

          <p className="text-sm font-medium">
            Payment #{payment.id}
          </p>

          <StatusBadge
            status={payment.status}
          />

        </div>

        <p className="mt-1 text-xs text-white/25">
          {date}
        </p>

      </div>

      <p className="text-sm font-semibold">
        RM {Number(payment.amount).toFixed(2)}
      </p>

    </div>
  )
}


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
      className={`rounded-full border px-2 py-0.5 text-[9px] ${classes}`}
    >
      {status}
    </span>
  )
}


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
      className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 transition hover:border-white/[0.14] hover:bg-white/[0.04]"
    >

      <p className="text-sm font-medium">
        {title}
      </p>

      <p className="mt-2 text-xs leading-5 text-white/30">
        {description}
      </p>

      <p className="mt-4 text-xs text-white/40">
        Open →
      </p>

    </Link>
  )
}


function EmptyState({
  message,
}: {
  message: string
}) {
  return (
    <div className="mt-6 rounded-xl border border-white/[0.05] bg-black/10 p-6 text-center">
      <p className="text-xs text-white/30">
        {message}
      </p>
    </div>
  )
}