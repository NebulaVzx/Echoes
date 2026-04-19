'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api, User, TokenPair } from '@/lib/api'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (tokens: TokenPair, user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      // Check for OAuth callback token in URL hash (backend redirects here with #token=...)
      const hash = window.location.hash
      if (hash) {
        const params = new URLSearchParams(hash.slice(1))
        const tokenFromHash = params.get('token')
        const refreshFromHash = params.get('refresh_token')
        if (tokenFromHash) {
          api.setToken(tokenFromHash)
          if (refreshFromHash) {
            localStorage.setItem('echoes_refresh_token', refreshFromHash)
          }
          // Clean hash from URL without reloading
          window.history.replaceState({}, '', window.location.pathname + window.location.search)
        }
      }

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

  const login = (tokens: TokenPair, userData: User) => {
    api.setToken(tokens.access_token)
    localStorage.setItem('echoes_refresh_token', tokens.refresh_token)
    setUser(userData)
  }

  const logout = () => {
    api.logout()
    localStorage.removeItem('echoes_refresh_token')
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
