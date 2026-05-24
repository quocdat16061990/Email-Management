import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import StudentFormModal from './StudentFormModal'
import { useCreateStudent, useUpdateStudent } from '../../hooks/useStudents'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../hooks/useStudents', () => ({
  useCreateStudent: vi.fn(),
  useUpdateStudent: vi.fn(),
}))

vi.mock('../shared/Toast', () => ({
  showToast: vi.fn(),
}))

const queryClient = new QueryClient()

function renderStudentFormModal(props: any = {}) {
  const defaultProps = {
    courses: [{ id: 1, name: 'React Course' }],
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <StudentFormModal {...defaultProps} {...props} />
    </QueryClientProvider>
  )
}

describe('components/students/StudentFormModal.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useCreateStudent).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any)

    vi.mocked(useUpdateStudent).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any)
  })

  test('renders form controls and course select options', () => {
    renderStudentFormModal()

    expect(screen.getByText('Thêm học viên mới')).toBeInTheDocument()
    expect(screen.getByText('Họ và Tên')).toBeInTheDocument()
    expect(screen.getByText('Số điện thoại')).toBeInTheDocument()
    expect(screen.getByText('React Course')).toBeInTheDocument()
  })

  test('displays Zod validation errors on empty email submission', async () => {
    const { container } = renderStudentFormModal()

    const form = container.querySelector('form')!
    fireEvent.submit(form)

    expect(await screen.findByText('Email không được để trống')).toBeInTheDocument()
  })

  test('displays Zod validation errors on invalid email format', async () => {
    const { container } = renderStudentFormModal()

    const emailInput = container.querySelector('input[name="customer_email"]')!
    fireEvent.change(emailInput, { target: { value: 'invalid-email-string' } })

    const form = container.querySelector('form')!
    fireEvent.submit(form)

    expect(await screen.findByText('Email không đúng định dạng')).toBeInTheDocument()
  })

  test('invokes createMutation with payload when validation passes', async () => {
    const mockMutate = vi.fn()
    vi.mocked(useCreateStudent).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any)

    const { container } = renderStudentFormModal()

    const emailInput = container.querySelector('input[name="customer_email"]')!
    fireEvent.change(emailInput, { target: { value: 'student@example.com' } })

    const form = container.querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_email: 'student@example.com',
        }),
        expect.any(Object)
      )
    })
  })
})
