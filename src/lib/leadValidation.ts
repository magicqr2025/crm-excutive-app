import { checkPhone } from '@/lib/phoneLength'

// Add New Lead form checks. Mobile is always required; email is optional but
// must look like an address when given (crmbackend also rejects a bad one).

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateMobile(countryCode: string, mobile: string): string | undefined {
  const code = countryCode.trim()
  const digits = mobile.trim()
  if (!digits) return 'Mobile number is required'
  if (!/^\d{1,4}$/.test(code)) return 'Enter a valid country code'
  // Per-country lengths, the same table the main CRM uses.
  const check = checkPhone(digits, code)
  return check.valid ? undefined : check.message
}

export function validateEmail(email: string): string | undefined {
  const value = email.trim()
  if (!value) return undefined
  return EMAIL_PATTERN.test(value) ? undefined : 'Enter a valid email address'
}

// Digits only. A pasted "+91…" or leading 0 is left in: checkPhone removes it, and cutting the number to the
// country's length here would drop real digits instead.
export function normalizeMobileInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 17)
}
