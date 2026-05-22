export default function EmptyState({ text = 'Không có dữ liệu.' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2">
      <svg className="w-12 h-12 text-gray-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
      </svg>
      <p className="text-sm text-gray-400 font-medium italic">{text}</p>
    </div>
  )
}
