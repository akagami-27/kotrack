import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import type { ReactNode } from 'react'

export default function ProtectedRoute({
  children,
}: {
  children: ReactNode
}) {
  const { user, loading } = useAuth()

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
    return <Navigate to="/login" replace />
  }

  return children
}
