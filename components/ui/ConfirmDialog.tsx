'use client'

interface ConfirmDialogProps {
  message?: string
  subMessage?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  message = '確定要刪除？',
  subMessage = '刪除後無法復原',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm px-6"
      onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-xs shadow-xl p-6 text-center"
        onClick={e => e.stopPropagation()}>
        <p className="font-semibold text-slate-800 text-base mb-1">{message}</p>
        <p className="text-sm text-slate-400 mb-6">{subMessage}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-surface-200 text-sm font-medium text-slate-600 active:bg-surface-50">
            取消
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold active:bg-brand-700">
            確定刪除
          </button>
        </div>
      </div>
    </div>
  )
}
