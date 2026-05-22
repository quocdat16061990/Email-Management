import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { fetchDashboardStats } from '../api/auth'

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  operatorEmail: string
  checkAuth: () => void
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  operatorEmail: '',
  checkAuth: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [operatorEmail, setOperatorEmail] = useState('')

  const checkAuth = () => {
    fetchDashboardStats()
      .then(() => setIsAuthenticated(true))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    checkAuth()
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, operatorEmail, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
