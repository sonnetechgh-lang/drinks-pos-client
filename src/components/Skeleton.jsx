export default function Skeleton({ className = '', variant = 'rect' }) {
  const baseClasses = 'animate-pulse bg-gray-200'
  const variantClasses = {
    rect: 'rounded-2xl',
    circle: 'rounded-full',
    text: 'rounded-md h-4 w-full',
  }

  return <div className={`${baseClasses} ${variantClasses[variant] || variantClasses.rect} ${className}`} />
}
