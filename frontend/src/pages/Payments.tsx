import { useEffect, useState, type FormEvent } from 'react'
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

type PaymentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'

type Payment = {
  id: number
  user_id: number
  amount: string | number
  status: PaymentStatus
  created_at: string
  confirmed_at: string | null
  confirmed_by: number | null
}

export default function Payments() {
  const { user, logout } = useAuth()

  const [profile, setProfile] =
    useState<UserProfile | null>(null)

  const [balance, setBalance] =
    useState<Balance | null>(null)

  const [payments, setPayments] =
    useState<Payment[]>([])

  const [amount, setAmount] = useState('')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] =
    useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadPaymentPage() {
    try {
      setError('')

      const [
        profileData,
        balanceData,
        paymentData,
      ] = await Promise.all([
        apiRequest<UserProfile>(
          '/api/users/me',
        ),
        apiRequest<Balance>(
          '/api/balance/me',
        ),
        apiRequest<Payment[]>(
          '/api/payments/me',
        ),
      ])

      setProfile(profileData)
      setBalance(balanceData)
      setPayments(paymentData)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load payment information.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPaymentPage()
  }, [])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError('')
    setSuccess('')

    const paymentAmount = Number(amount)

    if (
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0
    ) {
      setError(
        'Payment amount must be greater than RM 0.',
      )
      return
    }

    setSubmitting(true)

    try {
      await apiRequest<Payment>(
        '/api/payments',
        {
          method: 'POST',
          body: JSON.stringify({
            amount: paymentAmount,
          }),
        },
      )

      setAmount('')

      setSuccess(
        'Payment submitted successfully. It is now pending confirmation.',
      )

      await loadPaymentPage()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit payment.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const totalPending = payments
    .filter(
      (payment) =>
        payment.status === 'PENDING',
    )
    .reduce(
      (total, payment) =>
        total + Number(payment.amount),
      0,
    )

  const totalConfirmed = payments
    .filter(
      (payment) =>
        payment.status === 'CONFIRMED',
    )
    .reduce(
      (total, payment) =>
        total + Number(payment.amount),
      0,
    )

  const currentBalance = Number(
    balance?.balance ?? 0,
  )

  const displayName =
    profile?.name ??
    user?.name ??
    'Account'

  const avatar =
    profile?.avatar_data ?? null

  return (
    <main className="min-h-screen bg-[#070910] text-white">

      {/* Header */}
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">

          <Link
            to="/dashboard"
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
                Payments
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">

            {/* Profile */}
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

            {/* Dashboard */}
            <Link
              to="/dashboard"
              className="hidden rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/50 transition hover:bg-white/[0.07] hover:text-white sm:block"
            >
              Dashboard
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

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">

        {/* Heading */}
        <section>
          <p className="text-xs uppercase tracking-[0.16em] text-white/25">
            Account
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Payments
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/35">
            Submit payments and monitor their confirmation
            status.
          </p>
        </section>

        {/* Loading */}
        {loading && (
          <section className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-8 text-center">
            <p className="text-sm text-white/35">
              Loading payments...
            </p>
          </section>
        )}

        {/* Error */}
        {!loading && error && (
          <section className="mt-8 rounded-2xl border border-red-400/10 bg-red-400/[0.05] p-5">
            <p className="text-sm font-medium text-red-300">
              Payment request failed
            </p>

            <p className="mt-1 text-xs text-red-300/60">
              {error}
            </p>
          </section>
        )}

        {!loading && (
          <>

            {/* Balance */}
            <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <SummaryCard
                label="Current balance"
                value={`RM ${currentBalance.toFixed(2)}`}
                description={
                  currentBalance > 0
                    ? 'Still owed'
                    : 'No outstanding balance'
                }
                emphasis={
                  currentBalance > 0
                    ? 'warning'
                    : 'normal'
                }
              />

              <SummaryCard
                label="Total owed"
                value={`RM ${Number(
                  balance?.total_owed ?? 0,
                ).toFixed(2)}`}
                description="From drink sessions"
              />

              <SummaryCard
                label="Confirmed"
                value={`RM ${totalConfirmed.toFixed(2)}`}
                description="Payments confirmed"
                emphasis={
                  totalConfirmed > 0
                    ? 'positive'
                    : 'normal'
                }
              />

              <SummaryCard
                label="Pending"
                value={`RM ${totalPending.toFixed(2)}`}
                description="Awaiting confirmation"
              />

            </section>

            {/* Submit */}
            <section className="mt-6 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6">

              <p className="text-xs uppercase tracking-[0.14em] text-white/25">
                New payment
              </p>

              <h2 className="mt-2 text-lg font-semibold">
                Submit a payment
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/35">
                Enter the amount you paid. The payment will remain
                pending until an administrator reviews it.
              </p>

              <form
                onSubmit={handleSubmit}
                className="mt-6"
              >
                <label
                  htmlFor="payment-amount"
                  className="block text-xs font-medium text-white/50"
                >
                  Payment amount
                </label>

                <div className="mt-2 flex flex-col gap-3 sm:flex-row">

                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/25">
                      RM
                    </span>

                    <input
                      id="payment-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(event) =>
                        setAmount(
                          event.target.value,
                        )
                      }
                      placeholder="0.00"
                      disabled={submitting}
                      className="w-full rounded-xl border border-white/[0.08] bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/15 focus:border-white/20 disabled:opacity-50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      !amount
                    }
                    className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting
                      ? 'Submitting...'
                      : 'Submit payment'}
                  </button>

                </div>
              </form>

              {success && (
                <div className="mt-4 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.05] px-4 py-3">
                  <p className="text-xs text-emerald-300">
                    {success}
                  </p>
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-xl border border-red-400/10 bg-red-400/[0.05] px-4 py-3">
                  <p className="text-xs text-red-300">
                    {error}
                  </p>
                </div>
              )}

            </section>

            {/* History */}
            <section className="mt-6 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6">

              <div className="flex items-center justify-between gap-4">

                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-white/25">
                    History
                  </p>

                  <h2 className="mt-2 text-lg font-semibold">
                    Your payments
                  </h2>
                </div>

                <Link
                  to="/profile"
                  className="text-xs text-white/35 transition hover:text-white"
                >
                  {displayName}
                </Link>

              </div>

              {payments.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/10 p-8 text-center">
                  <p className="text-sm text-white/50">
                    No payments yet.
                  </p>

                  <p className="mt-2 text-xs text-white/25">
                    Your submitted payments will appear here.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-3">

                  {payments.map((payment) => (
                    <PaymentRow
                      key={payment.id}
                      payment={payment}
                    />
                  ))}

                </div>
              )}

            </section>

            {/* Information */}
            <section className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">

              <div className="flex gap-4">

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-xs text-white/50">
                  i
                </div>

                <div>
                  <p className="text-sm font-medium text-white/60">
                    Payment confirmation
                  </p>

                  <p className="mt-1 text-xs leading-5 text-white/25">
                    New payments start as pending. Only an
                    administrator can confirm or reject them.
                    Confirmed payments are then included in your
                    balance calculation.
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
/* Summary card                                                               */
/* -------------------------------------------------------------------------- */

function SummaryCard({
  label,
  value,
  description,
  emphasis = 'normal',
}: {
  label: string
  value: string
  description: string
  emphasis?: 'normal' | 'warning' | 'positive'
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">

      <div className="flex items-center justify-between">

        <p className="text-xs uppercase tracking-[0.12em] text-white/25">
          {label}
        </p>

        {emphasis === 'warning' && (
          <span className="rounded-full border border-amber-400/10 bg-amber-400/[0.06] px-2 py-1 text-[9px] text-amber-300">
            Due
          </span>
        )}

        {emphasis === 'positive' && (
          <span className="rounded-full border border-emerald-400/10 bg-emerald-400/[0.06] px-2 py-1 text-[9px] text-emerald-300">
            Confirmed
          </span>
        )}

      </div>

      <p className="mt-4 text-2xl font-semibold">
        {value}
      </p>

      <p className="mt-1 text-xs text-white/25">
        {description}
      </p>

    </div>
  )
}


/* -------------------------------------------------------------------------- */
/* Payment row                                                                */
/* -------------------------------------------------------------------------- */

function PaymentRow({
  payment,
}: {
  payment: Payment
}) {
  const createdDate =
    new Date(
      payment.created_at,
    ).toLocaleString('en-MY', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-black/10 p-4 sm:flex-row sm:items-center sm:justify-between">

      <div className="min-w-0">

        <div className="flex flex-wrap items-center gap-3">

          <p className="text-sm font-medium">
            Payment #{payment.id}
          </p>

          <StatusBadge
            status={payment.status}
          />

        </div>

        <p className="mt-1 text-xs text-white/25">
          Submitted {createdDate}
        </p>

        {payment.confirmed_at && (
          <p className="mt-1 text-xs text-white/20">
            Reviewed{' '}
            {new Date(
              payment.confirmed_at,
            ).toLocaleString('en-MY', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        )}

      </div>

      <p className="text-lg font-semibold">
        RM {Number(
          payment.amount,
        ).toFixed(2)}
      </p>

    </div>
  )
}


/* -------------------------------------------------------------------------- */
/* Status                                                                      */
/* -------------------------------------------------------------------------- */

function StatusBadge({
  status,
}: {
  status: PaymentStatus
}) {
  const classes =
    status === 'CONFIRMED'
      ? 'border-emerald-400/10 bg-emerald-400/[0.06] text-emerald-300'
      : status === 'REJECTED'
        ? 'border-red-400/10 bg-red-400/[0.06] text-red-300'
        : 'border-yellow-400/10 bg-yellow-400/[0.06] text-yellow-300'

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] ${classes}`}
    >
      {status}
    </span>
  )
}