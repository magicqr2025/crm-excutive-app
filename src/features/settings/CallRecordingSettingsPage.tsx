import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { CallLogSync, type CallLogPermissionState } from '@/lib/nativeCallLog'
import { RecordingFolder } from '@/lib/nativeRecordingFolder'
import { startDeviceCallSync } from '@/features/callLogs/deviceCallSync'

export function CallRecordingSettingsPage() {
  const [permission, setPermission] = useState<CallLogPermissionState>('prompt')
  const [folderUri, setFolderUri] = useState<string | null>(null)

  useEffect(() => {
    CallLogSync.checkPermissions().then((r) => setPermission(r.callLog))
    RecordingFolder.getSelected().then((r) => setFolderUri(r.uri))
  }, [])

  async function handleRequestPermission() {
    const result = await CallLogSync.requestPermissions()
    setPermission(result.callLog)
    if (result.callLog === 'granted') {
      startDeviceCallSync()
    }
  }

  async function handlePickFolder() {
    const result = await RecordingFolder.pick()
    setFolderUri(result.uri)
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface)]">
      <PageHeader title="Call Recording" subtitle="Sync your call history and find local recordings." />
      <div className="space-y-4 p-4">
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-[13px] font-semibold text-[var(--text-h)]">Call log access</p>
          <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">
            Lets this app read your phone's call history so calls with CRM leads sync to your CRM. Calls to numbers
            that aren't CRM leads are never saved. This app never records calls itself — it only reads metadata
            Android already tracks.
          </p>
          <p className="mt-2 text-[12.5px] text-[var(--text-muted)]">Status: {permission}</p>
          {permission !== 'granted' && (
            <button
              type="button"
              onClick={handleRequestPermission}
              className="mt-2 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[12.5px] font-medium text-white"
            >
              Grant access
            </button>
          )}
        </div>

        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-[13px] font-semibold text-[var(--text-h)]">Recordings folder</p>
          <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">
            Select the folder where your phone's own call recorder already saves files, so this app can find and play
            them next to the matching call log entry. Nothing is uploaded — playback stays on this device.
          </p>
          <p className="mt-2 truncate text-[12.5px] text-[var(--text-muted)]">
            {folderUri ? folderUri : 'No folder selected yet.'}
          </p>
          <button
            type="button"
            onClick={handlePickFolder}
            className="mt-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-h)]"
          >
            {folderUri ? 'Change folder' : "Select your phone's call recordings folder"}
          </button>
        </div>
      </div>
    </div>
  )
}
