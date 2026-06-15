import React from 'react'
import { X } from 'lucide-react'

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
  receipt: 'max-w-lg',
}

export default function Modal({
  open,
  onClose,
  eyebrow,
  title,
  children,
  footer,
  size = 'md',
  closeDisabled = false,
  bodyClassName = '',
}) {
  const titleId = React.useId()
  const panelRef = React.useRef(null)
  const previousFocusRef = React.useRef(null)

  React.useEffect(() => {
    if (!open) return undefined
    
    // Only capture previous focus if we're not already open
    if (!previousFocusRef.current) {
      previousFocusRef.current = document.activeElement
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !closeDisabled) {
        onClose?.()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      const focusableItems = Array.from(focusable || [])
      if (focusableItems.length === 0) {
        event.preventDefault()
        panelRef.current?.focus()
        return
      }

      const first = focusableItems[0]
      const last = focusableItems[focusableItems.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Only return focus if we are actually closing (open becomes false)
      // or if the component is being completely unmounted while open
      if (previousFocusRef.current instanceof HTMLElement) {
        const lastFocus = previousFocusRef.current
        // Use a microtask to ensure we don't focus something that's about to be unmounted
        window.queueMicrotask(() => {
          if (document.body.contains(lastFocus)) {
            lastFocus.focus()
          }
        })
      }
    }
  }, [closeDisabled, onClose, open])

  // Separate effect for initial focus to avoid yanking focus on prop updates
  const hasFocusedRef = React.useRef(false)
  React.useEffect(() => {
    if (open && !hasFocusedRef.current) {
      window.requestAnimationFrame(() => {
        // Look for data-autofocus first, then fall back to first focusable
        const autoFocusElement = panelRef.current?.querySelector('[data-autofocus="true"]')
        const firstFocusable = panelRef.current?.querySelector(
          'button:not([disabled]), a[href], textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        ;(autoFocusElement || firstFocusable || panelRef.current)?.focus()
        hasFocusedRef.current = true
      })
    } else if (!open) {
      hasFocusedRef.current = false
      previousFocusRef.current = null
    }
  }, [open])

  if (!open) return null

  const closeModal = () => {
    if (!closeDisabled) onClose?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined}>
      <button
        type="button"
        aria-label="Close modal overlay"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={closeModal}
        disabled={closeDisabled}
        tabIndex={-1}
      />
      <div ref={panelRef} tabIndex={-1} className={`relative flex max-h-[92vh] w-full ${sizeClasses[size] || sizeClasses.md} flex-col overflow-hidden rounded-3xl bg-white shadow-2xl outline-none`}>
        {(title || eyebrow || onClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">{eyebrow}</p>}
              {title && <h2 id={titleId} className="mt-1 text-lg font-black text-text-primary">{title}</h2>}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={closeModal}
                disabled={closeDisabled}
                className="rounded-2xl border border-border bg-white p-2 text-text-secondary transition hover:bg-gray-50 disabled:opacity-50"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        <div className={`flex-1 overflow-auto px-5 py-5 ${bodyClassName}`}>
          {children}
        </div>

        {footer && (
          <div className="border-t border-border bg-white px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
