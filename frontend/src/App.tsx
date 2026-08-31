import { Navigate, Route, Routes } from 'react-router-dom'

import { useAuth } from './auth/AuthContext'

import AdminRoute from './components/AdminRoute'

import AdminCreateSessions from './pages/AdminCreateSessions'
import AdminDashboard from './pages/AdminDashboard'
import AdminPayments from './pages/AdminPayments'

import Dashboard from './pages/Dashboard'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Payments from './pages/Payments'
import Profile from './pages/Profile'
import Register from './pages/Register'
import RequestSession from './pages/RequestSession'
import Sessions from './pages/Sessions'
import Settings from './pages/Settings'


function App() {
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

  return (
    <Routes>

      {/* Public landing page */}
      <Route
        path="/"
        element={<Landing />}
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
  )
}

export default App