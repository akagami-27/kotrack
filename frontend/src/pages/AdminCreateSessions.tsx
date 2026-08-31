import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { apiRequest } from '../api/client'
import { useAuth } from '../auth/AuthContext'

type User = {
  id: number
  name: string
  role: string
  is_active: boolean
}

type DrinkSessionResponse = {
  id: number
  session_date: string
  packets_used: string | number
  price_per_packet: string | number
  total_cost: string | number
  created_by: number
}

export default function AdminCreateSession() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [date, setDate] = useState('')
  const [packets, setPackets] = useState('1')
  const [price, setPrice] = useState('25.00')

  const [users, setUsers] = useState<User[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])

  const [loadingUsers, setLoadingUsers] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState('')
  const [createdSession, setCreatedSession] =
    useState<DrinkSessionResponse | null>(null)

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

  function toggleParticipant(userId: number) {
    setSelectedUserIds((current) => {
      if (current.includes(userId)) {
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
    const packetPrice = Number(price)

    if (
      !Number.isFinite(packetAmount) ||
      packetAmount <= 0
    ) {
      setError('Packets used must be greater than 0.')
      return
    }

    if (
      !Number.isFinite(packetPrice) ||
      packetPrice <= 0
    ) {
      setError('Price per packet must be greater than 0.')
      return
    }

    if (selectedUserIds.length === 0) {
      setError('Please select at least one participant.')
      return
    }

    setSubmitting(true)

    try {
      const response =
        await apiRequest<DrinkSessionResponse>(
          '/api/sessions',
          {
            method: 'POST',
            body: JSON.stringify({
              session_date: date,
              packets_used: packetAmount,
              price_per_packet: packetPrice,
              participant_user_ids: selectedUserIds,
            }),
          },
        )

      setCreatedSession(response)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create session.',
      )
    } finally {
      setSubmitting(false)
    }
  }

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

  if (createdSession) {
    return (
      <main className="min-h-screen bg-[#070910] text-white">
        <div className="relative flex min-h-screen items-center justify-center px-6">

          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/[0.06] blur-[150px]" />
          </div>

          <div className="relative z-10 w-full max-w-lg">

            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-8 text-center backdrop-blur-xl sm:p-10">

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.06] text-emerald-300">
                <CheckIcon />
              </div>

              <p className="mt-6 text-[10px] uppercase tracking-[0.2em] text-emerald-300/70">
                Session created
              </p>

              <h1 className="mt-3 text-2xl font-semibold tracking-tight">
                Session created successfully
              </h1>

              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/35">
                The session has been created and the participant
                costs were calculated by the backend.
              </p>

              <div className="mt-8 rounded-2xl border border-white/[0.06] bg-black/10 p-5 text-left">

                <SummaryRow
                  label="Session ID"
                  value={`#${createdSession.id}`}
                />

                <div className="my-4 border-t border-white/[0.05]" />

                <SummaryRow
                  label="Date"
                  value={createdSession.session_date}
                />

                <div className="my-4 border-t border-white/[0.05]" />

                <SummaryRow
                  label="Packets"
                  value={String(createdSession.packets_used)}
                />

                <div className="my-4 border-t border-white/[0.05]" />

                <SummaryRow
                  label="Price per packet"
                  value={`RM ${Number(
                    createdSession.price_per_packet,
                  ).toFixed(2)}`}
                />

                <div className="my-4 border-t border-white/[0.05]" />

                <SummaryRow
                  label="Total cost"
                  value={`RM ${Number(
                    createdSession.total_cost,
                  ).toFixed(2)}`}
                />

                <div className="my-4 border-t border-white/[0.05]" />

                <SummaryRow
                  label="Participants"
                  value={`${selectedUserIds.length} people`}
                />

              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">

                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="flex-1 rounded-xl bg-white py-3 text-xs font-semibold text-black transition hover:bg-white/90"
                >
                  Admin dashboard
                </button>

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
    <main className="min-h-screen bg-[#070910] text-white">

      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 lg:py-14">

        <div className="mb-8">

          <Link
            to="/admin"
            className="text-xs text-white/30 transition hover:text-white"
          >
            ← Back to admin dashboard
          </Link>

          <p className="mt-8 text-xs uppercase tracking-[0.16em] text-white/30">
            Session management
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Create a session
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-white/35">
            Create a drink session directly as an administrator.
            The backend will calculate the total cost and each
            participant's amount owed.
          </p>

        </div>

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
                Packets used
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
            </div>

            {/* Price */}
            <div className="sm:col-span-2">

              <label
                htmlFor="price"
                className="mb-2 block text-xs font-medium text-white/55"
              >
                Price per packet
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/25">
                  RM
                </span>

                <input
                  id="price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={price}
                  onChange={(event) =>
                    setPrice(event.target.value)
                  }
                  required
                  disabled={submitting}
                  className="w-full rounded-xl border border-white/[0.08] bg-black/20 py-3 pl-12 pr-4 text-sm text-white outline-none transition focus:border-white/20 disabled:opacity-50"
                />
              </div>

              <p className="mt-2 text-[10px] text-white/20">
                This is the packet price used by the backend
                to calculate the session total.
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

                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() =>
                            toggleParticipant(account.id)
                          }
                          disabled={submitting}
                          className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                            selected
                              ? 'border-white/20 bg-white/[0.07]'
                              : 'border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.04]'
                          } disabled:cursor-not-allowed disabled:opacity-50`}
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

                              {account.id === user?.id && (
                                <p className="mt-0.5 text-[10px] text-white/25">
                                  You
                                </p>
                              )}
                            </div>

                          </div>

                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                              selected
                                ? 'border-white/30 bg-white text-black'
                                : 'border-white/15 bg-transparent'
                            }`}
                          >
                            {selected && <CheckSmallIcon />}
                          </div>

                        </button>
                      )
                    })}

                  </div>
                )}

              </div>

              <p className="mt-2 text-[10px] text-white/20">
                Select everyone who will drink during this session.
              </p>

            </div>

          </div>

          <div className="my-7 border-t border-white/[0.06]" />

          {/* Calculation notice */}
          <div className="rounded-2xl border border-violet-400/10 bg-violet-400/[0.035] p-5">

            <p className="text-[10px] uppercase tracking-[0.15em] text-violet-300/60">
              Automatic calculation
            </p>

            <p className="mt-2 text-sm leading-6 text-white/45">
              KoTrack calculates the session total from packets
              and price per packet, then divides the total equally
              between the selected participants.
            </p>

          </div>

          {/* Summary */}
          <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/10 p-5">

            <p className="text-[10px] uppercase tracking-[0.15em] text-white/20">
              Session summary
            </p>

            <div className="mt-4 space-y-3">

              <SummaryRow
                label="Date"
                value={date || 'Not selected'}
              />

              <SummaryRow
                label="Packets"
                value={packets}
              />

              <SummaryRow
                label="Price per packet"
                value={`RM ${Number(price || 0).toFixed(2)}`}
              />

              <SummaryRow
                label="Participants"
                value={
                  selectedUserIds.length > 0
                    ? `${selectedUserIds.length} people`
                    : 'None selected'
                }
              />

            </div>

          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

            <Link
              to="/admin"
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
                ? 'Creating session...'
                : 'Create session'}
            </button>

          </div>

        </form>

      </div>

    </main>
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