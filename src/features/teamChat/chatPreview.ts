import type { ChatLastMessage } from '@/api/chatApi'

/** What a message is, in a few words — its text, or what it carries when it has none. */
export function messageSummary(m: Pick<ChatLastMessage, 'body' | 'attachment_count' | 'attachment_mime' | 'attachment_name' | 'has_task'>) {
  const body = m.body.trim().replace(/\s+/g, ' ')
  if (body) return body
  if (m.has_task) return '✅ Assigned a task'
  if (m.attachment_count > 1) return `📎 ${m.attachment_count} files`
  if (m.attachment_count === 1) return m.attachment_mime?.startsWith('image/') ? '📷 Photo' : `📎 ${m.attachment_name ?? 'File'}`
  return 'Message'
}

/** "You" / first name — left out in a direct message, where it can only be them. */
export function speakerPrefix(m: ChatLastMessage, meId: string, isDirect: boolean): string | null {
  if (m.author_id === meId) return 'You'
  if (isDirect) return null
  return m.author_name.split(' ')[0] || m.author_name
}
