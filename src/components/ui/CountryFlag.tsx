import { cn } from '@/lib/utils'

// Images rather than flag emojis, which Windows shows as two letters. The files ship
// with the app; no-inline keeps them out of the JS, so only flags on screen are fetched.
const FLAG_URLS = import.meta.glob<string>('/node_modules/flag-icons/flags/4x3/*.svg', {
  query: '?url&no-inline',
  import: 'default',
  eager: true,
})

export function CountryFlag({ iso, className }: { iso: string; className?: string }) {
  const src = FLAG_URLS[`/node_modules/flag-icons/flags/4x3/${iso}.svg`]
  if (!src) return null
  return (
    <img src={src} alt="" loading="lazy" className={cn('h-3.5 w-[18px] shrink-0 rounded-[2px] object-cover', className)} />
  )
}
