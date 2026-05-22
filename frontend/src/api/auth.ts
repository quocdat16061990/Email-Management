import { apiPost, apiGet } from './client'
import type { DashboardStats } from '../types/api'

export interface LoginInput {
  email: string
  password: string
}

export interface LoginResult {
  success: boolean
  operator_email?: string
  error?: string
}

export function login(input: LoginInput): Promise<LoginResult> {
  return apiPost<LoginResult>('/api/login/', input)
}

export function logout(): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>('/api/logout/', {})
}

export function fetchDashboardStats(): Promise<DashboardStats> {
  return apiGet<DashboardStats>('/api/dashboard/stats/')
}
