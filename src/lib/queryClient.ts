import { QueryClient } from '@tanstack/react-query'

// Shared instance so non-React code (e.g. the device call sync) can invalidate queries.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Always refetch when a page mounts (route change) so data is fresh, and on
      // window focus / reconnect so a resumed app doesn't show stale numbers.
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
})
