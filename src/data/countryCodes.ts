import countryCodes from './countryCodes.json'

export interface CountryDialCode {
  name: string
  code: string
  // Two-letter ISO country code, lower case; picks the flag image.
  iso: string
  // Digits in a mobile number, without the country code or a leading 0.
  minLength: number
  maxLength: number
  // Standard-time UTC offset for the country's predominant timezone — an
  // approximation (ignores DST and multi-zone countries) good enough for a
  // CRM contact-info display, not authoritative.
  utcOffset: string
}

// ITU/E.164 calling codes, no leading "+" — that's added only for display where needed.
export const COUNTRY_CODES: CountryDialCode[] = countryCodes

export const DEFAULT_COUNTRY_CODE = '91'

export function countryForDialCode(code: string | null | undefined): CountryDialCode | null {
  if (!code) return null
  return COUNTRY_CODES.find((c) => c.code === code) ?? null
}
