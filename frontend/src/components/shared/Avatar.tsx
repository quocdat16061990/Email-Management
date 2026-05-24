import { cn } from '../../lib/utils'

export default function Avatar({ name, size = 'sm' }: { name?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const initials = (name || 'HV').slice(0, 2).toUpperCase()
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
  }
  return (
    <div className={cn(
      'rounded-xl bg-gradient-to-br from-brand-500 to-accent-600 flex items-center justify-center text-white font-bold shadow-md shadow-brand-500/20',
      sizeClasses[size],
    )}>
      {initials}
    </div>
  )
}
