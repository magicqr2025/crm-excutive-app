import { parseCsv } from '@/lib/csv'

/**
 * The server refuses a request over about 100 KB, and a file goes up in one request (so it is one entry in the
 * upload history). Kept a little under that.
 */
export const MAX_UPLOAD_BYTES = 95_000

export interface UploadFileResult {
  rows: { name: string; phone: string }[]
  /** Rows left out because the name is missing or the number is too short. */
  skipped: number
  error?: string
}

/** Reads a bulk-upload file: a header row with "Name" and "Phone". Numbers are reduced to their digits. */
export function readUploadFile(text: string): UploadFileResult {
  const [header, ...body] = parseCsv(text)
  if (!header) return { rows: [], skipped: 0, error: 'The file is empty.' }
  // trim() also removes the invisible mark Excel puts before the first heading.
  const names = header.map((h) => h.trim().toLowerCase())
  const nameAt = names.indexOf('name')
  const phoneAt = names.indexOf('phone')
  if (nameAt === -1 || phoneAt === -1) return { rows: [], skipped: 0, error: 'The first row must have “Name” and “Phone” columns.' }

  const rows: UploadFileResult['rows'] = []
  let skipped = 0
  for (const cells of body) {
    const name = (cells[nameAt] ?? '').trim()
    const raw = (cells[phoneAt] ?? '').trim()
    const phone = raw.replace(/\D/g, '')
    // "9.19E+11" is how Excel writes a long number it has shortened: the real digits are gone.
    if (!name || phone.length < 6 || /\d[eE]\+\d/.test(raw)) skipped += 1
    else rows.push({ name, phone })
  }
  return { rows, skipped, ...(rows.length === 0 ? { error: 'No row has both a name and a usable phone number.' } : {}) }
}
