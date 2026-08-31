import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

type AdminRouteProps = {
  children: ReactNode
}

export default function AdminRoute({
  children,
}: AdminRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070910] text-white">
        <div className="text-sm text-white/40">
          Loading KoTrack...
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  if (user.role !== 'ADMIN') {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    )
  }

  return <>{children}</>
}