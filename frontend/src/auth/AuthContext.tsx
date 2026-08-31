import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { apiRequest } from '../api/client'

type User = {
  id: number
  name: string
  role: string
  is_active: boolean
  created_at?: string
  avatar_data?: string | null
}

type LoginResponse = {
  access_token: string
  token_type: string
}

type AuthContextType = {
  user: User | null
  token: string | null
  loading: boolean
  login: (name: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (user: User) => void
}

const AuthContext = createContext<
  AuthContextType | undefined
>(undefined)

const TOKEN_KEY = 'kotrack_access_token'

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.')

    if (parts.length !== 3) {
      return true
    }

    const payload = JSON.parse(
      atob(
        parts[1]
          .replace(/-/g, '+')
          .replace(/_/g, '/'),
      ),
    )

    if (!payload.exp) {
      return false
    }

    return payload.exp * 1000 <= Date.now()
  } catch {
    return true
  }
}

export function AuthProvider({
  children,
}: {
  children: ReactNode
}) {
  const [user, setUser] =
    useState<User | null>(null)

  const [token, setToken] =
    useState<string | null>(
      () => localStorage.getItem(TOKEN_KEY),
    )

  const [loading, setLoading] =
    useState(true)

  useEffect(() => {
    async function restoreSession() {
      const storedToken =
        localStorage.getItem(TOKEN_KEY)

      if (
        !storedToken ||
        isTokenExpired(storedToken)
      ) {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const currentUser =
          await apiRequest<User>(
            '/api/users/me',
            {
              headers: {
                Authorization:
                  `Bearer ${storedToken}`,
              },
            },
          )

        setToken(storedToken)
        setUser(currentUser)
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    restoreSession()
  }, [])

  async function login(
    name: string,
    password: string,
  ) {
    const cleanName = name.trim()

    if (!cleanName) {
      throw new Error('Name is required.')
    }

    if (!password) {
      throw new Error('Password is required.')
    }

    // Step 1: authenticate
    const response =
      await apiRequest<LoginResponse>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            name: cleanName,
            password,
          }),
        },
      )

    // Step 2: store token immediately
    localStorage.setItem(
      TOKEN_KEY,
      response.access_token,
    )

    setToken(response.access_token)

    // Step 3: retrieve the authenticated user
    const currentUser =
      await apiRequest<User>(
        '/api/users/me',
        {
          headers: {
            Authorization:
              `Bearer ${response.access_token}`,
          },
        },
      )

    setUser(currentUser)
  }

  function updateUser(
    updatedUser: User,
  ) {
    setUser(updatedUser)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context =
    useContext(AuthContext)

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider',
    )
  }

  return context
}