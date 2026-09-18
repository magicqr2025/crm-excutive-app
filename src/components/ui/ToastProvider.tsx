import { type ReactNode, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { ToastContext, type ToastOptions } from './toast-context'

interface ToastItem extends ToastOptions {
  id: number
}

let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const show = useCallback((options: ToastOptions) => {
    const id = ++counter
    setToasts((prev) => [...prev, { ...options, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              data-slot="toast"
              className="flex items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl animate-in"
            >
              {t.tone === 'success' ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--success)]" />
              ) : t.tone === 'error' ? (
                <XCircle size={18} className="mt-0.5 shrink-0 text-[var(--error)]" />
              ) : (
                <Info size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[var(--text-h)]">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{t.description}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="text-[var(--text-muted)] hover:text-[var(--text-h)]"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
