'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api, User } from '@/lib/api'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (token: string, user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const token = api.getToken()
      if (token) {
        try {
          const response = await api.getMe()
          if (response.success && response.data) {
            setUser(response.data)
          } else {
            api.setToken(null)
          }
        } catch {
          api.setToken(null)
        }
      }
      setIsLoading(false)
    }
    initAuth()
  }, [])

  const login = (token: string, userData: User) => {
    api.setToken(token)
    setUser(userData)
  }

  const logout = () => {
    api.logout()
    setUser(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
