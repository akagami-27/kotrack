import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { ReactNode } from 'react'

export default function ProtectedRoute({
  children,
}: {
  children: ReactNode
}) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070910] text-white">
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