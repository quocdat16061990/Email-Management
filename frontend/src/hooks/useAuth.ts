import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { login, logout, fetchDashboardStats, type LoginInput } from '../api/auth'
import { useNavigate } from 'react-router-dom'

export function useLogin() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (data: LoginInput) => login(data),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['auth-status'] })
        navigate('/dashboard')
      }
    },
  })
}

export function useLogout() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-status'] })
      qc.clear()
      navigate('/login')
    },
  })
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
  })
}
