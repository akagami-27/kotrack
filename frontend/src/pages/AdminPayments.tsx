import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiRequest } from '../api/client'
import { useAuth } from '../auth/AuthContext'

type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED'

type Payment = {
  id: number
  user_id: number
  amount: string | number
  status: PaymentStatus
  created_at: string
  confirmed_at: string | null
  confirmed_by: number | null
}

export default function AdminPayments() {
  const { user } = useAuth()

  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadPayments() {
    try {
      setError('')

      const data = await apiRequest<Payment[]>(
        '/api/payments',
      )

      setPayments(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load payments.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadPayments()
    } else {
      setLoading(false)
    }
  }, [user?.role])

  async function handleAction(
    paymentId: number,
    action: 'confirm' | 'reject',
  ) {
    setProcessingId(paymentId)
    setError('')
    setSuccess('')

    try {
      await apiRequest<Payment>(
        `/api/payments/${paymentId}/${action}`,
        {
          method: 'POST',
        },
      )

      setSuccess(
        action === 'confirm'
          ? `Payment #${paymentId} confirmed.`
          : `Payment #${paymentId} rejected.`,
      )

      await loadPayments()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to ${action} payment.`,
      )
    } finally {
      setProcessingId(null)
    }
  }

  const pendingPayments = payments.filter(
    (payment) => payment.status === 'PENDING',
  )

  const confirmedPayments = payments.filter(
    (payment) => payment.status === 'CONFIRMED',
  )

  const rejectedPayments = payments.filter(
    (payment) => payment.status === 'REJECTED',
  )

  const pendingAmount = pendingPayments.reduce(
    (total, payment) =>
      total + Number(payment.amount),
    0,
  )

  const confirmedAmount = confirmedPayments.reduce(
    (total, payment) =>
      total + Number(payment.amount),
    0,
  )

  if (user?.role !== 'ADMIN') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070910] px-6 text-white">
        <div className="text-center">

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
    <main className="min-h-screen bg-[#070910] text-white">

      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <Link
            to="/admin"
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <span className="font-bold">K</span>
            </div>

            <div>
              <p className="text-sm font-semibold">
                KoTrack
              </p>

              <p className="text-[10px] uppercase tracking-wider text-white/30">
                Admin
              </p>
            </div>
          </Link>

          <Link
            to="/admin"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/50 transition hover:bg-white/[0.06] hover:text-white"
          >
            Admin Dashboard
          </Link>

        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">

        {/* Heading */}
        <section>
          <p className="text-xs uppercase tracking-[0.16em] text-white/30">
            Administration
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Payment Management
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
            Review user payments and confirm or reject
            submitted payments.
          </p>
        </section>

        {/* Summary */}
        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            label="Total payments"
            value={String(payments.length)}
            description="All submitted payments"
          />

          <StatCard
            label="Pending"
            value={String(pendingPayments.length)}
            description={`RM ${pendingAmount.toFixed(2)} awaiting review`}
          />

          <StatCard
            label="Confirmed"
            value={String(confirmedPayments.length)}
            description={`RM ${confirmedAmount.toFixed(2)} confirmed`}
          />

          <StatCard
            label="Rejected"
            value={String(rejectedPayments.length)}
            description="Rejected payments"
          />

        </section>

        {/* Messages */}
        {success && (
          <div className="mt-6 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.05] px-5 py-4">
            <p className="text-sm text-emerald-300">
              {success}
            </p>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-400/10 bg-red-400/[0.05] px-5 py-4">
            <p className="text-sm text-red-300">
              {error}
            </p>
          </div>
        )}

        {/* Payments */}
        <section className="mt-6 rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-xs uppercase tracking-wider text-white/30">
                Payments
              </p>

              <h2 className="mt-2 text-lg font-semibold">
                All submitted payments
              </h2>
            </div>

            <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-xs text-white/40">
              {pendingPayments.length} pending
            </span>

          </div>

          {loading ? (
            <div className="py-12 text-center">
              <p className="text-sm text-white/35">
                Loading payments...
              </p>
            </div>
          ) : payments.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/10 p-10 text-center">
              <p className="text-sm text-white/50">
                No payments found.
              </p>

              <p className="mt-2 text-xs text-white/25">
                Submitted payments will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {payments.map((payment) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  processing={
                    processingId === payment.id
                  }
                  onConfirm={() =>
                    handleAction(
                      payment.id,
                      'confirm',
                    )
                  }
                  onReject={() =>
                    handleAction(
                      payment.id,
                      'reject',
                    )
                  }
                />
              ))}
            </div>
          )}

        </section>

        {/* Security notice */}
        <section className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">

          <div className="flex gap-4">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
              <span className="text-sm">i</span>
            </div>

            <div>
              <h3 className="text-sm font-medium">
                Administrator controls
              </h3>

              <p className="mt-1 text-xs leading-5 text-white/35">
                Only administrator accounts can access this
                page and confirm or reject payments. Payment
                status is controlled by the backend.
              </p>
            </div>

          </div>

        </section>

      </div>
    </main>
  )
}


/* -------------------------------------------------------------------------- */
/* Payment row                                                                */
/* -------------------------------------------------------------------------- */

function PaymentRow({
  payment,
  processing,
  onConfirm,
  onReject,
}: {
  payment: Payment
  processing: boolean
  onConfirm: () => void
  onReject: () => void
}) {
  const createdDate = new Date(
    payment.created_at,
  ).toLocaleString('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const canReview =
    payment.status === 'PENDING'

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-5">

      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-3">

            <p className="text-sm font-medium">
              Payment #{payment.id}
            </p>

            <StatusBadge
              status={payment.status}
            />

          </div>

          <div className="mt-2 space-y-1">

            <p className="text-xs text-white/35">
              User ID: {payment.user_id}
            </p>

            <p className="text-xs text-white/25">
              Submitted: {createdDate}
            </p>

            {payment.confirmed_by !== null && (
              <p className="text-xs text-white/25">
                Reviewed by admin ID:{' '}
                {payment.confirmed_by}
              </p>
            )}

          </div>

        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">

          <p className="text-xl font-semibold">
            RM {Number(payment.amount).toFixed(2)}
          </p>

          {canReview && (
            <div className="flex gap-2">

              <button
                type="button"
                onClick={onReject}
                disabled={processing}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-medium text-white/50 transition hover:bg-red-400/[0.06] hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {processing
                  ? 'Processing...'
                  : 'Reject'}
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={processing}
                className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {processing
                  ? 'Processing...'
                  : 'Confirm'}
              </button>

            </div>
          )}

        </div>

      </div>

    </div>
  )
}


/* -------------------------------------------------------------------------- */
/* Status badge                                                               */
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


/* -------------------------------------------------------------------------- */
/* Stat card                                                                  */
/* -------------------------------------------------------------------------- */

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
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">

      <p className="text-xs uppercase tracking-wider text-white/30">
        {label}
      </p>

      <p className="mt-4 text-2xl font-semibold">
        {value}
      </p>

      <p className="mt-1 text-xs text-white/30">
        {description}
      </p>

    </div>
  )
}