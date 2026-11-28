import { COUNTRY_CODES } from '@/data/countryCodes'

// Length check for a number typed beside a country code box. It says nothing about
// whether the number exists. Keep in step with crmbackend's scheduling/phoneLength.js.

export interface PhoneCheck {
  // The number without its country code or leading zeros.
  national: string
  valid: boolean
  // Why it isn't valid; empty when it is.
  message: string
}

// For a typed code that isn't in the list: E.164 allows 15 digits in all.
const MIN_UNKNOWN = 6
const MAX_TOTAL = 15

export function checkPhone(input: string, countryCode: string): PhoneCheck {
  const countries = COUNTRY_CODES.filter((c) => c.code === countryCode)
  const min = countries[0]?.minLength ?? MIN_UNKNOWN
  const max = countries[0]?.maxLength ?? MAX_TOTAL - countryCode.length

  const typed = input.trim()
  let national = typed.replace(/\D/g, '')
  // The code typed again in the number box ("+91…" or "0091…") isn't part of the number.
  if (typed.startsWith('+') && national.startsWith(countryCode)) national = national.slice(countryCode.length)
  else if (national.startsWith(`00${countryCode}`)) national = national.slice(countryCode.length + 2)
  national = national.replace(/^0+/, '')
  // Same without the "+" ("919876543210"), only when that is what makes it too long.
  if (national.length > max && national.startsWith(countryCode)) {
    const rest = national.slice(countryCode.length)
    if (rest.length >= min && rest.length <= max) national = rest
  }

  if (!/^\+?[\d\s().-]*$/.test(typed)) {
    return { national, valid: false, message: 'Use digits only' }
  }
  if (national.length < min || national.length > max) {
    // Several countries share some codes, so those are named by the code.
    const who = countries.length === 1 ? `${countries[0].name} numbers` : `Numbers with code +${countryCode}`
    const wanted = min === max ? `${min}` : `${min} to ${max}`
    return { national, valid: false, message: `${who} must be ${wanted} digits (you entered ${national.length})` }
  }
  return { national, valid: true, message: '' }
}
