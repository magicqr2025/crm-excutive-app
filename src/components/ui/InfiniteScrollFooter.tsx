import { useEffect, useRef } from 'react'

interface InfiniteScrollFooterProps {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
}

// Sits under a list and asks for the next page as it scrolls into view.
export function InfiniteScrollFooter({ hasNextPage, isFetchingNextPage, onLoadMore }: InfiniteScrollFooterProps) {
  const ref = useRef<HTMLDivElement>(null)
  const onLoadMoreRef = useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore

  useEffect(() => {
    const el = ref.current
    if (!el || !hasNextPage || isFetchingNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMoreRef.current()
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage])

  return (
    <div ref={ref} className="py-3 text-center text-[12px] text-[var(--text-muted)]">
      {isFetchingNextPage ? 'Loading more…' : null}
    </div>
  )
}
