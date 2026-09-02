import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { apiRequest } from '../api/client'
import { useAuth } from '../auth/AuthContext'

type SessionParticipant = {
  id: number
  user_id: number
  user_name: string
  amount_owed: string | number
}

type UserDirectoryEntry = {
  id: number
  name: string
  avatar_data: string | null
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

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function canModifySession(
  session: DrinkSession,
  currentUserId: number | undefined,
  isAdmin: boolean,
) {
  if (isAdmin) {
    return true
  }

  if (!currentUserId || session.created_by !== currentUserId) {
    return false
  }

  const today = new Date()
  const sessionDate = new Date(`${session.session_date}T00:00:00`)

  const ageInDays = Math.floor(
    (today.getTime() - sessionDate.getTime()) / 86400000,
  )

  return ageInDays >= 0 && ageInDays <= 3
}

export default function Sessions() {
  const { user } = useAuth()

  const [sessions, setSessions] = useState<DrinkSession[]>([])
  const [users, setUsers] = useState<UserDirectoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedSession, setSelectedSession] =
    useState<DrinkSession | null>(null)

  const [editingSession, setEditingSession] =
    useState<DrinkSession | null>(null)

  const [deletingSessionId, setDeletingSessionId] =
    useState<number | null>(null)

  const currentUserId = user?.id
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    let cancelled = false

    async function loadSessions() {
      setLoading(true)
      setError('')

      try {
        const [sessionData, userData] = await Promise.all([
          apiRequest<DrinkSession[]>('/api/sessions'),
          apiRequest<UserDirectoryEntry[]>('/api/users').catch(
            () => [] as UserDirectoryEntry[],
          ),
        ])

        if (cancelled) {
          return
        }

        setSessions(sessionData)
        setUsers(userData)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load sessions.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSessions()

    return () => {
      cancelled = true
    }
  }, [])

  const usersById = useMemo(() => {
    return new Map(
      users.map((account) => [account.id, account]),
    )
  }, [users])

  const totalPackets = useMemo(() => {
    return sessions.reduce(
      (total, session) =>
        total + Number(session.packets_used),
      0,
    )
  }, [sessions])

  const totalYourShare = useMemo(() => {
    return sessions.reduce((total, session) => {
      const participant = session.participants.find(
        (item) => item.user_id === currentUserId,
      )

      return (
        total +
        (participant
          ? Number(participant.amount_owed)
          : 0)
      )
    }, 0)
  }, [sessions, currentUserId])

  function handleSessionUpdated(updated: DrinkSession) {
    setSessions((current) =>
      current.map((session) =>
        session.id === updated.id
          ? updated
          : session,
      ),
    )

    setSelectedSession((current) =>
      current?.id === updated.id
        ? updated
        : current,
    )

    setEditingSession(null)
  }

  function handleSessionDeleted(id: number) {
    setSessions((current) =>
      current.filter((session) => session.id !== id),
    )

    setSelectedSession((current) =>
      current?.id === id
        ? null
        : current,
    )

    setDeletingSessionId(null)
  }

  if (selectedSession) {
    return (
      <>
        <SessionDetails
          session={selectedSession}
          currentUserId={currentUserId}
          currentUserName={user?.name}
          isAdmin={isAdmin}
          usersById={usersById}
          onBack={() => setSelectedSession(null)}
          onEdit={() =>
            setEditingSession(selectedSession)
          }
          onDelete={() =>
            setDeletingSessionId(selectedSession.id)
          }
        />

        {editingSession && (
          <EditSessionModal
            session={editingSession}
            users={users}
            onClose={() => setEditingSession(null)}
            onSaved={handleSessionUpdated}
          />
        )}

        {deletingSessionId !== null && (
          <DeleteSessionModal
            sessionId={deletingSessionId}
            onClose={() => setDeletingSessionId(null)}
            onDeleted={() =>
              handleSessionDeleted(deletingSessionId)
            }
          />
        )}
      </>
    )
  }

  return (
    <main
      className="min-h-[100dvh] bg-[#070910] text-white"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="min-h-[100dvh]">
        {/* HEADER */}

        <header
          className="flex min-h-16 items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:min-h-20 sm:px-8 sm:py-4 lg:px-10"
          style={{
            paddingTop:
              'max(0.75rem, env(safe-area-inset-top))',
          }}
        >
          <div>
            <p className="text-[9px] uppercase tracking-[0.15em] text-white/25 sm:text-[10px]">
              Workspace
            </p>

            <h1 className="mt-0.5 text-sm font-medium text-white/80">
              Sessions
            </h1>
          </div>

          <Link
            to="/dashboard"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-medium text-white/55 transition hover:bg-white/[0.07] hover:text-white sm:px-4 sm:py-2.5 sm:text-xs"
          >
            Back to dashboard
          </Link>
        </header>

        {/* CONTENT */}

        <section className="mx-auto max-w-6xl px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
          {/* TITLE */}

          <div>
            <p className="text-[10px] text-white/30 sm:text-xs">
              Your consumption history
            </p>

            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-4xl">
              Sessions
            </h2>

            <p className="mt-2 max-w-xl text-[10px] leading-4 text-white/35 sm:text-xs sm:leading-5">
              Review your drink sessions and the amount
              you owe for each one.
            </p>
          </div>

          {/* NEW SESSION */}

          <Link
            to="/sessions/new"
            className="mt-5 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-white/90 sm:mt-6 sm:min-h-11 sm:text-sm"
          >
            <span className="text-base leading-none">
              +
            </span>
            New session
          </Link>

          {/* =========================================================
              STATISTICS
              MOBILE: 2 x 2
              DESKTOP: 4 x 1
             ========================================================= */}

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-6 sm:gap-3 lg:grid-cols-4">
            <StatCard
              label="Total sessions"
              value={String(sessions.length)}
              description="Your recorded sessions"
            />

            <StatCard
              label="Total packets"
              value={formatNumber(totalPackets)}
              description="Packets across sessions"
            />

            <StatCard
              label="Your balance"
              value={`RM ${totalYourShare.toFixed(2)}`}
              description="Amount you currently owe"
              badge={
                totalYourShare > 0
                  ? 'Due'
                  : undefined
              }
            />

            <StatCard
              label="Your total"
              value={`RM ${totalYourShare.toFixed(2)}`}
              description="Your share across sessions"
              badge="Personal"
            />
          </div>

          {/* LOADING */}

          {loading && (
            <section className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-6 text-center sm:mt-5 sm:rounded-2xl">
              <p className="text-xs text-white/35">
                Loading sessions...
              </p>
            </section>
          )}

          {/* ERROR */}

          {!loading && error && (
            <section className="mt-4 rounded-xl border border-red-400/10 bg-red-400/[0.04] p-4 sm:mt-5 sm:rounded-2xl sm:p-5">
              <p className="text-xs font-medium text-red-300">
                Unable to load sessions
              </p>

              <p className="mt-1.5 text-[10px] leading-4 text-red-300/60 sm:text-xs">
                {error}
              </p>
            </section>
          )}

          {/* EMPTY */}

          {!loading &&
            !error &&
            sessions.length === 0 && (
              <section className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-6 text-center sm:mt-5 sm:rounded-2xl sm:p-8">
                <p className="text-sm font-medium text-white/60">
                  No sessions yet
                </p>

                <p className="mt-1.5 text-[10px] text-white/30 sm:text-xs">
                  Create a session to see it here.
                </p>

                <Link
                  to="/sessions/new"
                  className="mt-4 inline-flex rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black"
                >
                  Create session
                </Link>
              </section>
            )}

          {/* =========================================================
              SESSION HISTORY
              MOBILE: 2 x 2
              DESKTOP: 3 COLUMNS
             ========================================================= */}

          {!loading &&
            !error &&
            sessions.length > 0 && (
              <section className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 sm:mt-5 sm:rounded-2xl sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[8px] uppercase tracking-[0.14em] text-white/25 sm:text-[10px]">
                      History
                    </p>

                    <h3 className="mt-1 text-sm font-semibold sm:text-base">
                      Your sessions
                    </h3>
                  </div>

                  <span className="text-[9px] text-white/25 sm:text-[10px]">
                    {sessions.length}{' '}
                    {sessions.length === 1
                      ? 'record'
                      : 'records'}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3 lg:grid-cols-3">
                  {sessions.map((session) => {
                    const participant =
                      session.participants.find(
                        (item) =>
                          item.user_id ===
                          currentUserId,
                      )

                    const amountOwed = participant
                      ? Number(
                          participant.amount_owed,
                        )
                      : 0

                    return (
                      <SessionCard
                        key={session.id}
                        session={session}
                        amountOwed={amountOwed}
                        usersById={usersById}
                        onOpen={() =>
                          setSelectedSession(session)
                        }
                      />
                    )
                  })}
                </div>
              </section>
            )}

          {/* CALCULATION */}

          <section className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:mt-5 sm:rounded-2xl sm:p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
                <CalculatorIcon />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-medium text-white/55 sm:text-xs">
                  Balance calculation
                </p>

                <p className="mt-0.5 text-[8px] leading-4 text-white/25 sm:text-[10px] sm:leading-5">
                  Session total is calculated from
                  packets used and the fixed packet price.
                  Your share is divided between participants.
                </p>
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  )
}

/* ================================================================
   STAT CARD
   ================================================================ */

function StatCard({
  label,
  value,
  description,
  badge,
}: {
  label: string
  value: string
  description: string
  badge?: string
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 sm:rounded-2xl sm:p-4">
      <div className="flex min-w-0 items-center justify-between gap-1">
        <p className="truncate text-[8px] uppercase tracking-[0.1em] text-white/25 sm:text-[10px]">
          {label}
        </p>

        {badge && (
          <span
            className={
              badge === 'Due'
                ? 'shrink-0 rounded-full border border-amber-400/10 bg-amber-400/[0.07] px-1.5 py-0.5 text-[7px] text-amber-300 sm:text-[8px]'
                : 'shrink-0 rounded-full border border-emerald-400/10 bg-emerald-400/[0.07] px-1.5 py-0.5 text-[7px] text-emerald-300 sm:text-[8px]'
            }
          >
            {badge}
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
   SESSION CARD
   ================================================================ */

function SessionCard({
  session,
  amountOwed,
  usersById,
  onOpen,
}: {
  session: DrinkSession
  amountOwed: number
  usersById: Map<
    number,
    UserDirectoryEntry
  >
  onOpen: () => void
}) {
  const packets = Number(session.packets_used)
  const sessionTotal = Number(session.total_cost)

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition hover:border-white/[0.1] hover:bg-white/[0.035] sm:rounded-2xl sm:p-3.5">
      {/* MAIN SESSION AREA */}

      <button
        type="button"
        onClick={onOpen}
        className="block w-full min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      >
        {/* SESSION HEADER */}

        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.035] sm:h-9 sm:w-9">
            <CupIcon />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-[10px] font-semibold text-white/75 sm:text-xs">
                {formatNumber(packets)} packets
              </p>

              <span className="shrink-0 rounded-full border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[7px] text-white/30">
                {session.participants.length}
              </span>
            </div>

            <p className="mt-0.5 truncate text-[8px] text-white/25 sm:text-[9px]">
              {formatDate(session.session_date)}
            </p>
          </div>
        </div>

        {/* FINANCIAL DATA */}

        <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-white/[0.05] pt-2.5">
          <div className="min-w-0">
            <p className="truncate text-[7px] uppercase tracking-[0.1em] text-white/20 sm:text-[8px]">
              Session total
            </p>

            <p className="mt-0.5 truncate text-[10px] font-medium text-white/55 sm:text-xs">
              RM {sessionTotal.toFixed(2)}
            </p>
          </div>

          <div className="min-w-0 text-right">
            <p className="truncate text-[7px] uppercase tracking-[0.1em] text-white/20 sm:text-[8px]">
              Your share
            </p>

            <p className="mt-0.5 truncate text-[10px] font-semibold text-white/80 sm:text-xs">
              RM {amountOwed.toFixed(2)}
            </p>
          </div>
        </div>

        {/* PARTICIPANTS */}

        <div className="mt-2 flex min-w-0 items-center">
          <div className="flex -space-x-1.5">
            {session.participants
              .slice(0, 4)
              .map((participant) => {
                const account = usersById.get(
                  participant.user_id,
                )

                return (
                  <ParticipantAvatar
                    key={`${session.id}-${participant.user_id}`}
                    name={participant.user_name}
                    avatarData={
                      account?.avatar_data ?? null
                    }
                    size="sm"
                  />
                )
              })}
          </div>

          {session.participants.length > 4 && (
            <span className="ml-1.5 text-[7px] text-white/25">
              +{session.participants.length - 4}
            </span>
          )}
        </div>
      </button>

    </article>
  )
}

/* ================================================================
   SESSION DETAILS
   ================================================================ */

function SessionDetails({
  session,
  currentUserId,
  currentUserName,
  isAdmin,
  usersById,
  onBack,
  onEdit,
  onDelete,
}: {
  session: DrinkSession
  currentUserId?: number
  currentUserName?: string
  isAdmin: boolean
  usersById: Map<
    number,
    UserDirectoryEntry
  >
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const packets = Number(session.packets_used)

  const pricePerPacket = Number(
    session.price_per_packet,
  )

  const totalCost = Number(session.total_cost)

  const currentParticipant =
    session.participants.find(
      (participant) =>
        participant.user_id === currentUserId,
    )

  const canModify = canModifySession(
    session,
    currentUserId,
    isAdmin,
  )

  return (
    <main
      className="min-h-[100dvh] bg-[#070910] text-white"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <header
        className="flex min-h-16 items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:min-h-20 sm:px-8 sm:py-4 lg:px-10"
        style={{
          paddingTop:
            'max(0.75rem, env(safe-area-inset-top))',
        }}
      >
        <div>
          <p className="text-[9px] uppercase tracking-[0.15em] text-white/25 sm:text-[10px]">
            Workspace
          </p>

          <h1 className="mt-0.5 text-sm font-medium text-white/80">
            Session details
          </h1>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="min-h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-medium text-white/55 hover:bg-white/[0.07] hover:text-white sm:px-4 sm:text-xs"
        >
          Back to sessions
        </button>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 text-[10px] text-white/30 hover:text-white/70 sm:text-xs"
        >
          ← Sessions
        </button>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] text-white/30 sm:text-xs">
              Drink session
            </p>

            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-4xl">
              Session details
            </h2>

            <p className="mt-1 text-[10px] text-white/30 sm:text-xs">
              {formatDate(session.session_date)}
            </p>
          </div>

          {canModify && (
            <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="min-h-10 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[10px] font-medium text-white/65 hover:bg-white/[0.09] hover:text-white sm:px-4 sm:text-xs"
              >
                Edit
              </button>

              <button
                type="button"
                onClick={onDelete}
                className="min-h-10 rounded-xl border border-red-400/10 bg-red-400/[0.05] px-3 py-2 text-[10px] font-medium text-red-300 hover:bg-red-400/[0.09] sm:px-4 sm:text-xs"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* DETAIL STATS */}

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-7 sm:gap-3 lg:grid-cols-4">
          <DetailStat
            label="Packets"
            value={formatNumber(packets)}
          />

          <DetailStat
            label="Price / packet"
            value={`RM ${pricePerPacket.toFixed(2)}`}
          />

          <DetailStat
            label="Participants"
            value={String(
              session.participants.length,
            )}
          />

          <DetailStat
            label="Session total"
            value={`RM ${totalCost.toFixed(2)}`}
            highlight
          />
        </div>

        {/* YOUR SHARE */}

        {currentParticipant && (
          <section className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.035] p-4 sm:mt-5 sm:rounded-2xl sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[8px] uppercase tracking-[0.14em] text-white/25 sm:text-[10px]">
                  Your share
                </p>

                <p className="mt-1 truncate text-[10px] text-white/30 sm:text-xs">
                  {currentUserName ?? 'Your'} share
                </p>
              </div>

              <p className="shrink-0 text-xl font-semibold sm:text-3xl">
                RM{' '}
                {Number(
                  currentParticipant.amount_owed,
                ).toFixed(2)}
              </p>
            </div>
          </section>
        )}

        {/* PARTICIPANTS */}

        <section className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 sm:mt-5 sm:rounded-2xl sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[8px] uppercase tracking-[0.14em] text-white/25 sm:text-[10px]">
                Participants
              </p>

              <h3 className="mt-1 text-sm font-semibold sm:text-base">
                Who participated
              </h3>
            </div>

            <span className="text-[9px] text-white/25">
              {session.participants.length}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3">
            {session.participants.map(
              (participant) => {
                const isCurrentUser =
                  participant.user_id ===
                  currentUserId

                const account = usersById.get(
                  participant.user_id,
                )

                return (
                  <div
                    key={participant.id}
                    className={`flex min-w-0 items-center justify-between gap-2 rounded-xl border px-2.5 py-2.5 ${
                      isCurrentUser
                        ? 'border-white/[0.08] bg-white/[0.05]'
                        : 'border-white/[0.05] bg-white/[0.015]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <ParticipantAvatar
                        name={
                          participant.user_name
                        }
                        avatarData={
                          account?.avatar_data ??
                          null
                        }
                        size="sm"
                      />

                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-medium text-white/70 sm:text-xs">
                          {
                            participant.user_name
                          }
                        </p>

                        {isCurrentUser && (
                          <p className="text-[8px] text-white/25">
                            You
                          </p>
                        )}
                      </div>
                    </div>

                    <p className="shrink-0 text-[10px] font-semibold text-white/75 sm:text-xs">
                      RM{' '}
                      {Number(
                        participant.amount_owed,
                      ).toFixed(2)}
                    </p>
                  </div>
                )
              },
            )}
          </div>
        </section>

        {/* CALCULATION */}

        <section className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:mt-5 sm:rounded-2xl sm:p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
              <CalculatorIcon />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-medium text-white/55 sm:text-xs">
                Calculation
              </p>

              <p className="mt-1 font-mono text-[8px] leading-4 text-white/30 sm:text-[10px] sm:leading-5">
                {packets.toFixed(3)} × RM{' '}
                {pricePerPacket.toFixed(2)} = RM{' '}
                {totalCost.toFixed(2)}
              </p>

              <p className="font-mono text-[8px] leading-4 text-white/30 sm:text-[10px] sm:leading-5">
                RM {totalCost.toFixed(2)} ÷{' '}
                {session.participants.length} = RM{' '}
                {session.participants.length
                  ? (
                      totalCost /
                      session.participants.length
                    ).toFixed(2)
                  : '0.00'}{' '}
                each
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}

/* ================================================================
   DETAIL STAT
   ================================================================ */

function DetailStat({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 sm:rounded-2xl sm:p-4">
      <p className="truncate text-[8px] uppercase tracking-[0.1em] text-white/25 sm:text-[10px]">
        {label}
      </p>

      <p
        className={
          highlight
            ? 'mt-2 truncate text-lg font-semibold tracking-tight text-white sm:mt-3 sm:text-2xl'
            : 'mt-2 truncate text-lg font-semibold tracking-tight text-white/75 sm:mt-3 sm:text-2xl'
        }
      >
        {value}
      </p>
    </div>
  )
}

/* ================================================================
   PARTICIPANT AVATAR
   ================================================================ */

function ParticipantAvatar({
  name,
  avatarData,
  size = 'md',
}: {
  name: string
  avatarData: string | null
  size?: 'sm' | 'md'
}) {
  const sizeClass =
    size === 'sm'
      ? 'h-7 w-7 text-[8px]'
      : 'h-9 w-9 text-[10px]'

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.07] font-semibold text-white/70`}
      title={name}
    >
      {avatarData ? (
        <img
          src={avatarData}
          alt={`${name}'s avatar`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        name.charAt(0).toUpperCase() || '?'
      )}
    </div>
  )
}

/* ================================================================
   EDIT SESSION MODAL
   ================================================================ */

function EditSessionModal({
  session,
  users,
  onClose,
  onSaved,
}: {
  session: DrinkSession
  users: UserDirectoryEntry[]
  onClose: () => void
  onSaved: (session: DrinkSession) => void
}) {
  const [sessionDate, setSessionDate] =
    useState(session.session_date)

  const [packets, setPackets] = useState(
    String(session.packets_used),
  )

  const [participants, setParticipants] =
    useState<number[]>(
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
      setError(
        'Select at least one participant.',
      )
      return
    }

    const packetValue = Number(packets)

    if (
      !Number.isFinite(packetValue) ||
      packetValue <= 0
    ) {
      setError(
        'Packets used must be greater than 0.',
      )
      return
    }

    setSaving(true)
    setError('')

    try {
      const updated =
        await apiRequest<DrinkSession>(
          `/api/sessions/${session.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              session_date: sessionDate,
              packets_used: packetValue,
              participant_user_ids:
                participants,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/[0.09] bg-[#0b0e18] p-4 shadow-2xl sm:rounded-3xl sm:p-6">
        {/* MODAL HEADER */}

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.16em] text-white/25">
              Session management
            </p>

            <h3 className="mt-1 text-lg font-semibold sm:text-xl">
              Edit session
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-white/30 hover:bg-white/[0.05] hover:text-white"
          >
            ×
          </button>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mt-4 rounded-xl border border-red-400/10 bg-red-400/[0.05] px-3 py-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        <form
          onSubmit={submit}
          className="mt-5 space-y-3.5"
        >
          {/* DATE */}

          <label className="block">
            <span className="mb-1.5 block text-[11px] text-white/45">
              Session date
            </span>

            <input
              type="date"
              value={sessionDate}
              onChange={(event) =>
                setSessionDate(
                  event.target.value,
                )
              }
              required
              disabled={saving}
              className="min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white outline-none focus:border-white/25 disabled:opacity-50"
            />
          </label>

          {/* PACKETS */}

          <label className="block">
            <span className="mb-1.5 block text-[11px] text-white/45">
              Packets used
            </span>

            <input
              type="number"
              min="0.001"
              step="0.001"
              value={packets}
              onChange={(event) =>
                setPackets(
                  event.target.value,
                )
              }
              required
              disabled={saving}
              className="min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white outline-none focus:border-white/25 disabled:opacity-50"
            />

            <p className="mt-1.5 text-[10px] leading-4 text-white/25">
              Fixed price: RM{' '}
              {Number(
                session.price_per_packet,
              ).toFixed(2)}{' '}
              per packet. The backend recalculates
              the total.
            </p>
          </label>

          {/* PARTICIPANTS */}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] text-white/45">
                Participants
              </p>

              <span className="text-[10px] text-white/25">
                {participants.length}{' '}
                selected
              </span>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-white/[0.07] bg-black/20 p-1.5">
              {users.map((account) => {
                const checked =
                  participants.includes(
                    account.id,
                  )

                return (
                  <label
                    key={account.id}
                    className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11px] text-white/60 hover:bg-white/[0.04]"
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
                      className="h-4 w-4"
                    />

                    <span className="truncate">
                      {account.name}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* ACTIONS */}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="min-h-10 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/50 hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                participants.length === 0
              }
              className="min-h-10 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-40"
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

/* ================================================================
   DELETE SESSION MODAL
   ================================================================ */

function DeleteSessionModal({
  sessionId,
  onClose,
  onDeleted,
}: {
  sessionId: number
  onClose: () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] =
    useState(false)

  const [error, setError] = useState('')

  async function confirmDelete() {
    setDeleting(true)
    setError('')

    try {
      await apiRequest(
        `/api/sessions/${sessionId}`,
        {
          method: 'DELETE',
        },
      )

      onDeleted()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete session.',
      )

      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.09] bg-[#0b0e18] p-4 shadow-2xl sm:rounded-3xl sm:p-6">
        <p className="text-[9px] uppercase tracking-[0.16em] text-red-300/50">
          Destructive action
        </p>

        <h3 className="mt-1 text-lg font-semibold sm:text-xl">
          Delete this session?
        </h3>

        <p className="mt-2 text-xs leading-5 text-white/35">
          This permanently removes the session and
          its participant cost records. This action
          cannot be undone.
        </p>

        {error && (
          <div className="mt-3 rounded-xl border border-red-400/10 bg-red-400/[0.05] px-3 py-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="min-h-10 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/50 hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleting}
            className="min-h-10 rounded-xl bg-red-400 px-3 py-2 text-xs font-semibold text-black disabled:opacity-40"
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

/* ================================================================
   NUMBER FORMAT
   ================================================================ */

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(3).replace(/\.?0+$/, '')
}

/* ================================================================
   ICONS
   ================================================================ */

function CupIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M6 7h10v8a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4z" />
      <path d="M16 9h2a2 2 0 0 1 0 4h-2" />
      <path d="M8 4c0 1 1 1 1 2M11 4c0 1 1 1 1 2M14 4c0 1 1 1 1 2" />
      <path d="M5 21h12" />
    </svg>
  )
}

function CalculatorIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="3"
        width="14"
        height="18"
        rx="2"
      />
      <path d="M8 7h8" />
      <path d="M8 11h2M14 11h2" />
      <path d="M8 15h2M14 15h2" />
      <path d="M8 18h8" />
    </svg>
  )
}