// followup_date/followup_time come from Postgres `@db.Date`/`@db.Time`
// columns, which carry no timezone of their own. crmbackend has no
// per-business timezone yet and always means India Standard Time — it writes
// the intended IST wall-clock digits into the UTC slot of the DateTime it
// hands Prisma (`new Date('1970-01-01T' + time + 'Z')` in
// followups.controller.js), the same encoding documented and undone by
// crmbackend's leads.service.js `followupInstant()`. To display these as IST
// (not whatever zone the viewer's own browser happens to be in), undo that
// encoding to recover the real UTC instant, then format it in Asia/Kolkata.
const IST_TIME_ZONE = 'Asia/Kolkata'
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function toRealInstant(d: Date) {
  return new Date(d.getTime() - IST_OFFSET_MS)
}

export function formatDate(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : toRealInstant(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric', timeZone: IST_TIME_ZONE })
}

export function formatTime(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : toRealInstant(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: IST_TIME_ZONE })
}

export const STATUS_LABEL: Record<string, string> = { '0': 'Pending', '1': 'Scheduled', '2': 'Done' }
export const STATUS_TONE: Record<string, 'warning' | 'accent' | 'success'> = { '0': 'warning', '1': 'accent', '2': 'success' }
