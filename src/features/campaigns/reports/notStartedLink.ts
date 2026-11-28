import { NO_LEAD_FILTERS, filtersToParams } from '../campaignLeadFilters'

/** A pipeline's own leads list, narrowed to its New stage with the report's staff and dates. */
export function notStartedLink(pipelineId: string, newStageId: string, filters: { staffId: string; from: string; to: string }): string {
  const query = filtersToParams(
    {
      ...NO_LEAD_FILTERS,
      stageId: newStageId,
      staffId: filters.staffId,
      ...(filters.from || filters.to ? { datePreset: 'custom' as const, from: filters.from, to: filters.to } : {}),
    },
    new URLSearchParams(),
  )
  return `/campaigns/${pipelineId}/leads?${query}`
}
