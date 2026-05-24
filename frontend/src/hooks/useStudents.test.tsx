import { describe, test, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import {
  useStudentList,
  useStudentDetail,
  useCreateStudent,
} from './useStudents'

const server = setupServer(
  http.get('/api/dashboard/', () => {
    return HttpResponse.json({
      students: [{ id: 1, full_name: 'Hook Student' }],
      pagination: { total_pages: 1, current_page: 1, total_items: 1 },
      operator_email: 'admin@example.com',
    })
  }),

  http.get('/api/students/1/', () => {
    return HttpResponse.json({
      id: 1,
      full_name: 'Hook Student',
      customer_email: 'hook@example.com',
      status: 'ACTIVE',
    })
  }),

  http.post('/api/dashboard/create/', async ({ request }) => {
    const body = (await request.json()) as any
    return HttpResponse.json({ success: true, student: { id: 5, ...body } })
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('hooks/useStudents.ts', () => {
  test('useStudentList fetches students successfully', async () => {
    const { result } = renderHook(() => useStudentList({ page: 1 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.students[0].full_name).toBe('Hook Student')
  })

  test('useStudentDetail fetches student details when id is given', async () => {
    const { result } = renderHook(() => useStudentDetail(1), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.full_name).toBe('Hook Student')
    expect(result.current.data?.customer_email).toBe('hook@example.com')
  })

  test('useCreateStudent creates student successfully', async () => {
    const { result } = renderHook(() => useCreateStudent(), {
      wrapper: createWrapper(),
    })

    await result.current.mutateAsync({ customer_email: 'new-hook@example.com', full_name: 'New Hook Student' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.student.id).toBe(5)
    expect(result.current.data?.student.full_name).toBe('New Hook Student')
  })
})
