import type { CrmSubscription, SubscriptionLostReason } from '@/api/crmApi'

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'error'

/** 2026-10-10 → "10 Oct 2026". Dates are calendar dates, so format without time-zone shifts. */
export function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Adds calendar months, clamping to the end of a shorter month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(ymd: string, months: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))).toISOString().slice(0, 10)
}

/** Quick-pick term lengths. */
export const DURATION_OPTIONS: { months: number; label: string }[] = [
  { months: 1, label: '1 month' },
  { months: 3, label: '3 months' },
  { months: 6, label: '6 months' },
  { months: 12, label: '12 months' },
]

/** Last day of a term of `months` months starting on `startYmd` (8 Oct + 1 month ends 7 Nov). */
export function endForDuration(startYmd: string, months: number): string {
  return addDays(addMonths(startYmd, months), -1)
}

export const LOST_REASON_OPTIONS: { value: SubscriptionLostReason; label: string }[] = [
  { value: 'price_too_high', label: 'Price too high' },
  { value: 'switched_competitor', label: 'Switched to a competitor' },
  { value: 'no_longer_needed', label: 'No longer needed' },
  { value: 'no_response', label: 'No response' },
  { value: 'other', label: 'Other' },
]

export function lostReasonLabel(reason: string | null): string {
  return LOST_REASON_OPTIONS.find((o) => o.value === reason)?.label ?? 'Not interested'
}

/** Today's calendar date in the viewer's time zone, as YYYY-MM-DD. */
export function todayYmd(): string {
  return new Date().toLocaleDateString('en-CA')
}

/** What the "new subscription sale" section of the Log payment form collects. */
export interface SaleDraft {
  productId: string
  /** Text, so the field can be empty while typing. */
  soldAmount: string
  /** True once the executive typed their own amount, so changing product won't overwrite it. */
  amountTouched: boolean
  startDate: string
  endDate: string
  /** Which duration chip the end date came from; null once the end date is typed by hand. */
  months: number | null
}

export function newSaleDraft(): SaleDraft {
  const start = todayYmd()
  return { productId: '', soldAmount: '', amountTouched: false, startDate: start, endDate: endForDuration(start, 12), months: 12 }
}

export function isSaleDraftValid(d: SaleDraft): boolean {
  const sold = Number(d.soldAmount)
  return d.productId !== '' && Number.isFinite(sold) && sold > 0 && d.startDate !== '' && d.endDate > d.startDate
}

export const MOP_OPTIONS = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other']

/** Idempotency key for one payment submit, so a retry can't record the money twice. */
export function newRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** Subscriptions that can still receive money (a renewed term may still owe its balance). */
export function canReceivePayment(sub: Pick<CrmSubscription, 'status' | 'balance'>): boolean {
  return (sub.status === 'active' || sub.status === 'expired' || sub.status === 'renewed') && (sub.balance ?? 0) > 0
}

/** 4999.5 becomes "₹4,999.50"; a dash when no amount was recorded. */
export function formatAmount(amount: number | null): string {
  if (amount === null) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount)
}

export function daysLeftLabel(sub: Pick<CrmSubscription, 'status' | 'days_left'>): string {
  if (sub.status === 'expired') return 'Expired'
  if (sub.status === 'renewed') return 'Renewed'
  if (sub.status === 'cancelled') return 'Cancelled'
  if (sub.status === 'lost') return 'Lost'
  const left = sub.days_left ?? 0
  if (left <= 0) return 'Ends today'
  return left === 1 ? '1 day left' : `${left} days left`
}

export function daysLeftTone(sub: Pick<CrmSubscription, 'status' | 'days_left'>): Tone {
  if (sub.status === 'expired') return 'error'
  if (sub.status !== 'active') return 'neutral'
  const left = sub.days_left ?? 0
  if (left <= 3) return 'error'
  if (left <= 7) return 'warning'
  return 'success'
}
