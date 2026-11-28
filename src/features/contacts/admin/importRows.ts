// Reading the import file. Same columns and rules as orm-whatsapp's import.
import { parseCsv } from '@/lib/csv'

export interface ImportRow {
  name: string
  countryCode: string
  phone: string
  email: string
  statusName: string
  labelNames: string[]
}

export const TEMPLATE_ROWS = [
  ['Name', 'Country Code', 'Mobile Number', 'Email', 'Lead Status', 'Labels'],
  ['Jane Doe', '91', '9998887777', 'jane@example.com', '', 'VIP|Diwali Lead'],
]

/** Several labels in one cell: split by | ; or , */
export const splitNames = (text: string) =>
  text
    .split(/[\n\r,;|]/)
    .map((n) => n.trim())
    .filter(Boolean)

export function readImportRows(text: string): ImportRow[] {
  const [header, ...body] = parseCsv(text)
  if (!header) return []
  const names = header.map((h) => h.trim().toLowerCase())
  const column = (...wanted: string[]) => wanted.map((w) => names.indexOf(w)).find((i) => i !== -1) ?? -1
  const at = {
    name: column('name'),
    phone: column('phone', 'mobile number', 'mobile', 'phone number'),
    code: column('country code', 'country_code', 'code'),
    email: column('email'),
    status: column('lead status', 'lead_status', 'status'),
    labels: column('labels', 'label', 'tags', 'tag'),
  }
  return body.map((cells) => {
    const cell = (i: number) => (i === -1 ? '' : (cells[i] ?? '').trim())
    return {
      name: cell(at.name),
      phone: cell(at.phone).replace(/\D/g, ''),
      countryCode: cell(at.code).replace(/\D/g, ''),
      email: cell(at.email),
      statusName: cell(at.status),
      labelNames: splitNames(cell(at.labels)),
    }
  })
}

/** Label names from a file: its "Label" / "Name" column, or the first column when there is no such header. */
export function readLabelNames(text: string): string[] {
  const rows = parseCsv(text)
  if (rows.length === 0) return []
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const found = header.findIndex((h) => h === 'label' || h === 'labels' || h === 'name')
  return (found === -1 ? rows : rows.slice(1)).flatMap((cells) => splitNames(cells[found === -1 ? 0 : found] ?? ''))
}
