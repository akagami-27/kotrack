import { createContext } from 'react'

export type User = {
  id: number
  name: string
  role: string
  is_active: boolean
  created_at?: string
  avatar_data?: string | null
}

type AuthContextType = {
  user: User | null
  token: string | null
  loading: boolean
  login: (name: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (user: User) => void
}

export const AuthContext = createContext<
  AuthContextType | undefined
>(undefined)
