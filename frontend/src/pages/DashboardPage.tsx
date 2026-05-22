import { useState, useEffect } from 'react'
import { useStudentList, useDeleteStudent, useSyncStudents } from '../hooks/useStudents'
import { useCourseList } from '../hooks/useCourses'
import { fetchDashboardStats } from '../api/auth'
import SearchInput from '../components/shared/SearchInput'
import Pagination from '../components/shared/Pagination'
import StatusBadge from '../components/shared/StatusBadge'
import Avatar from '../components/shared/Avatar'
import EmptyState from '../components/shared/EmptyState'
import ErrorState from '../components/shared/ErrorState'
import { showToast } from '../components/shared/Toast'
import StudentFormModal from '../components/students/StudentFormModal'
import { Link } from 'react-router-dom'

export default function DashboardPage() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [searchValue, setSearchValue] = useState('')
  const [editStudent, setEditStudent] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading, isError, refetch } = useStudentList({ q: query, page })
  const statsQuery = useDashboardStats()
  const deleteMutation = useDeleteStudent()
  const syncMutation = useSyncStudents()
  const coursesQuery = useCourseList({ page: 1 })
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    fetchDashboardStats().then(setStats).catch(() => {})
  }, [])

  const handleSearch = (val: string) => {
    setSearchValue(val)
    setQuery(val)
    setPage(1)
  }

  const handleDelete = (id: number, name: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa học viên "${name}"?`)) return
    deleteMutation.mutate(id, {
      onSuccess: () => showToast('success', 'Đã xóa học viên thành công.'),
      onError: (err: any) => showToast('error', err.message),
    })
  }

  const handleSync = () => {
    syncMutation.mutate(undefined, {
      onSuccess: (res) => showToast('success', `Đồng bộ thành công! ${res.result.total_students} học viên.`),
      onError: (err: any) => showToast('error', err.message),
    })
  }

  const openCreate = () => {
    setEditStudent(null)
    setShowForm(true)
  }

  const openEdit = (student: any) => {
    setEditStudent(student)
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tổng học viên', value: stats?.total_students ?? 0, color: 'from-brand-500 to-brand-600' },
          { label: 'Đang hoạt động', value: stats?.active_count ?? 0, color: 'from-emerald-500 to-emerald-600' },
          { label: 'Chờ xử lý', value: stats?.pending_count ?? 0, color: 'from-amber-500 to-amber-600' },
          { label: 'Đã hết hạn', value: stats?.expired_count ?? 0, color: 'from-red-500 to-red-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.label}</p>
            <p className={`mt-1 text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="w-full sm:w-72">
          <SearchInput value={searchValue} onChange={handleSearch} placeholder="Tìm kiếm học viên..." />
        </div>
        <div className="flex gap-2">
          <button onClick={handleSync} disabled={syncMutation.isPending}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-all shadow-sm disabled:opacity-60"
          >
            {syncMutation.isPending ? 'Đang đồng bộ...' : 'Đồng bộ từ Voomly'}
          </button>
          <button onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-600 text-white text-sm font-medium hover:shadow-lg hover:-translate-y-0.5 transition-all shadow-sm"
          >
            + Thêm học viên
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Học viên</th>
                <th className="text-left px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Số điện thoại</th>
                <th className="text-left px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Khóa học</th>
                <th className="text-left px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                <th className="text-left px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hết hạn</th>
                <th className="text-right px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr><td colSpan={7}>
                  <div className="flex items-center justify-center py-8 gap-2">
                    <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-gray-400">Đang tải dữ liệu...</span>
                  </div>
                </td></tr>
              )}
              {isError && (
                <tr><td colSpan={7}><ErrorState onRetry={() => refetch()} /></td></tr>
              )}
              {data?.students.length === 0 && (
                <tr><td colSpan={7}><EmptyState text="Không tìm thấy học viên nào." /></td></tr>
              )}
              {data?.students.map((s) => {
                const courseCount = s.enrollments?.length || 0
                return (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={s.full_name} />
                        <Link to={`/students/${s.id}`} className="font-medium text-gray-900 hover:text-brand-600 text-sm">
                          {s.full_name || 'Chưa cập nhật'}
                        </Link>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-sm text-gray-500">{s.customer_email}</td>
                    <td className="px-2 py-3 text-sm text-gray-500">{s.phone_number || '-'}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.enrollments?.slice(0, 1).map((e) => (
                          <Link key={e.course_id} to={`/courses/${e.course_id}`}
                            className="inline-flex px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100 hover:bg-purple-100 transition-colors">
                            {e.course_name}
                          </Link>
                        ))}
                        {courseCount > 1 && (
                          <Link to={`/students/${s.id}`}
                            className="inline-flex px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-xs font-medium hover:bg-gray-200 transition-colors">
                            +{courseCount - 1}
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-2 py-3 text-sm text-gray-500">{s.expiry_date || '-'}</td>
                    <td className="px-2 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(s)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Chỉnh sửa"
                        >
                          <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        </button>
                        <button onClick={() => handleDelete(s.id, s.full_name)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Xóa"
                        >
                          <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {data?.pagination && (
          <div className="px-2 py-3 border-t border-gray-100">
            <Pagination pagination={data.pagination} onPageChange={setPage} />
          </div>
        )}
      </div>

      {showForm && (
        <StudentFormModal
          student={editStudent}
          courses={(coursesQuery.data?.courses || []).map((c) => ({ id: c.id, name: c.name }))}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            refetch()
          }}
        />
      )}
    </div>
  )
}

function useDashboardStats() {
  return useStudentList({ page: 1 }) as any
}
