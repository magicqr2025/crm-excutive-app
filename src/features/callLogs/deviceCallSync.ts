import { App } from '@capacitor/app'
import { CallLogSync, type NativeCallLogEntry } from '@/lib/nativeCallLog'
import { syncDeviceCallLog } from '@/api/crmApi'
import { ApiError } from '@/lib/apiClient'
import { queryClient } from '@/lib/queryClient'

const SYNC_INTERVAL_MS = 5 * 60 * 1000
// The phone's call log goes back months (thousands of rows). Sending them all,
// oldest first, one request each, kept today's calls waiting behind the backlog —
// so anything older than this is skipped and just moves the cursor past it.
const MAX_CALL_AGE_MS = 3 * 24 * 60 * 60 * 1000
// Save the cursor this often so a killed app resumes instead of restarting.
const CHECKPOINT_EVERY = 10

function toSyncInput(entry: NativeCallLogEntry) {
  return {
    phoneNumber: entry.number,
    callType: entry.type,
    callTime: new Date(entry.date).toISOString(),
    ...(entry.type !== 'missed' ? { durationSeconds: entry.duration } : {}),
    deviceCallId: entry.id,
  }
}

// A 4xx the server will keep rejecting no matter how often it is re-sent (bad
// payload, not auth/rate-limit/timeout) — safe to skip past.
function isPermanentFailure(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false
  return err.status >= 400 && err.status < 500 && ![401, 408, 429].includes(err.status)
}

let syncing = false
// A trigger (e.g. returning from the dialer) that lands mid-sync is not dropped —
// the running sync repeats once so the call that just ended is picked up.
let rerunRequested = false

export async function syncDeviceCalls(): Promise<void> {
  if (syncing) {
    rerunRequested = true
    return
  }
  syncing = true
  let sentAny = false
  try {
    const { calls } = await CallLogSync.getNewCalls()
    if (calls.length === 0) return

    const cutoff = Date.now() - MAX_CALL_AGE_MS
    let lastSyncedId: string | null = null
    let sinceCheckpoint = 0
    let stoppedEarly = false
    for (const entry of calls) {
      // Private/unknown numbers come through empty — the server rejects them.
      // Old history is skipped, not sent (see MAX_CALL_AGE_MS).
      if (entry.number && entry.date >= cutoff) {
        try {
          await syncDeviceCallLog(toSyncInput(entry))
          sentAny = true
        } catch (err) {
          // One permanently-rejected entry must not block every later call;
          // a transient failure (network/auth) stops here and retries next time.
          if (!isPermanentFailure(err)) {
            console.error('device call sync stopped, will retry', err)
            stoppedEarly = true
            break
          }
          console.error('device call rejected by server, skipping', entry.id, err)
        }
      }
      lastSyncedId = entry.id
      if (++sinceCheckpoint >= CHECKPOINT_EVERY) {
        await CallLogSync.markSynced({ lastId: lastSyncedId })
        sinceCheckpoint = 0
      }
    }
    if (lastSyncedId && sinceCheckpoint > 0) {
      await CallLogSync.markSynced({ lastId: lastSyncedId })
    }
    if (stoppedEarly) return
  } finally {
    syncing = false
    if (rerunRequested) {
      rerunRequested = false
      void syncDeviceCalls()
    }
    // Synced calls fill in type/duration on the executive's dispositions.
    if (sentAny) {
      void queryClient.invalidateQueries({ queryKey: ['my-call-logs'] })
      void queryClient.invalidateQueries({ queryKey: ['call-logs-for-lead'] })
    }
  }
}

let started = false

export function startDeviceCallSync(): void {
  if (started) return
  started = true
  void syncDeviceCalls()
  setInterval(() => void syncDeviceCalls(), SYNC_INTERVAL_MS)
  // Back from the phone's dialer: sync now, and once more shortly after since
  // Android can write the finished call to its log a moment late.
  void App.addListener('resume', () => {
    void syncDeviceCalls()
    setTimeout(() => void syncDeviceCalls(), 3000)
  })
  void CallLogSync.startBackgroundSync()
  void CallLogSync.addListener('callEnded', () => void syncDeviceCalls())
}
