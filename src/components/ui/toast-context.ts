import { createContext } from 'react'

export interface ToastOptions {
  title: string
  description?: string
  tone?: 'default' | 'success' | 'error'
}

export interface ToastContextValue {
  show: (options: ToastOptions) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
