import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useLabels, useLeadStatuses } from '@/api/queries'
import { setLeadLabels } from '@/api/crmApi'
import { addLabels, importLead } from '@/api/leadSetupApi'
import { downloadCsv } from '@/lib/csv'
import { cn } from '@/lib/utils'
import { TEMPLATE_ROWS, readImportRows, type ImportRow } from './importRows'

interface RowResult {
  row: number
  name: string
  ok: boolean
  message: string
}

/** Mounted only while open. Rows are added one at a time, so each one gets its own result. */
export function ImportContactsDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: statuses = [] } = useLeadStatuses()
  const { data: labels = [] } = useLabels()
  const input = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileError, setFileError] = useState('')
  // Added to every imported contact, besides the file's Labels column.
  const [commonLabelIds, setCommonLabelIds] = useState<string[]>([])
  const [labelSearch, setLabelSearch] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<RowResult[] | null>(null)
  const stop = useRef(false)

  const close = () => !importing && onClose()

  async function pick(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    try {
      const parsed = readImportRows(await file.text())
      setRows(parsed)
      setFileError(parsed.length === 0 ? 'No rows found. The file needs a header row and at least one contact.' : '')
    } catch {
      setRows([])
      setFileError('Could not read that file.')
    }
    // So the same file can be chosen again after fixing it.
    if (input.current) input.current.value = ''
  }

  async function start() {
    setImporting(true)
    setProgress(0)
    stop.current = false
    const outcomes: RowResult[] = []

    // Every label named in the file is made sure to exist first, in one request.
    const labelIdByName = new Map<string, string>()
    let labelProblem = ''
    const named = [...new Set(rows.flatMap((r) => r.labelNames))]
    if (named.length > 0) {
      try {
        for (const label of await addLabels(named)) labelIdByName.set(label.name.toLowerCase(), label.id)
      } catch (err) {
        labelProblem = err instanceof Error ? err.message : 'Could not create the labels'
      }
    }

    for (let i = 0; i < rows.length && !stop.current; i++) {
      const row = rows[i]
      // Line number in the file: the header is line 1.
      const result = (ok: boolean, message: string) => outcomes.push({ row: i + 2, name: row.name || '(no name)', ok, message })
      const status = row.statusName ? statuses.find((s) => s.status !== '0' && s.lead_status.toLowerCase() === row.statusName.toLowerCase()) : undefined
      if (!row.name || !row.phone) result(false, 'Missing name or mobile number')
      else if (row.statusName && !status) result(false, `Lead status “${row.statusName}” not found`)
      else {
        try {
          const lead = await importLead({ name: row.name, phone: row.phone, countryCode: row.countryCode || undefined, email: row.email || undefined, leadStatusId: status?.id })
          const ids = [...new Set([...commonLabelIds, ...row.labelNames.flatMap((n) => labelIdByName.get(n.toLowerCase()) ?? [])])]
          let note = ''
          if (ids.length > 0) {
            try {
              await setLeadLabels(lead.id, ids)
            } catch {
              note = 'Added, but its labels could not be applied'
            }
          }
          if (!note && labelProblem && row.labelNames.length > 0) note = `Added, but file labels could not be applied (${labelProblem})`
          result(true, note)
        } catch (err) {
          result(false, err instanceof Error ? err.message : 'Could not add this contact')
        }
      }
      setProgress(i + 1)
    }

    setResults(outcomes)
    setImporting(false)
    void queryClient.invalidateQueries()
  }

  const added = results?.filter((r) => r.ok).length ?? 0
  const notes = results?.filter((r) => !r.ok || r.message) ?? []
  const notRun = results ? rows.length - results.length : 0

  return (
    <Dialog open onClose={close} className="sm:max-w-lg">
      <Dialog.Header>
        <Dialog.Title>Import contacts</Dialog.Title>
        <Dialog.CloseButton onClose={close} />
      </Dialog.Header>
      <Dialog.Body className="space-y-4">
        {results ? (
          <>
            <p className="text-[14px] font-semibold text-[var(--text-h)]">
              {added} imported, {results.length - added} skipped{notRun > 0 ? `, ${notRun} not tried (stopped)` : ''}
            </p>
            {notes.length > 0 && (
              <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                {notes.map((r) => (
                  <li key={r.row} className="px-3 py-2 text-[12.5px]">
                    <span className="block font-medium text-[var(--text-h)]">
                      Row {r.row}: {r.name}
                    </span>
                    <span className={r.ok ? 'text-[var(--warning)]' : 'text-[var(--error)]'}>{r.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <button type="button" onClick={() => downloadCsv('contacts-import-template.csv', TEMPLATE_ROWS)} className="flex h-9 items-center gap-1.5 text-[13px] font-medium text-[var(--accent-strong)]">
              <Download size={14} /> Download CSV template
            </button>
            <button
              type="button"
              disabled={importing}
              onClick={() => input.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center disabled:opacity-60"
            >
              <Upload size={20} className="text-[var(--text-muted)]" />
              <span className="break-all text-[13px] text-[var(--text-h)]">{fileName || 'Choose a CSV file'}</span>
            </button>
            <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
            {fileError && <p className="text-[12.5px] text-[var(--error)]">{fileError}</p>}
            {rows.length > 0 && (
              <p className="text-[12.5px] text-[var(--text-muted)]">
                {rows.length} row{rows.length === 1 ? '' : 's'} found. Name and Mobile Number are required. Put several labels in one cell like VIP|Diwali Lead.
              </p>
            )}
            {labels.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[12.5px] font-medium text-[var(--text-h)]">
                  Add labels to every contact in this file{commonLabelIds.length > 0 ? ` (${commonLabelIds.length} chosen)` : ''}
                </p>
                <input
                  value={labelSearch}
                  onChange={(e) => setLabelSearch(e.target.value)}
                  placeholder="Search labels…"
                  aria-label="Search labels"
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--accent-border)]"
                />
                <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                  {labels
                    .filter((l) => l.name.toLowerCase().includes(labelSearch.trim().toLowerCase()))
                    .map((l) => {
                      const on = commonLabelIds.includes(l.id)
                      return (
                        <button
                          key={l.id}
                          type="button"
                          aria-pressed={on}
                          disabled={importing}
                          onClick={() => setCommonLabelIds((ids) => (on ? ids.filter((x) => x !== l.id) : [...ids, l.id]))}
                          className={cn('h-9 rounded-full border px-3 text-[12.5px]', on ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)] text-[var(--text-h)]')}
                        >
                          {l.name}
                        </button>
                      )
                    })}
                </div>
              </div>
            )}
            {importing && (
              <p role="status" className="text-[13px] font-medium text-[var(--text-h)]">
                Importing {progress} of {rows.length}… Keep this open.
              </p>
            )}
          </>
        )}
      </Dialog.Body>
      <Dialog.Footer>
        {results ? (
          <Button className="w-full justify-center" onClick={onClose}>
            Done
          </Button>
        ) : importing ? (
          <Button variant="secondary" className="w-full justify-center" onClick={() => (stop.current = true)}>
            Stop after the current row
          </Button>
        ) : (
          <Button className="w-full justify-center" onClick={() => void start()} disabled={rows.length === 0}>
            Import {rows.length || ''} contact{rows.length === 1 ? '' : 's'}
          </Button>
        )}
      </Dialog.Footer>
    </Dialog>
  )
}
