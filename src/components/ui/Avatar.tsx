import { avatarColor, initials } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface AvatarProps {
  name: string
  size?: number
  className?: string
  online?: boolean
}

export function Avatar({ name, size = 44, className, online }: AvatarProps) {
  const bg = avatarColor(name)
  return (
    <span
      data-slot="avatar"
      className={cn('relative inline-flex shrink-0 rounded-full', className)}
      style={{ width: size, height: size }}
    >
      <span
        className="flex h-full w-full items-center justify-center rounded-full font-medium text-white"
        style={{ background: bg, fontSize: size * 0.38 }}
      >
        {initials(name)}
      </span>
      {online !== undefined && (
        <span
          data-slot="avatar-status"
          className={cn(
            'absolute right-0 bottom-0 rounded-full border-2 border-[var(--surface)]',
            online ? 'bg-[var(--accent)]' : 'bg-[var(--text-muted)]',
          )}
          style={{ width: size * 0.3, height: size * 0.3 }}
        />
      )}
    </span>
  )
}
