import { useEffect, useState, useCallback } from 'react'
import { cn } from '../../lib/utils'

interface ToastItem {
  id: number
  type: 'success' | 'error' | 'info'
  message: string
}

let addToastFn: ((type: ToastItem['type'], message: string) => void) | null = null

export function showToast(type: ToastItem['type'], message: string) {
  addToastFn?.(type, message)
}

let nextId = 0

export default function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((type: ToastItem['type'], message: string) => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  useEffect(() => {
    addToastFn = addToast
    return () => { addToastFn = null }
  }, [addToast])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-20 right-6 z-[9999] flex flex-col gap-2 min-w-[320px] max-w-[460px]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm animate-in slide-in-from-right',
            t.type === 'success' && 'bg-emerald-50 border-emerald-200 text-emerald-800',
            t.type === 'error' && 'bg-red-50 border-red-200 text-red-800',
            t.type === 'info' && 'bg-blue-50 border-blue-200 text-blue-800',
          )}
        >
          <p className="text-sm font-medium">{t.message}</p>
        </div>
      ))}
    </div>
  )
}
