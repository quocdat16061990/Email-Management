import { createContext, useContext, type ReactNode } from 'react'
import { fetchDashboardStats } from '../api/auth'
import { useQuery } from '@tanstack/react-query'

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
  const { data, isLoading, isSuccess, refetch } = useQuery({
    queryKey: ['auth-status'],
    queryFn: fetchDashboardStats,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const isAuthenticated = isSuccess && !!data
  const operatorEmail = ''

  const checkAuth = () => {
    refetch()
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, operatorEmail, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
