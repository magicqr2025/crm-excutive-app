import { registerPlugin } from '@capacitor/core'

export interface RecordingMatch {
  uri: string
  fileName: string
}

export interface RecordingFolderPlugin {
  pick(): Promise<{ uri: string }>
  getSelected(): Promise<{ uri: string | null }>
  findRecording(options: { number: string; callTimeMs: number; durationSeconds: number }): Promise<{ match: RecordingMatch | null }>
  play(options: { uri: string }): Promise<void>
  stop(): Promise<void>
  addListener(eventName: 'playbackEnded', listenerFunc: () => void): Promise<{ remove: () => void }>
}

export const RecordingFolder = registerPlugin<RecordingFolderPlugin>('RecordingFolder')
