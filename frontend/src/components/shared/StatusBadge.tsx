import { cn } from '../../lib/utils'

const statusMap: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Đang hoạt động', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  PENDING: { label: 'Chờ xử lý', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  EXPIRED: { label: 'Đã hết hạn', className: 'bg-red-100 text-red-700 border-red-200' },
}

export default function StatusBadge({ status }: { status: string }) {
  const s = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-700 border-gray-200' }
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0 rounded-[4px] text-[10px] font-semibold border leading-normal', s.className)}>
      {s.label}
    </span>
  )
}
