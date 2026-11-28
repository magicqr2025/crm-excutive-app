/** The month named in the address (?month=&year=), otherwise the current one. */
export function monthFromParams(params: URLSearchParams, now = new Date()): { month: number; year: number } {
  const month = Number(params.get('month'))
  const year = Number(params.get('year'))
  const valid = Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(year) && year >= 2000 && year <= 2100
  return valid ? { month, year } : { month: now.getMonth() + 1, year: now.getFullYear() }
}
