import { useMutation } from '@tanstack/react-query'
import { login, logout, type LoginInput } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export function useLogin() {
  const { checkAuth } = useAuth()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (data: LoginInput) => login(data),
    onSuccess: (res) => {
      if (res.success) {
        checkAuth()
        navigate('/dashboard')
      }
    },
  })
}

export function useLogout() {
  const navigate = useNavigate()
  const { checkAuth } = useAuth()

  return useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      checkAuth()
      navigate('/login')
    },
  })
}
