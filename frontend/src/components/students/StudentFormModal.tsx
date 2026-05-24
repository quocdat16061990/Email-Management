import { useEffect } from 'react'
import { useCreateStudent, useUpdateStudent } from '../../hooks/useStudents'
import { showToast } from '../shared/Toast'
import Avatar from '../shared/Avatar'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Student, EnrollmentDetail } from '../../types/student'

const studentFormSchema = z.object({
  customer_email: z.string()
    .trim()
    .min(1, 'Email không được để trống')
    .email('Email không đúng định dạng'),
  full_name: z.string().trim().optional(),
  phone_number: z.string().trim().optional(),
  selectedCourses: z.record(
    z.coerce.number(),
    z.object({
      registration_date: z.string(),
      expiry_date: z.string(),
      status: z.string(),
    })
  ),
})

type StudentFormValues = z.infer<typeof studentFormSchema>

interface CourseOption {
  id: number
  name: string
}

interface SelectedCourseState {
  registration_date: string
  expiry_date: string
  status: string
}

interface Props {
  student?: Student
  courses: CourseOption[]
  onClose: () => void
  onSuccess: () => void
}

export default function StudentFormModal({ student, courses, onClose, onSuccess }: Props) {
  const createMutation = useCreateStudent()
  const updateMutation = useUpdateStudent()
  const isEdit = !!student

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      customer_email: '',
      full_name: '',
      phone_number: '',
      selectedCourses: {},
    },
  })

  const selectedCourses = watch('selectedCourses') || {}
  const name = watch('full_name') || ''

  useEffect(() => {
    if (student) {
      const map: Record<number, SelectedCourseState> = {}
      if (student.enrollments) {
        student.enrollments.forEach((e: EnrollmentDetail) => {
          map[e.course_id] = {
            registration_date: e.registration_date || '',
            expiry_date: e.expiry_date || '',
            status: e.status || 'ACTIVE',
          }
        })
      }
      reset({
        customer_email: student.customer_email || '',
        full_name: student.full_name || '',
        phone_number: student.phone_number || '',
        selectedCourses: map,
      })
    } else {
      reset({
        customer_email: '',
        full_name: '',
        phone_number: '',
        selectedCourses: {},
      })
    }
  }, [student, reset])

  const toggleCourse = (courseId: number) => {
    const next = { ...selectedCourses }
    if (next[courseId]) {
      delete next[courseId]
    } else {
      const today = new Date().toISOString().split('T')[0]
      const exp = new Date()
      exp.setFullYear(exp.getFullYear() + 1)
      next[courseId] = {
        registration_date: today,
        expiry_date: exp.toISOString().split('T')[0],
        status: 'ACTIVE',
      }
    }
    setValue('selectedCourses', next)
  }

  const updateCourseField = (courseId: number, field: keyof SelectedCourseState, value: string) => {
    const next = { ...selectedCourses }
    if (next[courseId]) {
      next[courseId] = {
        ...next[courseId],
        [field]: value,
      }
      setValue('selectedCourses', next)
    }
  }

  const onSubmit = (data: StudentFormValues) => {
    const enrollments = Object.entries(data.selectedCourses || {}).map(([courseId, details]) => ({
      course_id: parseInt(courseId),
      registration_date: details.registration_date,
      expiry_date: details.expiry_date,
      status: details.status,
    }))

    const payload = {
      customer_email: data.customer_email.trim(),
      full_name: data.full_name?.trim() || '',
      phone_number: data.phone_number?.trim() || '',
      enrollments,
    }

    if (isEdit) {
      updateMutation.mutate({ id: student.id, data: payload }, {
        onSuccess: () => {
          showToast('success', 'Đã cập nhật học viên thành công.')
          onSuccess()
        },
        onError: (err: Error) => showToast('error', err.message),
      })
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          showToast('success', 'Đã thêm học viên thành công.')
          onSuccess()
        },
        onError: (err: Error) => showToast('error', err.message),
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {isEdit && <Avatar name={name} size="sm" />}
            <div>
              <h3 className="font-bold text-gray-900">{isEdit ? 'Chỉnh sửa học viên' : 'Thêm học viên mới'}</h3>
              {isEdit && <p className="text-xs text-gray-500">ID: #{student.id}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
              <input type="text" {...register('customer_email')}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
                  errors.customer_email ? 'border-red-300 focus:border-red-300' : 'border-gray-200 focus:border-brand-300'
                }`} />
              {errors.customer_email && <p className="mt-1 text-xs text-red-500">{errors.customer_email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Họ và Tên</label>
              <input type="text" {...register('full_name')}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-300" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Số điện thoại</label>
              <input type="text" {...register('phone_number')}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-300" />
            </div>
          </div>

          {/* Courses selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Đăng ký khóa học</label>
            <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-100 rounded-xl p-3">
              {courses.map((c) => {
                const selected = selectedCourses[c.id]
                return (
                  <div key={c.id} className="border border-gray-100 rounded-lg overflow-hidden">
                    <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={!!selected} onChange={() => toggleCourse(c.id)}
                        className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                      <span className="text-sm font-medium text-gray-700">{c.name}</span>
                    </label>
                    {selected && (
                      <div className="grid grid-cols-3 gap-2 px-3 pb-3 pt-0">
                        <div>
                          <label className="block text-xs text-gray-500 mb-0.5">Ngày đăng ký</label>
                          <input type="date" value={selected.registration_date} onChange={(e) => updateCourseField(c.id, 'registration_date', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-0.5">Ngày hết hạn</label>
                          <input type="date" value={selected.expiry_date} onChange={(e) => updateCourseField(c.id, 'expiry_date', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-0.5">Trạng thái</label>
                          <select value={selected.status} onChange={(e) => updateCourseField(c.id, 'status', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500">
                            <option value="ACTIVE">Đang hoạt động</option>
                            <option value="PENDING">Chờ xử lý</option>
                            <option value="EXPIRED">Đã hết hạn</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {courses.length === 0 && <p className="text-sm text-gray-400 text-center py-2 italic">Chưa có khóa học nào.</p>}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={isPending}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-brand-500 to-accent-600 text-white text-sm font-medium hover:shadow-lg transition-all disabled:opacity-60">
              {isPending ? 'Đang xử lý...' : isEdit ? 'Cập nhật' : 'Lưu học viên'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
