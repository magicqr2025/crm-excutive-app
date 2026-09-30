import { useIsFetching } from '@tanstack/react-query'

// Thin indeterminate bar under the header. Cached pages paint instantly and then
// refetch on mount; this makes that refresh visible so the executive knows the
// data on screen is being updated. Covers every query, so no page can forget it.
export function RouteFetchBar() {
  const fetching = useIsFetching() > 0
  return (
    <div
      role="progressbar"
      aria-hidden={!fetching}
      aria-busy={fetching}
      className={`pointer-events-none relative h-[2px] shrink-0 overflow-hidden bg-transparent transition-opacity duration-200 ${
        fetching ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="route-fetch-bar absolute inset-y-0 w-1/3 bg-[var(--accent)] motion-reduce:animate-none" />
    </div>
  )
}
