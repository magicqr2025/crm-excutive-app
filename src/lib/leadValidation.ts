// Add New Lead form checks. Mobile is always required; email is optional but
// must look like an address when given (crmbackend also rejects a bad one).

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const INDIAN_MOBILE_PATTERN = /^\d{10}$/

export function mobileMaxLength(countryCode: string): number {
  return countryCode === '91' ? 10 : 15
}

export function validateMobile(countryCode: string, mobile: string): string | undefined {
  const code = countryCode.trim()
  const digits = mobile.trim()
  if (!digits) return 'Mobile number is required'
  if (!/^\d{1,4}$/.test(code)) return 'Enter a valid country code'
  if (!/^\d+$/.test(digits)) return 'Mobile number can only contain digits'
  if (code === '91') {
    return INDIAN_MOBILE_PATTERN.test(digits) ? undefined : 'Enter a valid 10-digit mobile number'
  }
  // E.164 caps the full number (country code + subscriber number) at 15 digits.
  if (digits.length < 6 || code.length + digits.length > 15) return 'Enter a valid mobile number'
  return undefined
}

export function validateEmail(email: string): string | undefined {
  const value = email.trim()
  if (!value) return undefined
  return EMAIL_PATTERN.test(value) ? undefined : 'Enter a valid email address'
}

// Keeps digits only, drops the country code if it was pasted in front
// (e.g. "+91 98765 43210"), and caps the length for that country.
export function normalizeMobileInput(raw: string, countryCode: string): string {
  let digits = raw.replace(/\D/g, '')
  const max = mobileMaxLength(countryCode)
  if (countryCode && digits.length > max && digits.startsWith(countryCode)) digits = digits.slice(countryCode.length)
  return digits.slice(0, max)
}
