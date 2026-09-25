import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Play, Square } from 'lucide-react'
import type { CrmCallLog } from '@/api/crmApi'
import { RecordingFolder, type RecordingMatch } from '@/lib/nativeRecordingFolder'

// Only one recording plays at a time (the native plugin has a single
// MediaPlayer), so every button listens for this to reset its own state
// when another one starts.
const PLAY_EVENT = 'recording-play'

// Finds the phone's own recording of this call in the folder picked under
// Settings → Call Recording and plays it on-device. Device-synced rows carry
// the exact call time/duration; manual dispositions only have created_at,
// which is shortly after the call ended, so it stands in for the end time.
export function PlayRecordingButton({ log }: { log: CrmCallLog }) {
  const [match, setMatch] = useState<RecordingMatch | null>(null)
  const [playing, setPlaying] = useState(false)

  const number = log.phone_number ?? log.contact_phone
  const isDevice = log.source === 'device_sync' && !!log.call_time
  const callTimeMs = new Date(isDevice ? log.call_time! : log.created_at).getTime()
  const durationSeconds = isDevice ? (log.duration_seconds ?? 0) : 0

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !number) return
    let cancelled = false
    RecordingFolder.findRecording({
      number,
      callTimeMs,
      durationSeconds,
      ...(log.contact_name ? { contactName: log.contact_name } : {}),
    })
      .then((result) => {
        if (!cancelled) setMatch(result.match)
      })
      .catch(() => {
        if (!cancelled) setMatch(null)
      })
    return () => {
      cancelled = true
    }
  }, [number, callTimeMs, durationSeconds, log.contact_name])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const sub = RecordingFolder.addListener('playbackEnded', () => setPlaying(false))
    const onOtherPlay = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== log.id) setPlaying(false)
    }
    window.addEventListener(PLAY_EVENT, onOtherPlay)
    return () => {
      sub.then((handle) => handle.remove())
      window.removeEventListener(PLAY_EVENT, onOtherPlay)
    }
  }, [log.id])

  if (!match) return null

  async function togglePlay() {
    if (!match) return
    if (playing) {
      await RecordingFolder.stop()
      setPlaying(false)
      return
    }
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: log.id }))
    try {
      await RecordingFolder.play({ uri: match.uri })
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  return (
    <button
      type="button"
      onClick={togglePlay}
      title={playing ? 'Stop' : `Play recording (${match.fileName})`}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--accent-strong)]"
    >
      {playing ? <Square size={14} /> : <Play size={14} />}
    </button>
  )
}
