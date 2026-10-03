// Builds the international digits WhatsApp needs (no "+", spaces or leading
// zeros) from how a contact's number is actually stored. Two shapes exist:
//   - added by hand: a local number plus a country code ("9876543210" + "91")
//   - created from an inbound WhatsApp message: the full international number
//     and no country code at all ("919876543210" + null)
// Kept in step with orm-whatsapp's src/lib/whatsapp.ts and the backend's
// contacts/phone.js.

const DEFAULT_COUNTRY_CODE = '91'
// A local number is 10 digits; anything longer is assumed to already carry its
// country code.
const LOCAL_NUMBER_LENGTH = 10
// E.164 allows at most 15 digits; below 8 can't be a real number.
const MIN_DIGITS = 8
const MAX_DIGITS = 15

export interface WhatsAppNumberInput {
  phone?: string | null
  countryCode?: string | null
}

/** Returns the digits to dial on WhatsApp, or `null` if the stored number can't be one. */
export function buildWhatsAppNumber({ phone, countryCode }: WhatsAppNumberInput): string | null {
  const digits = (phone ?? '').replace(/\D/g, '').replace(/^0+/, '')
  if (!digits) return null

  const code = (countryCode ?? '').replace(/\D/g, '')
  let full: string
  if (code) {
    full = digits.startsWith(code) && digits.length > LOCAL_NUMBER_LENGTH ? digits : code + digits
  } else {
    full = digits.length > LOCAL_NUMBER_LENGTH ? digits : DEFAULT_COUNTRY_CODE + digits
  }

  return full.length >= MIN_DIGITS && full.length <= MAX_DIGITS ? full : null
}

/** Opens WhatsApp for whichever account is logged in on the device. */
export function personalWhatsAppUrl(number: string): string {
  return `https://wa.me/${number}`
}
