import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/useToast'

/**
 * One saving action: shows the outcome and refreshes the lists. `refresh` names the query keys that other
 * screens read the same data under.
 */
export function useSetupAction<T>(run: (input: T) => Promise<unknown>, success: string, refresh: string[]) {
  const toast = useToast()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await Promise.all(refresh.map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
      toast.show({ title: success, tone: 'success' })
    },
    onError: (err) => toast.show({ title: err instanceof Error ? err.message : 'Something went wrong', tone: 'error' }),
  })
}
