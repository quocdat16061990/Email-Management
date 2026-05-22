import { useState, useEffect } from 'react'
import { useCreateCourse, useUpdateCourse } from '../../hooks/useCourses'
import { showToast } from '../shared/Toast'

interface Props {
  course?: any
  onClose: () => void
  onSuccess: () => void
}

export default function CourseFormModal({ course, onClose, onSuccess }: Props) {
  const createMutation = useCreateCourse()
  const updateMutation = useUpdateCourse()
  const isEdit = !!course

  const [name, setName] = useState('')
  const [spotlightId, setSpotlightId] = useState('')
  const [description, setDescription] = useState('')
  const [webLink, setWebLink] = useState('')
  const [links, setLinks] = useState<{ title: string; url: string }[]>([])

  useEffect(() => {
    if (course) {
      setName(course.name || '')
      setSpotlightId(course.spotlight_id || '')
      setDescription(course.description || '')
      setWebLink(course.web_link || '')
      setLinks(course.links || [])
    }
  }, [course])

  const addLink = () => setLinks([...links, { title: '', url: '' }])
  const removeLink = (i: number) => setLinks(links.filter((_, idx) => idx !== i))
  const updateLink = (i: number, field: 'title' | 'url', value: string) => {
    const next = [...links]
    next[i] = { ...next[i], [field]: value }
    setLinks(next)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      showToast('error', 'Tên khóa học không được để trống')
      return
    }

    const payload = {
      name: name.trim(),
      spotlight_id: spotlightId.trim(),
      description: description.trim(),
      web_link: webLink.trim(),
      links: links.filter((l) => l.title.trim() && l.url.trim()),
    }

    if (isEdit) {
      updateMutation.mutate({ id: course.id, data: payload }, {
        onSuccess: () => { showToast('success', 'Đã cập nhật khóa học.'); onSuccess() },
        onError: (err: any) => showToast('error', err.message),
      })
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { showToast('success', 'Đã tạo khóa học.'); onSuccess() },
        onError: (err: any) => showToast('error', err.message),
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{isEdit ? 'Chỉnh sửa khóa học' : 'Thêm khóa học mới'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tên khóa học <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Spotlight ID</label>
            <input type="text" value={spotlightId} onChange={(e) => setSpotlightId(e.target.value)} placeholder="Ví dụ: rwbteni8pn"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Link website</label>
            <input type="url" value={webLink} onChange={(e) => setWebLink(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Mô tả</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none" />
          </div>

          {/* Links */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">Liên kết học tập</label>
              <button type="button" onClick={addLink} className="text-xs text-brand-600 hover:text-brand-700 font-medium">+ Thêm liên kết</button>
            </div>
            <div className="space-y-2">
              {links.map((link, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input type="text" value={link.title} onChange={(e) => updateLink(i, 'title', e.target.value)} placeholder="Tên"
                    className="flex-1 px-2 py-1.5 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  <input type="url" value={link.url} onChange={(e) => updateLink(i, 'url', e.target.value)} placeholder="URL"
                    className="flex-[2] px-2 py-1.5 rounded border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  <button type="button" onClick={() => removeLink(i)} className="p-1.5 text-gray-300 hover:text-red-500">
                    <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Hủy</button>
            <button type="submit" disabled={isPending}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-brand-500 to-accent-600 text-white text-sm font-medium hover:shadow-lg disabled:opacity-60">
              {isPending ? 'Đang xử lý...' : isEdit ? 'Cập nhật' : 'Lưu khóa học'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
