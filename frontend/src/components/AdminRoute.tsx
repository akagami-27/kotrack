import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import { isAdminRole } from '../auth/roles'

type AdminRouteProps = {
  children: ReactNode
}

export default function AdminRoute({
  children,
}: AdminRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <main role="status" aria-live="polite" className="flex min-h-[100dvh] items-center justify-center bg-[#070910] pb-[env(safe-area-inset-bottom)] pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <div className="text-sm text-white/40">
          Loading KoTrack...
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    )
  }

  if (!isAdminRole(user.role)) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    )
  }

  return <>{children}</>
}
