import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/pipelineApi'

export function usePipeline(id: string) {
  // Not refetched in the background: a refresh must not move values under someone editing them.
  return useQuery({ queryKey: ['pipeline', id], queryFn: () => api.fetchPipeline(id), enabled: !!id, refetchOnWindowFocus: false })
}

export function usePipelineAgents(id: string) {
  return useQuery({ queryKey: ['pipeline-agents', id], queryFn: () => api.fetchPipelineAgents(id), enabled: !!id })
}

function useRefreshPipelines() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(['my-lead-campaigns', 'pipeline', 'pipeline-agents'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
}

export function useSavePipeline(id: string | null) {
  const refresh = useRefreshPipelines()
  return useMutation({
    mutationFn: (input: Partial<api.PipelineInput>) => (id ? api.updatePipeline(id, input) : api.createPipeline(input as api.PipelineInput)),
    onSuccess: refresh,
  })
}

export function useSetPipelineAgent(pipelineId: string) {
  const refresh = useRefreshPipelines()
  return useMutation({
    mutationFn: ({ userId, enabled }: { userId: string; enabled: boolean }) => api.setPipelineAgentEnabled(pipelineId, userId, enabled),
    onSuccess: refresh,
  })
}
