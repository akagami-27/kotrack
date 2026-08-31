import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'

import { apiRequest } from '../api/client'
import { useAuth } from '../auth/AuthContext'

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
  receipt_filename?: string | null
  receipt_url?: string | null
}

const MAX_RECEIPT_SIZE = 25 * 1024 * 1024

export default function Payments() {
  const { user, logout } = useAuth()

  const [balance, setBalance] =
    useState<Balance | null>(null)

  const [payments, setPayments] =
    useState<Payment[]>([])

  const [amount, setAmount] =
    useState('')

  const [receipt, setReceipt] =
    useState<File | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [submitting, setSubmitting] =
    useState(false)

  const [error, setError] =
    useState('')

  const [success, setSuccess] =
    useState('')

  async function loadPaymentPage() {
    try {
      setError('')

      const [balanceData, paymentData] =
        await Promise.all([
          apiRequest<Balance>(
            '/api/balance/me',
          ),
          apiRequest<Payment[]>(
            '/api/payments/me',
          ),
        ])

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
    void loadPaymentPage()
  }, [])

  function handleReceiptChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0] ?? null

    setError('')
    setSuccess('')

    if (!file) {
      setReceipt(null)
      return
    }

    if (file.size <= 0) {
      setReceipt(null)
      setError(
        'The selected receipt file is empty.',
      )
      event.target.value = ''
      return
    }

    if (file.size > MAX_RECEIPT_SIZE) {
      setReceipt(null)
      setError(
        'Receipt file must not exceed 25 MB.',
      )
      event.target.value = ''
      return
    }

    setReceipt(file)
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const form = event.currentTarget

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

    if (!receipt) {
      setError(
        'Please upload your payment receipt.',
      )
      return
    }

    setSubmitting(true)

    try {
      const formData = new FormData()

      formData.append(
        'amount',
        paymentAmount.toFixed(2),
      )

      formData.append(
        'receipt',
        receipt,
      )

      await apiRequest<Payment>(
        '/api/payments',
        {
          method: 'POST',
          body: formData,
        },
      )

      setAmount('')
      setReceipt(null)
      form.reset()

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

  const totalOwed = Number(
    balance?.total_owed ?? 0,
  )

  const displayName =
    user?.name ?? 'Account'

  const avatar =
    user?.avatar_data ?? null

  return (
    <main className="min-h-screen bg-[#070910] text-white">
      {/* HEADER */}

      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-20 sm:px-8">
          <Link
            to="/dashboard"
            className="flex min-w-0 items-center gap-2.5"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] sm:h-9 sm:w-9 sm:rounded-xl">
              <span className="text-sm font-bold">
                K
              </span>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold sm:text-sm">
                KoTrack
              </p>

              <p className="text-[8px] uppercase tracking-[0.14em] text-white/25 sm:text-[10px]">
                Payments
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/profile"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] sm:h-auto sm:w-auto sm:gap-2 sm:px-3 sm:py-2"
              aria-label="Profile"
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-6 w-6 rounded-lg object-cover"
                />
              ) : (
                <span className="text-[10px] font-semibold text-white/60 sm:flex sm:h-6 sm:w-6 sm:items-center sm:justify-center sm:rounded-lg sm:bg-white/[0.08]">
                  {displayName
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}

              <span className="hidden max-w-[100px] truncate text-xs text-white/55 sm:block">
                {displayName}
              </span>
            </Link>

            <Link
              to="/dashboard"
              className="hidden rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/50 transition hover:bg-white/[0.07] hover:text-white sm:block"
            >
              Dashboard
            </Link>

            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] text-white/50 transition hover:border-red-400/20 hover:bg-red-400/[0.06] hover:text-red-300 sm:px-4 sm:text-xs"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* PAGE */}

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-8 sm:py-8">
        {/* TITLE */}

        <section>
          <p className="text-[9px] uppercase tracking-[0.15em] text-white/25 sm:text-[10px]">
            Account
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:mt-2 sm:text-4xl">
            Payments
          </h1>

          <p className="mt-1.5 max-w-xl text-[10px] leading-4 text-white/30 sm:mt-2 sm:text-xs sm:leading-5">
            Submit payments and monitor their
            confirmation status.
          </p>
        </section>

        {/* LOADING */}

        {loading && (
          <section className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-6 text-center">
            <p className="text-xs text-white/35">
              Loading payments...
            </p>
          </section>
        )}

        {!loading && (
          <>
            {/* ======================================================
                BALANCE SUMMARY
                MOBILE: 2 x 2
                DESKTOP: 4 x 1
               ====================================================== */}

            <section className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-6 sm:gap-3 lg:grid-cols-4">
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
                value={`RM ${totalOwed.toFixed(2)}`}
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

            {/* ERROR */}

            {error && (
              <section className="mt-3 rounded-xl border border-red-400/10 bg-red-400/[0.04] px-3 py-2.5">
                <p className="text-[10px] text-red-300 sm:text-xs">
                  {error}
                </p>
              </section>
            )}

            {/* ======================================================
                SUBMIT PAYMENT
               ====================================================== */}

            <section className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 sm:mt-5 sm:rounded-2xl sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[8px] uppercase tracking-[0.14em] text-white/25 sm:text-[10px]">
                    New payment
                  </p>

                  <h2 className="mt-1 text-sm font-semibold sm:text-base">
                    Submit a payment
                  </h2>

                  <p className="mt-1 text-[9px] leading-4 text-white/30 sm:text-[10px] sm:leading-5">
                    Enter the amount and upload your
                    receipt.
                  </p>
                </div>

                <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] sm:flex">
                  <ReceiptIcon />
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="mt-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* AMOUNT */}

                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-medium text-white/45 sm:text-[11px]">
                      Payment amount
                    </span>

                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/25">
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
                        className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 py-2.5 pl-10 pr-3 text-xs text-white outline-none transition placeholder:text-white/15 focus:border-white/20 disabled:opacity-50 sm:text-sm"
                      />
                    </div>
                  </label>

                  {/* RECEIPT */}

                  <div>
                    <label
                      htmlFor="payment-receipt"
                      className="mb-1.5 block text-[10px] font-medium text-white/45 sm:text-[11px]"
                    >
                      Payment receipt
                    </label>

                    <label
                      htmlFor="payment-receipt"
                      className={`flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-xl border border-dashed border-white/[0.10] bg-black/20 px-3 py-2 transition hover:border-white/[0.20] hover:bg-white/[0.03] ${
                        submitting
                          ? 'cursor-not-allowed opacity-50'
                          : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[10px] text-white/65 sm:text-xs">
                          {receipt
                            ? receipt.name
                            : 'Choose receipt'}
                        </p>

                        <p className="mt-0.5 truncate text-[8px] text-white/20 sm:text-[9px]">
                          {receipt
                            ? formatFileSize(
                                receipt.size,
                              )
                            : 'Maximum 25 MB'}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[9px] text-white/50 sm:text-[10px]">
                        Browse
                      </span>

                      <input
                        id="payment-receipt"
                        name="receipt"
                        type="file"
                        onChange={
                          handleReceiptChange
                        }
                        disabled={submitting}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* SUBMIT */}

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !amount ||
                    !receipt
                  }
                  className="mt-3 min-h-10 w-full rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:px-5 sm:text-sm"
                >
                  {submitting
                    ? 'Submitting...'
                    : 'Submit payment'}
                </button>
              </form>

              {/* SUCCESS */}

              {success && (
                <div className="mt-3 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.05] px-3 py-2.5">
                  <p className="text-[10px] text-emerald-300 sm:text-xs">
                    {success}
                  </p>
                </div>
              )}
            </section>

            {/* ======================================================
                PAYMENT HISTORY
                MOBILE: 2 COLUMNS
               ====================================================== */}

            <section className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 sm:mt-5 sm:rounded-2xl sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[8px] uppercase tracking-[0.14em] text-white/25 sm:text-[10px]">
                    History
                  </p>

                  <h2 className="mt-1 text-sm font-semibold sm:text-base">
                    Your payments
                  </h2>
                </div>

                <span className="text-[9px] text-white/25">
                  {payments.length}{' '}
                  {payments.length === 1
                    ? 'record'
                    : 'records'}
                </span>
              </div>

              {payments.length === 0 ? (
                <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/10 p-5 text-center">
                  <p className="text-xs text-white/45">
                    No payments yet.
                  </p>

                  <p className="mt-1 text-[9px] text-white/20">
                    Submitted payments will appear here.
                  </p>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3 lg:grid-cols-3">
                  {payments.map((payment) => (
                    <PaymentCard
                      key={payment.id}
                      payment={payment}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* INFORMATION */}

            <section className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:mt-5 sm:rounded-2xl sm:p-4">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-[10px] text-white/45">
                  i
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-white/55 sm:text-xs">
                    Payment confirmation
                  </p>

                  <p className="mt-1 text-[8px] leading-4 text-white/25 sm:text-[10px] sm:leading-5">
                    New payments start as pending.
                    Only an administrator can confirm
                    or reject them. Confirmed payments
                    are included in your balance.
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

/* ================================================================
   SUMMARY CARD
   ================================================================ */

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
    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 sm:rounded-2xl sm:p-4">
      <div className="flex min-w-0 items-center justify-between gap-1">
        <p className="truncate text-[8px] uppercase tracking-[0.1em] text-white/25 sm:text-[10px]">
          {label}
        </p>

        {emphasis === 'warning' && (
          <span className="shrink-0 rounded-full border border-amber-400/10 bg-amber-400/[0.06] px-1.5 py-0.5 text-[7px] text-amber-300 sm:text-[8px]">
            Due
          </span>
        )}

        {emphasis === 'positive' && (
          <span className="shrink-0 rounded-full border border-emerald-400/10 bg-emerald-400/[0.06] px-1.5 py-0.5 text-[7px] text-emerald-300 sm:text-[8px]">
            Paid
          </span>
        )}
      </div>

      <p className="mt-2 truncate text-xl font-semibold tracking-tight text-white sm:mt-3 sm:text-2xl">
        {value}
      </p>

      <p className="mt-0.5 truncate text-[9px] text-white/25 sm:text-[10px]">
        {description}
      </p>
    </div>
  )
}

/* ================================================================
   PAYMENT CARD
   ================================================================ */

function PaymentCard({
  payment,
}: {
  payment: Payment
}) {
  const createdDate = new Date(
    payment.created_at,
  ).toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const createdTime = new Date(
    payment.created_at,
  ).toLocaleTimeString('en-MY', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const hasReceipt =
    Boolean(payment.receipt_filename) ||
    Boolean(payment.receipt_url)

  return (
    <article className="min-w-0 rounded-xl border border-white/[0.06] bg-black/10 p-2.5 sm:rounded-2xl sm:p-3.5">
      {/* TOP */}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[9px] font-medium text-white/55 sm:text-[10px]">
            Payment #{payment.id}
          </p>

          <p className="mt-0.5 truncate text-[7px] text-white/20 sm:text-[8px]">
            {createdDate} · {createdTime}
          </p>
        </div>

        <StatusBadge
          status={payment.status}
        />
      </div>

      {/* AMOUNT */}

      <div className="mt-2.5 border-t border-white/[0.05] pt-2.5">
        <p className="text-[7px] uppercase tracking-[0.1em] text-white/20 sm:text-[8px]">
          Amount
        </p>

        <p className="mt-0.5 truncate text-sm font-semibold text-white/80 sm:text-base">
          RM {Number(payment.amount).toFixed(2)}
        </p>
      </div>

      {/* RECEIPT */}

      <div className="mt-2 flex min-w-0 items-center gap-1.5">
        <ReceiptIcon />

        {hasReceipt ? (
          <p
            className="truncate text-[8px] text-white/35 sm:text-[9px]"
            title={
              payment.receipt_filename ??
              'Receipt available'
            }
          >
            {payment.receipt_filename ??
              'Receipt available'}
          </p>
        ) : (
          <p className="truncate text-[8px] text-white/20 sm:text-[9px]">
            No receipt
          </p>
        )}
      </div>

      {/* REVIEWED */}

      {payment.confirmed_at && (
        <p className="mt-1.5 truncate text-[7px] text-white/20 sm:text-[8px]">
          Reviewed{' '}
          {new Date(
            payment.confirmed_at,
          ).toLocaleDateString('en-MY', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      )}
    </article>
  )
}

/* ================================================================
   STATUS BADGE
   ================================================================ */

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
      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[7px] ${classes} sm:px-2 sm:py-1 sm:text-[8px]`}
    >
      {status}
    </span>
  )
}

/* ================================================================
   FILE SIZE
   ================================================================ */

function formatFileSize(
  bytes: number,
) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`
}

/* ================================================================
   RECEIPT ICON
   ================================================================ */

function ReceiptIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className="shrink-0 text-white/30"
    >
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
    </svg>
  )
}