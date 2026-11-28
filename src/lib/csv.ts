// A small CSV reader and writer (quoted fields, doubled quotes), as in orm-whatsapp.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char !== '"') field += char
      else if (text[i + 1] === '"') {
        field += '"'
        i++
      } else inQuotes = false
      continue
    }
    if (char === '"') inQuotes = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0))
}

/**
 * Text typed by people (names, emails) can start like a spreadsheet formula, which Excel would run.
 * A leading apostrophe makes it plain text. Use it on free text, not on phone numbers.
 */
export const safeText = (value: string | null | undefined) => (value && /^[=+\-@\t\r]/.test(value) ? `'${value}` : (value ?? ''))

const escapeField = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map((cell) => escapeField(cell === null || cell === undefined ? '' : String(cell))).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  // The leading mark tells Excel the file is UTF-8, so names in other scripts read correctly.
  const url = URL.createObjectURL(new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
