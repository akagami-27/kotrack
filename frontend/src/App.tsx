import { lazy, Suspense } from 'react'
import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'

import { useAuth } from './auth/useAuth'

import AdminRoute from './components/AdminRoute'

const AdminCreateSessions = lazy(
  () => import('./pages/AdminCreateSessions'),
)
const AdminDashboard = lazy(
  () => import('./pages/AdminDashboard'),
)
const AdminPayments = lazy(
  () => import('./pages/AdminPayments'),
)
const Dashboard = lazy(
  () => import('./pages/Dashboard'),
)
const Landing = lazy(
  () => import('./pages/Landing'),
)
const Login = lazy(
  () => import('./pages/Login'),
)
const Payments = lazy(
  () => import('./pages/Payments'),
)
const Profile = lazy(
  () => import('./pages/Profile'),
)
const Register = lazy(
  () => import('./pages/Register'),
)
const RequestSession = lazy(
  () => import('./pages/RequestSession'),
)
const Sessions = lazy(
  () => import('./pages/Sessions'),
)
const Settings = lazy(
  () => import('./pages/Settings'),
)

function App() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()

  if (loading && pathname !== '/') {
    return (
      <main
        role="status"
        aria-live="polite"
        className="flex min-h-[100dvh] items-center justify-center bg-[#070910] text-white"
      >
        <div className="text-sm text-white/40">
          Loading KoTrack...
        </div>
      </main>
    )
  }

  return (
    <Suspense
      fallback={
        <main
          role="status"
          aria-live="polite"
          className="flex min-h-[100dvh] items-center justify-center bg-[#070910] text-white"
        >
          <p className="text-sm text-white/40">
            Loading page...
          </p>
        </main>
      }
    >
    <Routes>
      {/* Public landing page */}
      <Route
        path="/"
        element={
          user ? (
            <Navigate
              to="/dashboard"
              replace
            />
          ) : (
            <Landing />
          )
        }
      />

      {/* Login */}
      <Route
        path="/login"
        element={
          user ? (
            <Navigate
              to="/dashboard"
              replace
            />
          ) : (
            <Login />
          )
        }
      />

      {/* Registration */}
      <Route
        path="/register"
        element={
          user ? (
            <Navigate
              to="/dashboard"
              replace
            />
          ) : (
            <Register />
          )
        }
      />

      {/* User dashboard */}
      <Route
        path="/dashboard"
        element={
          user ? (
            <Dashboard />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      {/* User sessions */}
      <Route
        path="/sessions"
        element={
          user ? (
            <Sessions />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      {/* Request a new session */}
      <Route
        path="/sessions/new"
        element={
          user ? (
            <RequestSession />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      {/* User payments */}
      <Route
        path="/payments"
        element={
          user ? (
            <Payments />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      {/* User profile */}
      <Route
        path="/profile"
        element={
          user ? (
            <Profile />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      {/* User settings */}
      <Route
        path="/settings"
        element={
          user ? (
            <Settings />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      {/* Admin dashboard */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />

      {/* Admin payments */}
      <Route
        path="/admin/payments"
        element={
          <AdminRoute>
            <AdminPayments />
          </AdminRoute>
        }
      />

      {/* Admin create session */}
      <Route
        path="/admin/sessions/create"
        element={
          <AdminRoute>
            <AdminCreateSessions />
          </AdminRoute>
        }
      />

      {/* Unknown route */}
      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />
    </Routes>
    </Suspense>
  )
}

export default App
