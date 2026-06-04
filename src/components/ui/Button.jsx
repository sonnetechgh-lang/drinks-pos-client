import { Loader2 } from 'lucide-react'

const variants = {
  primary: 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20 hover:bg-brand-blue-dark disabled:bg-gray-300 disabled:text-gray-600 disabled:shadow-none',
  secondary: 'border border-border bg-white text-text-secondary hover:bg-gray-50 disabled:opacity-60',
  danger: 'bg-danger text-white hover:bg-danger/90 disabled:bg-gray-300 disabled:text-gray-600',
  ghost: 'text-text-secondary hover:bg-gray-50 disabled:opacity-60',
}

const sizes = {
  sm: 'rounded-xl px-3 py-2 text-xs',
  md: 'rounded-2xl px-5 py-3 text-sm',
  lg: 'rounded-3xl px-6 py-4 text-base',
  icon: 'h-10 w-10 rounded-xl p-0',
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-bold transition ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

