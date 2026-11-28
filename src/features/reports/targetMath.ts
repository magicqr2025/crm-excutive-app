// Same rules as orm-whatsapp's targetMath.ts (and TargetView here): keep them in step.
import type { CrmIncentiveSlab } from '@/api/crmApi'

export interface TargetFigures {
  incentive: number
  finalSalary: number
  /** How much of the target is still to be collected. */
  due: number
}

export function targetFigures(baseSalary: number, targetAmount: number, collected: number, slabs: CrmIncentiveSlab[]): TargetFigures {
  // Nothing is paid until the collected amount reaches the target.
  const reached = targetAmount > 0 && collected >= targetAmount
  const incentive = reached
    ? slabs.reduce((sum, slab) => sum + (Math.max(0, Math.min(slab.to, collected) - Math.max(slab.from, 0)) * slab.rate) / 100, 0)
    : 0
  return { incentive: Math.round(incentive), finalSalary: Math.round(baseSalary + incentive), due: Math.max(0, targetAmount - collected) }
}
