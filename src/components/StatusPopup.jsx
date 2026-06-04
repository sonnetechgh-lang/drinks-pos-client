import { CheckCircle, AlertCircle, X } from 'lucide-react'

export default function StatusPopup({ message, onClose }) {
  if (!message) return null

  const isSuccess = message.type === 'success'
  const isWarning = message.type === 'warning'

  return (
    <div className="fixed right-4 top-4 z-[70] w-[min(360px,calc(100vw-2rem))]">
      <div className={`rounded-2xl border bg-white p-4 shadow-2xl ${
        isSuccess
          ? 'border-success/20'
          : isWarning
            ? 'border-warning/20'
            : 'border-danger/20'
      }`}>
        <div className="flex items-start gap-3">
          {isSuccess ? (
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          ) : (
            <AlertCircle className={`mt-0.5 h-5 w-5 shrink-0 ${isWarning ? 'text-warning' : 'text-danger'}`} />
          )}
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${
              isSuccess ? 'text-success' : isWarning ? 'text-warning' : 'text-danger'
            }`}>
              {isSuccess ? 'Success' : isWarning ? 'Pending Sync' : 'Failed'}
            </p>
            <p className="mt-1 text-sm text-text-primary">{message.text}</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1 text-text-muted transition hover:bg-gray-100 hover:text-text-primary"
              aria-label="Close message"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
