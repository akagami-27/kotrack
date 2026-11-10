import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import { isSuperAdminRole } from '../auth/roles'

export default function SuperAdminRoute({
  children,
}: {
  children: ReactNode
}) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <main
        role="status"
        aria-live="polite"
        className="flex min-h-[100dvh] items-center justify-center bg-[#070910] text-white"
      >
        <p className="text-sm text-white/40">Loading KoTrack...</p>
      </main>
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (!isSuperAdminRole(user.role)) {
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}
