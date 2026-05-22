import { useState } from 'react'
import { useCourseList, useDeleteCourse, useSyncCourses, useUpdateWebsite } from '../hooks/useCourses'
import Pagination from '../components/shared/Pagination'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import EmptyState from '../components/shared/EmptyState'
import ErrorState from '../components/shared/ErrorState'
import { showToast } from '../components/shared/Toast'
import CourseFormModal from '../components/courses/CourseFormModal'
import EnrollStudentModal from '../components/courses/EnrollStudentModal'
import { Link } from 'react-router-dom'

export default function CoursesPage() {
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editCourse, setEditCourse] = useState<any>(null)
  const [enrollCourseId, setEnrollCourseId] = useState<number | null>(null)
  const [enrollCourseName, setEnrollCourseName] = useState('')

  const { data, isLoading, isError, refetch } = useCourseList({ page })
  const deleteMutation = useDeleteCourse()
  const syncMutation = useSyncCourses()
  const updateWebsiteMutation = useUpdateWebsite()

  const [editingWebsite, setEditingWebsite] = useState<{ id: number; name: string; url: string } | null>(null)

  const handleDelete = (id: number, name: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa khóa học "${name}"?`)) return
    deleteMutation.mutate(id, {
      onSuccess: () => showToast('success', 'Đã xóa khóa học.'),
      onError: (err: any) => showToast('error', err.message),
    })
  }

  const handleSync = () => {
    syncMutation.mutate(undefined, {
      onSuccess: (res) => showToast('success', `Đồng bộ thành công! ${res.result.total} khóa học.`),
      onError: (err: any) => showToast('error', err.message),
    })
  }

  const handleSaveWebsite = () => {
    if (!editingWebsite) return
    updateWebsiteMutation.mutate(
      { id: editingWebsite.id, web_link: editingWebsite.url },
      {
        onSuccess: () => {
          showToast('success', 'Đã cập nhật website.')
          setEditingWebsite(null)
        },
        onError: (err: any) => showToast('error', err.message),
      },
    )
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Danh sách khóa học</h2>
          <p className="text-sm text-gray-500">Quản lý các chương trình học tập đang hoạt động.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSync} disabled={syncMutation.isPending}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-all shadow-sm disabled:opacity-60">
            {syncMutation.isPending ? 'Đang đồng bộ...' : 'Đồng bộ từ Voomly'}
          </button>
          <button onClick={() => { setEditCourse(null); setShowForm(true) }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-600 text-white text-sm font-medium hover:shadow-lg hover:-translate-y-0.5 transition-all shadow-sm">
            + Thêm khóa học
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Khóa học</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Spotlight ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Website</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Học viên</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ngày tạo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && <tr><td colSpan={6}><LoadingSpinner /></td></tr>}
              {isError && <tr><td colSpan={6}><ErrorState onRetry={() => refetch()} /></td></tr>}
              {data?.courses.length === 0 && <tr><td colSpan={6}><EmptyState text="Chưa có khóa học nào." /></td></tr>}
              {data?.courses.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/courses/${c.id}`} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-xs font-bold">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900 text-sm hover:text-brand-600">{c.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {c.spotlight_id ? (
                      <code className="text-xs font-mono bg-purple-50 text-purple-700 px-2 py-0.5 rounded">{c.spotlight_id}</code>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Chưa liên kết</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {c.web_link ? (
                        <a href={c.web_link} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Truy cập</a>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Chưa cấu hình</span>
                      )}
                      <button onClick={() => setEditingWebsite({ id: c.id, name: c.name, url: c.web_link || '' })}
                        className="p-1 rounded text-gray-300 hover:text-brand-500">
                        <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                      {c.student_count || 0} học viên
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.created_at ? new Date(c.created_at).toLocaleDateString('vi-VN') : '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEnrollCourseId(c.id); setEnrollCourseName(c.name) }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Thêm học viên">
                        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                      </button>
                      <button onClick={() => { setEditCourse(c); setShowForm(true) }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Chỉnh sửa">
                        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                      </button>
                      <button onClick={() => handleDelete(c.id, c.name)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Xóa">
                        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.pagination && (
          <div className="px-4 py-3 border-t border-gray-100">
            <Pagination pagination={data.pagination} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Quick Website Edit Modal */}
      {editingWebsite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setEditingWebsite(null)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-1">Cập nhật Link Website</h3>
            <p className="text-sm text-gray-500 mb-4">Khóa học: <span className="font-medium text-gray-700">{editingWebsite.name}</span></p>
            <input type="url" value={editingWebsite.url} onChange={(e) => setEditingWebsite({ ...editingWebsite, url: e.target.value })}
              placeholder="https://example.com/course"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditingWebsite(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Hủy</button>
              <button onClick={handleSaveWebsite} disabled={updateWebsiteMutation.isPending}
                className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-60">
                {updateWebsiteMutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Course Form Modal */}
      {showForm && (
        <CourseFormModal
          course={editCourse}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); refetch() }}
        />
      )}

      {/* Enroll Modal */}
      {enrollCourseId && (
        <EnrollStudentModal
          courseId={enrollCourseId}
          courseName={enrollCourseName}
          onClose={() => { setEnrollCourseId(null); setEnrollCourseName('') }}
          onSuccess={() => { setEnrollCourseId(null); refetch() }}
        />
      )}
    </div>
  )
}
