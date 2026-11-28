import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/useToast'
import { fetchAllLeads } from '@/api/crmApi'
import { downloadCsv, safeText } from '@/lib/csv'
import { ImportContactsDialog } from './ImportContactsDialog'

/** Admin tools on the Contacts page. */
export function ImportExportButtons() {
  const toast = useToast()
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function exportAll() {
    setExporting(true)
    try {
      const leads = await fetchAllLeads()
      downloadCsv('contacts.csv', [
        ['Name', 'Country Code', 'Mobile Number', 'Full Number', 'Email', 'Lead Status', 'Assigned To', 'Created At'],
        ...leads.map((l) => [
          safeText(l.contact_name),
          l.contact_country_code,
          l.contact_phone,
          l.contact_phone_with_country_code,
          safeText(l.contact_email),
          safeText(l.lead_status),
          safeText(l.assign_staff_name),
          l.created_at,
        ]),
      ])
      toast.show({ title: `${leads.length} contact${leads.length === 1 ? '' : 's'} exported`, tone: 'success' })
    } catch (err) {
      toast.show({ title: err instanceof Error ? err.message : 'Could not export the contacts', tone: 'error' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={() => setImporting(true)}>
        <Upload size={14} /> Import
      </Button>
      <Button variant="secondary" size="sm" onClick={() => void exportAll()} disabled={exporting} title="Downloads all contacts, not only the filtered ones">
        <Download size={14} /> {exporting ? 'Exporting…' : 'Export all'}
      </Button>
      {importing && <ImportContactsDialog onClose={() => setImporting(false)} />}
    </div>
  )
}
