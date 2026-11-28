import type { TeamMember } from '@/api/teamApi'

export const staffName = (m: TeamMember) => [m.first_name, m.last_name].filter(Boolean).join(' ') || m.user_email || 'Unnamed'

export type Availability = 'working' | 'not_working' | 'inactive'

export const availabilityOf = (m: TeamMember): Availability => (m.status !== '1' ? 'inactive' : m.on_leave ? 'not_working' : 'working')

export const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong')

// No look-alike characters (0/O, 1/l/I), so a password read out loud or retyped still works.
const PASSWORD_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

export function generatePassword(length = 10): string {
  const numbers = new Uint32Array(length)
  crypto.getRandomValues(numbers)
  return Array.from(numbers, (n) => PASSWORD_CHARS[n % PASSWORD_CHARS.length]).join('')
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const MIN_PASSWORD = 8

export const SELECT_CLASSES =
  'h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-h)] outline-none transition-colors focus:border-[var(--accent-border)]'
