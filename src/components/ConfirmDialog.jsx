import Modal from './Modal'
import { Button } from './ui/Button'

export default function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  eyebrow = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
}) {
  const confirmVariant = tone === 'danger' ? 'danger' : 'primary'

  return (
    <Modal
      open={open}
      onClose={onCancel}
      eyebrow={eyebrow}
      title={title}
      size="sm"
      closeDisabled={loading}
      footer={(
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={confirmVariant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      )}
    >
      <p className="text-sm leading-6 text-text-secondary">{message}</p>
    </Modal>
  )
}

