import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiRequest } from '../api/client'
import { useAuth } from '../auth/useAuth'

type ManagedRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN'

type ManagedUser = {
  id: number
  name: string
  role: ManagedRole
  is_active: boolean
  created_at: string
}

type ResetRequest = { id: number; user_id: number; username: string; created_at: string; status: string }

export default function SuperAdminUsers() {
  const { user, updateUser } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [resetRequests, setResetRequests] = useState<ResetRequest[]>([])
  const [decidingResetId, setDecidingResetId] = useState<number | null>(null)

  const loadUsers = useCallback(async () => {
    setError('')
    try {
      const rows = await apiRequest<ManagedUser[]>(
        '/api/users/super-admin/users',
      )
      setUsers(rows)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to load users.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadUsers])

  const loadResetRequests = useCallback(async () => {
    try {
      const rows = await apiRequest<ResetRequest[]>('/api/admin/password-reset-requests')
      setResetRequests(rows)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load reset requests.')
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadResetRequests(), 0)
    return () => window.clearTimeout(timer)
  }, [loadResetRequests])

  async function decideReset(request: ResetRequest, decision: 'approve' | 'reject') {
    if (decidingResetId !== null) return
    setDecidingResetId(request.id)
    setError('')
    try {
      await apiRequest(`/api/admin/password-reset-requests/${request.id}/${decision}`, { method: 'POST' })
      setResetRequests((current) => current.filter((item) => item.id !== request.id))
      setNotice(`Password-reset request ${decision}d. The requester can continue only in their original browser session.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update reset request.')
    } finally {
      setDecidingResetId(null)
    }
  }

  async function changeRole(account: ManagedUser, role: 'USER' | 'ADMIN') {
    if (account.role === role || savingId !== null) return
    setSavingId(account.id)
    setError('')
    setNotice('')
    try {
      const updated = await apiRequest<ManagedUser>(
        `/api/users/super-admin/users/${account.id}/role`,
        {
          method: 'PATCH',
          body: JSON.stringify({ role }),
        },
      )
      setUsers((current) =>
        current.map((item) => item.id === updated.id ? updated : item),
      )
      if (updated.id === user?.id) updateUser(updated)
      setNotice(`${updated.name} is now ${role === 'ADMIN' ? 'an admin' : 'a user'}.`)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to update this role.',
      )
    } finally {
      setSavingId(null)
    }
  }

  const superAdminCount = users.filter(
    (account) => account.role === 'SUPER_ADMIN',
  ).length

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#070910] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-white">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Security</p>
            <h1 className="mt-1 truncate text-xl font-semibold sm:text-2xl">User management</h1>
          </div>
          <Link
            to="/admin"
            className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white/65 transition hover:bg-white/[0.07] sm:px-4"
          >
            Admin dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <p className="max-w-2xl text-sm leading-6 text-white/45">
          Review account details and grant or remove administrator access.
          Passwords and authentication tokens are never shown here.
        </p>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/15 bg-red-400/[0.05] px-4 py-3 text-sm text-red-300">{error}</p>}
        {notice && <p role="status" aria-live="polite" className="mt-5 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-4 py-3 text-sm text-emerald-300">{notice}</p>}

        <section aria-label="Registered users" className="mt-6 space-y-3">
          {loading ? (
            <p role="status" className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 text-sm text-white/40">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 text-sm text-white/40">No registered users found.</p>
          ) : users.map((account) => {
            const isLastSuperAdmin = account.role === 'SUPER_ADMIN' && superAdminCount <= 1
            const isSaving = savingId === account.id
            return (
              <article key={account.id} className="grid min-w-0 gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] sm:items-center sm:p-5">
                <div className="min-w-0">
                  <h2 className="break-words text-sm font-semibold text-white/85">{account.name}</h2>
                  <p className="mt-1 text-[10px] text-white/25">User #{account.id} · {account.is_active ? 'Active' : 'Inactive'}</p>
                </div>
                <label className="flex min-w-0 items-center gap-3 sm:justify-end">
                  <span className="shrink-0 text-xs text-white/40">Role</span>
                  <select
                    aria-label={`Role for ${account.name}`}
                    value={account.role}
                    disabled={isSaving || isLastSuperAdmin}
                    onChange={(event) => {
                      const value = event.target.value
                      if (value === 'USER' || value === 'ADMIN') {
                        void changeRole(account, value)
                      }
                    }}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0b0d15] px-3 text-sm text-white outline-none focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-55 sm:flex-initial"
                  >
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN" disabled>Super-admin</option>
                  </select>
                </label>
                {isLastSuperAdmin && (
                  <p className="text-[10px] text-white/30 sm:col-span-2 sm:text-right">The last super-admin cannot be demoted.</p>
                )}
              </article>
            )
          })}
        </section>

        <section aria-label="Password reset requests" className="mt-12">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Password reset requests</h2>
            <button type="button" onClick={() => void loadResetRequests()} className="min-h-11 rounded-xl border border-white/10 px-3 text-xs text-white/65">Refresh</button>
          </div>
          <p className="mt-2 text-xs leading-5 text-white/40">Verify the requester’s identity using your established trusted process before approving. Approval does not itself prove real-world identity and is bound to the requester’s original browser session.</p>
          <div className="mt-4 space-y-3">
            {resetRequests.length === 0 ? (
              <p className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 text-sm text-white/40">No pending password reset requests.</p>
            ) : resetRequests.map((request) => (
              <article key={request.id} className="flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-medium">{request.username}</p><p className="mt-1 text-xs text-white/40">Request #{request.id} · {new Date(request.created_at).toLocaleString()}</p></div>
                <div className="flex gap-2">
                  <button type="button" disabled={decidingResetId !== null} onClick={() => void decideReset(request, 'reject')} className="min-h-11 rounded-xl border border-red-300/20 px-4 text-xs text-red-200 disabled:opacity-50">Reject</button>
                  <button type="button" disabled={decidingResetId !== null} onClick={() => void decideReset(request, 'approve')} className="min-h-11 rounded-xl bg-white px-4 text-xs font-semibold text-[#070910] disabled:opacity-50">Approve</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
