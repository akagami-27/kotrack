import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
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

export default function Sessions() {
  const { user } = useAuth()

  const [sessions, setSessions] = useState<DrinkSession[]>([])
  const [users, setUsers] = useState<UserDirectoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSession, setSelectedSession] =
    useState<DrinkSession | null>(null)

  useEffect(() => {
    async function loadSessions() {
      try {
        setError('')

        const data = await apiRequest<DrinkSession[]>(
          '/api/sessions',
        )

        setSessions(data)

        // Load profile avatars for the participants shown in sessions.
        // The session endpoint supplies participant IDs/names; the user
        // directory supplies each user's current avatar.
        try {
          const userData =
            await apiRequest<UserDirectoryEntry[]>(
              '/api/users',
            )

          setUsers(userData)
        } catch {
          // Avatars are optional. Sessions should still render normally
          // when the user directory cannot be loaded.
          setUsers([])
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load sessions.',
        )
      } finally {
        setLoading(false)
      }
    }

    loadSessions()
  }, [])

  const totalPackets = useMemo(
    () =>
      sessions.reduce(
        (total, session) =>
          total + Number(session.packets_used),
        0,
      ),
    [sessions],
  )

  const sessionShares = useMemo(
    () =>
      sessions.map((session) => {
        const participant = session.participants.find(
          (item) => item.user_id === user?.id,
        )

        return {
          session,
          amountOwed: participant
            ? Number(participant.amount_owed)
            : 0,
        }
      }),
    [sessions, user?.id],
  )

  const totalYourShare = useMemo(
    () =>
      sessionShares.reduce(
        (total, item) => total + item.amountOwed,
        0,
      ),
    [sessionShares],
  )

  if (selectedSession) {
    return (
      <SessionDetails
        session={selectedSession}
        currentUserId={user?.id}
        users={users}
        onBack={() => setSelectedSession(null)}
      />
    )
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#070910] text-white">

      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-violet-600/[0.07] blur-[140px]" />

        <div className="absolute -bottom-40 right-[-100px] h-[500px] w-[500px] rounded-full bg-blue-500/[0.05] blur-[140px]" />

        <div className="absolute left-[45%] top-[35%] h-[300px] w-[300px] rounded-full bg-indigo-500/[0.025] blur-[120px]" />
      </div>

      <div className="relative z-10 flex min-h-screen">

        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-white/[0.06] bg-black/10 lg:flex lg:flex-col">
          <Sidebar userName={user?.name ?? 'User'} />
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1">

          {/* Header */}
          <header className="flex h-20 items-center justify-between border-b border-white/[0.06] px-5 sm:px-8 lg:px-10">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-white/25">
                Workspace
              </p>

              <h1 className="mt-1 text-sm font-medium text-white/80">
                Sessions
              </h1>
            </div>

            <Link
              to="/dashboard"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-white/55 transition hover:bg-white/[0.07] hover:text-white"
            >
              Back to dashboard
            </Link>
          </header>

          {/* Content */}
          <section className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">

            {/* Heading */}
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm text-white/30">
                  Your consumption history
                </p>

                <h2 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Sessions
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-6 text-white/35">
                  Review your drink sessions and the amount
                  you owe for each one.
                </p>
              </div>

              <Link
                to="/sessions/new"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                <PlusIcon />
                New session
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <StatCard
                label="Total sessions"
                value={String(sessions.length)}
                description="Your recorded sessions"
              />

              <StatCard
                label="Total packets"
                value={totalPackets.toString()}
                description="Packets across sessions"
              />

              <StatCard
                label="Your balance"
                value={`RM ${totalYourShare.toFixed(2)}`}
                description="Amount you currently owe"
                warning={totalYourShare > 0}
              />

              <StatCard
                label="Your total"
                value={`RM ${totalYourShare.toFixed(2)}`}
                description="Your share across sessions"
                positive
              />

            </div>

            {/* Loading */}
            {loading && (
              <section className="mt-6 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-10 text-center backdrop-blur-xl">
                <p className="text-sm text-white/40">
                  Loading sessions...
                </p>
              </section>
            )}

            {/* Error */}
            {!loading && error && (
              <section className="mt-6 rounded-3xl border border-red-400/10 bg-red-400/[0.04] p-6">
                <p className="text-sm font-medium text-red-300">
                  Unable to load sessions
                </p>

                <p className="mt-2 text-xs text-red-300/60">
                  {error}
                </p>
              </section>
            )}

            {/* Empty */}
            {!loading && !error && sessions.length === 0 && (
              <section className="mt-6 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-10 text-center backdrop-blur-xl">
                <p className="text-sm font-medium text-white/60">
                  No sessions yet
                </p>

                <p className="mt-2 text-xs text-white/30">
                  Create or join a session to see it here.
                </p>

                <Link
                  to="/sessions/new"
                  className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 text-xs font-semibold text-black transition hover:bg-white/90"
                >
                  Create session
                </Link>
              </section>
            )}

            {/* Session list */}
            {!loading && !error && sessions.length > 0 && (
              <section className="mt-6 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 backdrop-blur-xl sm:p-6">

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-white/25">
                      History
                    </p>

                    <h3 className="mt-2 text-lg font-semibold">
                      Your sessions
                    </h3>
                  </div>

                  <span className="text-xs text-white/25">
                    {sessions.length}{' '}
                    {sessions.length === 1
                      ? 'record'
                      : 'records'}
                  </span>
                </div>

                <div className="mt-6 space-y-2">
                  {sessionShares.map(
                    ({ session, amountOwed }) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        amountOwed={amountOwed}
                        users={users}
                        onClick={() =>
                          setSelectedSession(session)
                        }
                      />
                    ),
                  )}
                </div>
              </section>
            )}

            {/* Calculation explanation */}
            <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="flex gap-4">

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03]">
                  <CalculatorIcon />
                </div>

                <div>
                  <p className="text-sm font-medium text-white/60">
                    How your share is calculated
                  </p>

                  <p className="mt-2 max-w-2xl text-xs leading-5 text-white/30">
                    The session total is calculated from the
                    number of packets used and the price per
                    packet. Your share is then calculated by
                    dividing the session total equally among
                    all participants.
                  </p>

                  <div className="mt-3 rounded-xl border border-white/[0.05] bg-black/20 px-4 py-3">
                    <p className="text-xs font-medium text-white/50">
                      Formula
                    </p>

                    <p className="mt-1 font-mono text-xs text-white/40">
                      Session total = packets used × price per packet
                    </p>

                    <p className="mt-1 font-mono text-xs text-white/40">
                      Your share = session total ÷ number of participants
                    </p>
                  </div>

                  <p className="mt-3 text-[11px] leading-5 text-white/20">
                    Example: 1 packet × RM25 = RM25 session
                    total. With 2 participants, each person's
                    share is RM25 ÷ 2 = RM12.50.
                  </p>
                </div>

              </div>
            </div>

          </section>
        </div>
      </div>
    </main>
  )
}


/* -------------------------------------------------------------------------- */
/* Session Details                                                            */
/* -------------------------------------------------------------------------- */

function SessionDetails({
  session,
  currentUserId,
  users,
  onBack,
}: {
  session: DrinkSession
  currentUserId?: number
  users: UserDirectoryEntry[]
  onBack: () => void
}) {
  const packets = Number(session.packets_used)
  const pricePerPacket = Number(session.price_per_packet)
  const totalCost = Number(session.total_cost)

  const currentParticipant = session.participants.find(
    (participant) =>
      participant.user_id === currentUserId,
  )

  const formattedDate = new Date(
    `${session.session_date}T00:00:00`,
  ).toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return (
    <main className="min-h-screen overflow-hidden bg-[#070910] text-white">

      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-violet-600/[0.07] blur-[140px]" />

        <div className="absolute -bottom-40 right-[-100px] h-[500px] w-[500px] rounded-full bg-blue-500/[0.05] blur-[140px]" />
      </div>

      <div className="relative z-10 flex min-h-screen">

        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-white/[0.06] bg-black/10 lg:flex lg:flex-col">
          <Sidebar userName="User" />
        </aside>

        <div className="min-w-0 flex-1">

          {/* Header */}
          <header className="flex h-20 items-center justify-between border-b border-white/[0.06] px-5 sm:px-8 lg:px-10">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-white/25">
                Workspace
              </p>

              <h1 className="mt-1 text-sm font-medium text-white/80">
                Session details
              </h1>
            </div>

            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-white/55 transition hover:bg-white/[0.07] hover:text-white"
            >
              Back to sessions
            </button>
          </header>

          <section className="mx-auto max-w-[1000px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">

            {/* Back */}
            <button
              type="button"
              onClick={onBack}
              className="mb-6 inline-flex items-center gap-2 text-xs text-white/35 transition hover:text-white/70"
            >
              <BackArrowIcon />
              Sessions
            </button>

            {/* Heading */}
            <div>
              <p className="text-sm text-white/30">
                Drink session
              </p>

              <h2 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                Session details
              </h2>

              <p className="mt-3 text-sm text-white/30">
                {formattedDate}
              </p>
            </div>

            {/* Summary */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <DetailStat
                label="Packets used"
                value={packets.toString()}
              />

              <DetailStat
                label="Price / packet"
                value={`RM ${pricePerPacket.toFixed(2)}`}
              />

              <DetailStat
                label="Participants"
                value={String(session.participants.length)}
              />

              <DetailStat
                label="Session total"
                value={`RM ${totalCost.toFixed(2)}`}
                highlight
              />

            </div>

            {/* Your share */}
            {currentParticipant && (
              <section className="mt-6 rounded-3xl border border-white/[0.08] bg-white/[0.035] p-6 backdrop-blur-xl">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-white/25">
                      Your share
                    </p>

                    <p className="mt-2 text-sm text-white/45">
                      Your calculated amount for this session
                    </p>
                  </div>

                  <p className="text-3xl font-semibold tracking-tight">
                    RM {Number(
                      currentParticipant.amount_owed,
                    ).toFixed(2)}
                  </p>
                </div>
              </section>
            )}

            {/* Participants */}
            <section className="mt-6 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 backdrop-blur-xl sm:p-6">

              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-white/25">
                  Participants
                </p>

                <h3 className="mt-2 text-lg font-semibold">
                  Who participated
                </h3>

                <p className="mt-1 text-xs text-white/25">
                  Each participant's share of this session.
                </p>
              </div>

              <div className="mt-6 space-y-2">
                {session.participants.map(
                  (participant) => {
                    const isCurrentUser =
                      participant.user_id === currentUserId

                    return (
                      <div
                        key={participant.id}
                        className={
                          isCurrentUser
                            ? 'flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.05] px-4 py-4'
                            : 'flex items-center justify-between rounded-2xl border border-white/[0.05] bg-white/[0.015] px-4 py-4'
                        }
                      >
                        <div className="flex min-w-0 items-center gap-3">

                          <ParticipantAvatar
                            name={participant.user_name}
                            avatarData={
                              users.find(
                                (account) =>
                                  account.id ===
                                  participant.user_id,
                              )?.avatar_data ?? null
                            }
                            size="md"
                          />

                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white/70">
                              {participant.user_name}
                            </p>

                            {isCurrentUser && (
                              <p className="mt-0.5 text-[10px] text-white/30">
                                You
                              </p>
                            )}
                          </div>

                        </div>

                        <p className="ml-4 shrink-0 text-sm font-semibold text-white/70">
                          RM {Number(
                            participant.amount_owed,
                          ).toFixed(2)}
                        </p>
                      </div>
                    )
                  },
                )}
              </div>
            </section>

            {/* Calculation */}
            <section className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">

              <div className="flex gap-4">

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03]">
                  <CalculatorIcon />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-medium text-white/60">
                    How this session was calculated
                  </p>

                  <div className="mt-3 space-y-2 font-mono text-xs text-white/35">
                    <p>
                      {packets.toFixed(3)} packets × RM{' '}
                      {pricePerPacket.toFixed(2)}
                    </p>

                    <p>
                      = RM {totalCost.toFixed(2)} session total
                    </p>

                    <p>
                      RM {totalCost.toFixed(2)} ÷{' '}
                      {session.participants.length} participant
                      {session.participants.length === 1
                        ? ''
                        : 's'}
                    </p>

                    <p>
                      = RM{' '}
                      {session.participants.length > 0
                        ? (
                            totalCost /
                            session.participants.length
                          ).toFixed(2)
                        : '0.00'}{' '}
                      per participant
                    </p>
                  </div>

                </div>

              </div>
            </section>

          </section>
        </div>
      </div>
    </main>
  )
}


/* -------------------------------------------------------------------------- */
/* Sidebar                                                                    */
/* -------------------------------------------------------------------------- */

function Sidebar({
  userName,
}: {
  userName: string
}) {
  return (
    <div className="flex h-full flex-col">

      <div className="flex h-20 items-center border-b border-white/[0.06] px-6">
        <Link
          to="/dashboard"
          className="flex items-center gap-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
            <span className="text-sm font-bold">
              K
            </span>
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

        <SidebarLink
          to="/dashboard"
          icon={<DashboardIcon />}
          label="Dashboard"
        />

        <SidebarLink
          to="/sessions"
          icon={<SessionIcon />}
          label="Sessions"
          active
        />

        <SidebarLink
          to="/payments"
          icon={<WalletIcon />}
          label="Payments"
        />

        <div className="my-6 border-t border-white/[0.06]" />

        <p className="mb-3 px-3 text-[10px] uppercase tracking-[0.18em] text-white/20">
          Account
        </p>

        <SidebarLink
          to="/profile"
          icon={<UserIcon />}
          label="Profile"
        />

        <SidebarLink
          to="/settings"
          icon={<SettingsIcon />}
          label="Settings"
        />

      </nav>

      <div className="border-t border-white/[0.06] p-4">
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-xs font-semibold">
            {userName.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white/70">
              {userName}
            </p>

            <p className="mt-0.5 text-[10px] text-white/25">
              Personal account
            </p>
          </div>

        </div>
      </div>

    </div>
  )
}


/* -------------------------------------------------------------------------- */
/* Sidebar link                                                               */
/* -------------------------------------------------------------------------- */

function SidebarLink({
  to,
  label,
  icon,
  active = false,
}: {
  to: string
  label: string
  icon: ReactNode
  active?: boolean
}) {
  return (
    <Link
      to={to}
      className={
        active
          ? 'mb-1 flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.06] px-3 py-2.5 text-sm text-white'
          : 'mb-1 flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm text-white/35 transition hover:bg-white/[0.04] hover:text-white/70'
      }
    >
      <span className="flex h-5 w-5 items-center justify-center">
        {icon}
      </span>

      {label}
    </Link>
  )
}


/* -------------------------------------------------------------------------- */
/* Stats                                                                      */
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
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 backdrop-blur-xl transition hover:border-white/[0.11] hover:bg-white/[0.035]">

      <div className="flex items-center justify-between">

        <p className="text-xs uppercase tracking-[0.12em] text-white/25">
          {label}
        </p>

        {warning && (
          <span className="rounded-full border border-amber-400/10 bg-amber-400/[0.07] px-2 py-1 text-[10px] text-amber-300">
            Due
          </span>
        )}

        {positive && (
          <span className="rounded-full border border-emerald-400/10 bg-emerald-400/[0.07] px-2 py-1 text-[10px] text-emerald-300">
            Personal
          </span>
        )}

      </div>

      <p className="mt-5 text-2xl font-semibold tracking-tight">
        {value}
      </p>

      <p className="mt-1 text-xs text-white/25">
        {description}
      </p>

    </div>
  )
}


/* -------------------------------------------------------------------------- */
/* Detail stat                                                                */
/* -------------------------------------------------------------------------- */

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
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 backdrop-blur-xl">

      <p className="text-xs uppercase tracking-[0.12em] text-white/25">
        {label}
      </p>

      <p
        className={
          highlight
            ? 'mt-4 text-2xl font-semibold tracking-tight text-white'
            : 'mt-4 text-2xl font-semibold tracking-tight text-white/75'
        }
      >
        {value}
      </p>

    </div>
  )
}


/* -------------------------------------------------------------------------- */
/* Participant avatar                                                         */
/* -------------------------------------------------------------------------- */

function ParticipantAvatar({
  name,
  avatarData,
  size = 'md',
  stacked = false,
}: {
  name: string
  avatarData: string | null
  size?: 'sm' | 'md'
  stacked?: boolean
}) {
  const sizeClass =
    size === 'sm'
      ? 'h-7 w-7 text-[9px]'
      : 'h-10 w-10 text-xs'

  return (
    <div
      className={`${sizeClass} ${
        stacked ? 'ring-2 ring-[#070910]' : ''
      } flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.07] font-semibold text-white/70`}
      title={name}
    >
      {avatarData ? (
        <img
          src={avatarData}
          alt={`${name}'s avatar`}
          className="h-full w-full object-cover"
        />
      ) : (
        name.charAt(0).toUpperCase() || '?'
      )}
    </div>
  )
}


/* -------------------------------------------------------------------------- */
/* Session card                                                               */
/* -------------------------------------------------------------------------- */

function SessionCard({
  session,
  amountOwed,
  users,
  onClick,
}: {
  session: DrinkSession
  amountOwed: number
  users: UserDirectoryEntry[]
  onClick: () => void
}) {
  const sessionTotal = Number(session.total_cost)
  const packets = Number(session.packets_used)
  const participantCount = session.participants.length

  const date = new Date(
    `${session.session_date}T00:00:00`,
  )

  const formattedDate = date.toLocaleDateString(
    'en-MY',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  )

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-2xl border border-transparent px-3 py-4 text-left transition hover:border-white/[0.06] hover:bg-white/[0.025]"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">

        {/* Session icon */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03]">
          <CupIcon />
        </div>

        {/* Session information */}
        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-2">

            <p className="text-sm font-medium text-white/75">
              {packets} packets
            </p>

            <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[9px] text-white/40">
              {participantCount}{' '}
              {participantCount === 1
                ? 'person'
                : 'people'}
            </span>

          </div>

          <p className="mt-1 text-xs text-white/25">
            {formattedDate}
          </p>

          <div className="mt-3 flex items-center">
            <div className="flex -space-x-2">
              {session.participants
                .slice(0, 5)
                .map((participant) => (
                  <ParticipantAvatar
                    key={`${session.id}-${participant.user_id}`}
                    name={participant.user_name}
                    avatarData={
                      users.find(
                        (account) =>
                          account.id ===
                          participant.user_id,
                      )?.avatar_data ?? null
                    }
                    size="sm"
                    stacked
                  />
                ))}
            </div>

            {participantCount > 5 && (
              <span className="ml-2 text-[9px] text-white/25">
                +{participantCount - 5}
              </span>
            )}
          </div>

        </div>

        {/* Calculation */}
        <div className="grid grid-cols-2 gap-6 border-t border-white/[0.05] pt-4 sm:grid-cols-3 lg:border-t-0 lg:pt-0">

          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/20">
              Session total
            </p>

            <p className="mt-1 text-sm font-medium text-white/40">
              RM {sessionTotal.toFixed(2)}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/20">
              Your share
            </p>

            <p className="mt-1 text-sm font-semibold text-white/80">
              RM {amountOwed.toFixed(2)}
            </p>
          </div>

          <div className="flex items-end justify-end">

            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] text-white/20 transition group-hover:border-white/[0.12] group-hover:text-white/60"
              title="View session details"
            >
              <ArrowIcon />
            </span>

          </div>

        </div>

      </div>
    </button>
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
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.2 3h-4.4l-.3 2.7a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5 2-1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.3 2.7h4.4l.3-2.7a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
    </svg>
  )
}


function PlusIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}


function CupIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M6 7h10v8a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4z" />
      <path d="M16 9h2a2 2 0 0 1 0 4h-2" />
      <path d="M8 4c0 1 1 1 1 2M11 4c0 1 1 1 1 2M14 4c0 1 1 1 1 2" />
      <path d="M5 21h12" />
    </svg>
  )
}


function ArrowIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M5 12h13" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}


function BackArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
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


function CalculatorIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 11h2M14 11h2M8 15h2M14 15h2M8 18h8" />
    </svg>
  )
}