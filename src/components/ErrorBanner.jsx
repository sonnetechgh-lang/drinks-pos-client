import { AlertCircle, RefreshCw } from 'lucide-react'

export default function ErrorBanner({ message, onRetry, retryLabel = 'Retry' }) {
  if (!message) return null

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-danger/25 bg-danger-light/40 p-4 text-sm text-danger sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="font-semibold">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-danger/20 bg-white px-4 py-2 text-xs font-bold text-danger transition hover:bg-danger-light/30"
        >
          <RefreshCw size={14} /> {retryLabel}
        </button>
      )}
    </div>
  )
}
