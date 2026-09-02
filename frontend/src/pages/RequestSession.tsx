import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { apiRequest } from '../api/client'

type User = {
  id: number
  name: string
  role: string
  is_active: boolean
}

type SessionRequestResponse = {
  id: number
  status: string
}

export default function RequestSession() {
  const { user } = useAuth()

  const [date, setDate] = useState('')
  const [packets, setPackets] = useState('1')
  const [note, setNote] = useState('')

  const [users, setUsers] = useState<User[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])

  const [loadingUsers, setLoadingUsers] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [requestId, setRequestId] = useState<number | null>(null)

  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await apiRequest<User[]>('/api/users')

        setUsers(
          data.filter((account) => account.is_active),
        )
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load users.',
        )
      } finally {
        setLoadingUsers(false)
      }
    }

    loadUsers()
  }, [])

  // Always include the currently logged-in user.
  useEffect(() => {
    if (user) {
      setSelectedUserIds((current) =>
        current.includes(user.id)
          ? current
          : [user.id, ...current],
      )
    }
  }, [user])

  function toggleParticipant(userId: number) {
    setSelectedUserIds((current) => {
      if (current.includes(userId)) {
        // Prevent the requester from removing themselves.
        if (userId === user?.id) {
          return current
        }

        return current.filter((id) => id !== userId)
      }

      return [...current, userId]
    })
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError('')

    if (!date) {
      setError('Please select a session date.')
      return
    }

    const packetAmount = Number(packets)

    if (
      !Number.isFinite(packetAmount) ||
      packetAmount <= 0
    ) {
      setError('Packets used must be greater than 0.')
      return
    }

    if (selectedUserIds.length === 0) {
      setError('Please select at least one participant.')
      return
    }

    if (!user) {
      setError('You must be logged in to submit a request.')
      return
    }

    if (!selectedUserIds.includes(user.id)) {
      setError('You must be included as a participant.')
      return
    }

    setSubmitting(true)

    try {
      const response =
        await apiRequest<SessionRequestResponse>(
          '/api/session-requests',
          {
            method: 'POST',
            body: JSON.stringify({
              session_date: date,
              packets_used: packetAmount,
              participant_user_ids: selectedUserIds,
              note: note.trim() || null,
            }),
          },
        )

      setRequestId(response.id)
      setSubmitted(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit session request.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <main
        className="min-h-screen bg-[#070910] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white"
      >
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/[0.06] blur-[150px]" />
          </div>

          <div className="relative z-10 w-full max-w-lg">
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-8 text-center backdrop-blur-xl sm:p-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.06] text-emerald-300">
                <CheckIcon />
              </div>

              <p className="mt-6 text-[10px] uppercase tracking-[0.2em] text-emerald-300/70">
                Request submitted
              </p>

              <h1 className="mt-3 text-2xl font-semibold tracking-tight">
                Session request received
              </h1>

              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/35">
                Your request has been sent to an administrator.
                The session will only become active after it has
                been reviewed and approved.
              </p>

              <div className="mt-8 rounded-2xl border border-white/[0.06] bg-black/10 p-5 text-left">
                {requestId !== null && (
                  <>
                    <SummaryRow
                      label="Request ID"
                      value={`#${requestId}`}
                    />

                    <div className="my-4 border-t border-white/[0.05]" />
                  </>
                )}

                <SummaryRow
                  label="Requested by"
                  value={user?.name ?? 'You'}
                />

                <div className="my-4 border-t border-white/[0.05]" />

                <SummaryRow
                  label="Date"
                  value={date}
                />

                <div className="my-4 border-t border-white/[0.05]" />

                <SummaryRow
                  label="Packets"
                  value={packets}
                />

                <div className="my-4 border-t border-white/[0.05]" />

                <SummaryRow
                  label="Participants"
                  value={`${selectedUserIds.length} people`}
                />

                <div className="my-4 border-t border-white/[0.05]" />

                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-white/25">
                    Status
                  </span>

                  <span className="rounded-full border border-amber-400/10 bg-amber-400/[0.06] px-2.5 py-1 text-[9px] text-amber-300">
                    Pending approval
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/dashboard"
                  className="flex-1 rounded-xl bg-white py-3 text-xs font-semibold text-black transition hover:bg-white/90"
                >
                  Back to dashboard
                </Link>

                <Link
                  to="/sessions"
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] py-3 text-xs font-medium text-white/55 transition hover:bg-white/[0.07] hover:text-white"
                >
                  View sessions
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main
      className="min-h-screen bg-[#070910] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white"
    >
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-white/[0.06] lg:flex lg:flex-col">
          <div className="flex h-20 items-center border-b border-white/[0.06] px-6">
            <Link
              to="/dashboard"
              className="flex items-center gap-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                <span className="text-sm font-bold">K</span>
              </div>

              <span className="font-semibold tracking-tight">
                KoTrack
              </span>
            </Link>
          </div>

          <nav className="flex-1 px-3 py-6">
            <p className="mb-3 px-3 text-[10px] uppercase tracking-[0.18em] text-white/20">
              Workspace
            </p>

            <NavLink
              to="/dashboard"
              icon={<DashboardIcon />}
              label="Dashboard"
            />

            <NavLink
              to="/sessions"
              icon={<SessionIcon />}
              label="Sessions"
            />

            <NavLink
              to="/payments"
              icon={<WalletIcon />}
              label="Payments"
            />

            <div className="my-6 border-t border-white/[0.06]" />

            <p className="mb-3 px-3 text-[10px] uppercase tracking-[0.18em] text-white/20">
              Account
            </p>

            <NavLink
              to="/profile"
              icon={<UserIcon />}
              label="Profile"
            />

            <NavLink
              to="/settings"
              icon={<SettingsIcon />}
              label="Settings"
            />
          </nav>

          <div className="border-t border-white/[0.06] p-4">
            <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-xs font-semibold">
                {(user?.name ?? 'User').charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white/70">
                  {user?.name ?? 'User'}
                </p>

                <p className="mt-0.5 text-[10px] text-white/25">
                  User ID: #{user?.id ?? '—'}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1">
          <header className="flex h-20 items-center border-b border-white/[0.06] px-5 sm:px-8 lg:px-10">
            <Link
              to="/sessions"
              className="mr-4 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-white/35 transition hover:text-white"
              aria-label="Back to sessions"
            >
              <ArrowLeftIcon />
            </Link>

            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/25">
                Sessions
              </p>

              <h1 className="mt-1 text-sm font-medium text-white/80">
                Request a session
              </h1>
            </div>
          </header>

          <section className="mx-auto max-w-3xl px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
            <div className="mb-8">
              <p className="text-sm text-white/30">
                Start a new request
              </p>

              <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                Request a drink session
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-white/35">
                Choose the people who will participate in the
                session. An administrator will review your request
                before the session becomes active.
              </p>
            </div>

            {/* Admin notice */}
            <div className="mb-6 flex gap-4 rounded-2xl border border-violet-400/10 bg-violet-400/[0.035] p-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/10 bg-violet-400/[0.05] text-violet-300">
                <ShieldIcon />
              </div>

              <div>
                <p className="text-sm font-medium text-white/65">
                  Admin approval required
                </p>

                <p className="mt-1 text-xs leading-5 text-white/30">
                  The participant list you submit will be reviewed
                  by an administrator before the session is created.
                </p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="mb-6 rounded-xl border border-red-400/10 bg-red-400/[0.06] px-4 py-3 text-sm leading-5 text-red-300"
              >
                {error}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6 backdrop-blur-xl sm:p-8"
            >
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Date */}
                <div>
                  <label
                    htmlFor="session-date"
                    className="mb-2 block text-xs font-medium text-white/55"
                  >
                    Session date
                  </label>

                  <input
                    id="session-date"
                    type="date"
                    value={date}
                    onChange={(event) =>
                      setDate(event.target.value)
                    }
                    required
                    disabled={submitting}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-white/20 disabled:opacity-50"
                  />
                </div>

                {/* Packets */}
                <div>
                  <label
                    htmlFor="packets"
                    className="mb-2 block text-xs font-medium text-white/55"
                  >
                    Estimated packets
                  </label>

                  <input
                    id="packets"
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={packets}
                    onChange={(event) =>
                      setPackets(event.target.value)
                    }
                    required
                    disabled={submitting}
                    className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-white/20 disabled:opacity-50"
                  />

                  <p className="mt-2 text-[10px] text-white/20">
                    The final cost is calculated by the backend.
                  </p>
                </div>

                {/* Participants */}
                <div className="sm:col-span-2">
                  <div className="mb-3 flex items-center justify-between">
                    <label className="block text-xs font-medium text-white/55">
                      Participants
                    </label>

                    <span className="text-[10px] text-white/25">
                      {selectedUserIds.length} selected
                    </span>
                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-3">
                    {loadingUsers ? (
                      <div className="px-3 py-5 text-center text-xs text-white/30">
                        Loading users...
                      </div>
                    ) : users.length === 0 ? (
                      <div className="px-3 py-5 text-center text-xs text-white/30">
                        No active users available.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {users.map((account) => {
                          const selected =
                            selectedUserIds.includes(account.id)

                          const isCurrentUser =
                            account.id === user?.id

                          return (
                            <button
                              key={account.id}
                              type="button"
                              onClick={() =>
                                toggleParticipant(account.id)
                              }
                              disabled={
                                submitting ||
                                isCurrentUser
                              }
                              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                                selected
                                  ? 'border-white/20 bg-white/[0.07]'
                                  : 'border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.04]'
                              } ${
                                isCurrentUser
                                  ? 'cursor-default'
                                  : ''
                              } disabled:opacity-70`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-semibold text-white/60">
                                  {account.name
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>

                                <div>
                                  <p className="text-sm text-white/70">
                                    {account.name}
                                  </p>

                                  <p className="mt-0.5 text-[10px] text-white/25">
                                    User ID: #{account.id}
                                    {isCurrentUser
                                      ? ' · You'
                                      : ''}
                                  </p>
                                </div>
                              </div>

                              <div
                                className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                                  selected
                                    ? 'border-white/30 bg-white text-black'
                                    : 'border-white/15 bg-transparent'
                                }`}
                              >
                                {selected && (
                                  <CheckSmallIcon />
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <p className="mt-2 text-[10px] text-white/20">
                    Select everyone who will drink during this
                    session. User IDs distinguish accounts with the
                    same name.
                  </p>
                </div>

                {/* Note */}
                <div className="sm:col-span-2">
                  <label
                    htmlFor="note"
                    className="mb-2 block text-xs font-medium text-white/55"
                  >
                    Note
                    <span className="ml-1 text-white/20">
                      Optional
                    </span>
                  </label>

                  <textarea
                    id="note"
                    value={note}
                    onChange={(event) =>
                      setNote(event.target.value)
                    }
                    rows={4}
                    placeholder="Add any useful information for the administrator..."
                    disabled={submitting}
                    className="w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/15 outline-none transition focus:border-white/20 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="my-7 border-t border-white/[0.06]" />

              {/* Summary */}
              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-5">
                <p className="text-[10px] uppercase tracking-[0.15em] text-white/20">
                  Request summary
                </p>

                <div className="mt-4 space-y-3">
                  <SummaryRow
                    label="Requester"
                    value={
                      user
                        ? `${user.name} · ID #${user.id}`
                        : 'You'
                    }
                  />

                  <SummaryRow
                    label="Date"
                    value={date || 'Not selected'}
                  />

                  <SummaryRow
                    label="Estimated packets"
                    value={packets}
                  />

                  <SummaryRow
                    label="Participants"
                    value={
                      selectedUserIds.length > 0
                        ? `${selectedUserIds.length} people`
                        : 'None selected'
                    }
                  />

                  <div className="my-3 border-t border-white/[0.05]" />

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-white/25">
                      Status after submission
                    </span>

                    <span className="rounded-full border border-amber-400/10 bg-amber-400/[0.06] px-2.5 py-1 text-[9px] text-amber-300">
                      Pending approval
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-col-reverse gap-3 pb-[env(safe-area-inset-bottom)] sm:flex-row sm:justify-end sm:pb-0">
                <Link
                  to="/sessions"
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-3 text-center text-xs font-medium text-white/45 transition hover:bg-white/[0.05] hover:text-white"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    loadingUsers ||
                    selectedUserIds.length === 0
                  }
                  className="rounded-xl bg-white px-6 py-3 text-xs font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting
                    ? 'Submitting request...'
                    : 'Submit request'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/* Components                                                                 */
/* -------------------------------------------------------------------------- */

function NavLink({
  to,
  icon,
  label,
}: {
  to: string
  icon: ReactNode
  label: string
}) {
  return (
    <Link
      to={to}
      className="mb-1 flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm text-white/35 transition hover:bg-white/[0.04] hover:text-white/70"
    >
      <span className="flex h-5 w-5 items-center justify-center">
        {icon}
      </span>

      {label}
    </Link>
  )
}

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-white/25">
        {label}
      </span>

      <span className="text-right text-xs font-medium text-white/60">
        {value}
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Icons                                                                      */
/* -------------------------------------------------------------------------- */

function DashboardIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  )
}

function SessionIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M6 3h12v18H6z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19v16H6.5A2.5 2.5 0 0 1 4 17.5z" />
      <path d="M4 7h15" />
      <path d="M15 13h4" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.4 3.1-5 7-5s6.2 1.6 7 5" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.2 3h-4.4l-.3 2.7a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.3 2.7h4.4l.3-2.7a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M12 3 19 6v5c0 4.5-2.7 8-7 10-4.3-2-7-5.5-7-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  )
}

function CheckSmallIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  )
}