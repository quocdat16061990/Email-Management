import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StudentDetailPage from './StudentDetailPage'
import { useStudentDetail } from '../hooks/useStudents'
import { useParams, BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom')
  return {
    ...actual,
    useParams: vi.fn(),
  }
})

vi.mock('../hooks/useStudents', () => ({
  useStudentDetail: vi.fn(),
}))

const queryClient = new QueryClient()

function renderStudentDetailPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <StudentDetailPage />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('pages/StudentDetailPage.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useParams).mockReturnValue({ id: '1' })

    vi.mocked(useStudentDetail).mockReturnValue({
      data: {
        id: 1,
        full_name: 'Nguyen Van Test',
        customer_email: 'test-student@example.com',
        phone_number: '987654321',
        telegram_chat_id: '998877665',
        status: 'ACTIVE',
        registration_date: '2026-01-01',
        expiry_date: '2026-12-31',
        enrollments: [
          {
            course_id: 1,
            course_name: 'React Query Pro',
            course_description: 'Advanced react query course description',
            status: 'ACTIVE',
            registration_date: '2026-01-01',
            expiry_date: '2026-12-31',
            web_link: 'http://rqpro.org'
          }
        ]
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any)
  })

  test('renders loading spinner when data fetching is active', () => {
    vi.mocked(useStudentDetail).mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as any)

    const { container } = renderStudentDetailPage()
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  test('renders student profile information correctly', () => {
    renderStudentDetailPage()

    expect(screen.getByText('Nguyen Van Test')).toBeInTheDocument()
    expect(screen.getByText('test-student@example.com')).toBeInTheDocument()
    expect(screen.getByText('987654321')).toBeInTheDocument()
    expect(screen.getByText('998877665')).toBeInTheDocument()
  })

  test('renders student enrollments list with active links', () => {
    renderStudentDetailPage()

    expect(screen.getByText('React Query Pro')).toBeInTheDocument()
    expect(screen.getByText('Advanced react query course description')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Website Khóa Học/i })).toHaveAttribute('href', 'http://rqpro.org')
  })

  test('displays only first 3 courses and expands when clicking Xem thêm', async () => {
    const user = userEvent.setup()
    vi.mocked(useStudentDetail).mockReturnValue({
      data: {
        id: 1,
        full_name: 'Nguyen Van Test',
        customer_email: 'test-student@example.com',
        phone_number: '987654321',
        status: 'ACTIVE',
        registration_date: '2026-01-01',
        expiry_date: '2026-12-31',
        enrollments: [
          { course_id: 1, course_name: 'Course 1', status: 'ACTIVE' },
          { course_id: 2, course_name: 'Course 2', status: 'ACTIVE' },
          { course_id: 3, course_name: 'Course 3', status: 'ACTIVE' },
          { course_id: 4, course_name: 'Course 4', status: 'ACTIVE' },
        ]
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any)

    renderStudentDetailPage()

    // Course 1-3 should be in document
    expect(screen.getByText('Course 1')).toBeInTheDocument()
    expect(screen.getByText('Course 2')).toBeInTheDocument()
    expect(screen.getByText('Course 3')).toBeInTheDocument()
    
    // Course 4 should NOT be visible initially
    expect(screen.queryByText('Course 4')).not.toBeInTheDocument()

    // There should be a "Xem thêm" button
    const loadMoreBtn = screen.getByRole('button', { name: /Xem thêm/i })
    expect(loadMoreBtn).toBeInTheDocument()

    // Click it
    await user.click(loadMoreBtn)

    // Now Course 4 should be rendered!
    expect(screen.getByText('Course 4')).toBeInTheDocument()

    // Button text should change to "Thu gọn"
    expect(screen.getByRole('button', { name: /Thu gọn/i })).toBeInTheDocument()
  })
})
