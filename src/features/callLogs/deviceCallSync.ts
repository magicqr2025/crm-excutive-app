import { App } from '@capacitor/app'
import { CallLogSync, type NativeCallLogEntry } from '@/lib/nativeCallLog'
import { syncDeviceCallLog } from '@/api/crmApi'

const SYNC_INTERVAL_MS = 5 * 60 * 1000

function toSyncInput(entry: NativeCallLogEntry) {
  return {
    phoneNumber: entry.number,
    callType: entry.type,
    callTime: new Date(entry.date).toISOString(),
    ...(entry.type !== 'missed' ? { durationSeconds: entry.duration } : {}),
    deviceCallId: entry.id,
  }
}

export async function syncDeviceCalls(): Promise<void> {
  const { calls } = await CallLogSync.getNewCalls()
  if (calls.length === 0) return

  let lastSyncedId: string | null = null
  for (const entry of calls) {
    await syncDeviceCallLog(toSyncInput(entry))
    lastSyncedId = entry.id
  }
  if (lastSyncedId) {
    await CallLogSync.markSynced({ lastId: lastSyncedId })
  }
}

let started = false

export function startDeviceCallSync(): void {
  if (started) return
  started = true
  void syncDeviceCalls()
  setInterval(() => void syncDeviceCalls(), SYNC_INTERVAL_MS)
  void App.addListener('resume', () => void syncDeviceCalls())
  void CallLogSync.startBackgroundSync()
  void CallLogSync.addListener('callEnded', () => void syncDeviceCalls())
}
