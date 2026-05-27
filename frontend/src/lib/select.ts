// Client-side filtering & sorting - purely presentational, operating over the
// server-computed fields (status, days_left, eff_deadline).
import type { Commitment, Status } from '../api/types'

export type Filter = 'all' | 'attention' | 'd3' | 'd7'
export type SortKey = 'urgency' | 'team' | 'deadline'

export function passesFilter(c: Commitment, f: Filter): boolean {
  if (f === 'attention') return c.status === 'missed' || c.status === 'at_risk'
  if (f === 'd3') return c.status !== 'complete' && c.days_left <= 3
  if (f === 'd7') return c.status !== 'complete' && c.days_left <= 7
  return true
}
export const applyFilter = (cs: Commitment[], f: Filter) => cs.filter((c) => passesFilter(c, f))
export const filterCount = (cs: Commitment[], f: Filter) => cs.filter((c) => passesFilter(c, f)).length

export const FILTER_DEFS: [Filter, string][] = [
  ['all', 'All'],
  ['attention', 'Needs attention'],
  ['d3', 'Due ≤3 days'],
  ['d7', 'Due ≤7 days'],
]

const STATUS_RANK: Record<Status, number> = { missed: 0, at_risk: 1, on_track: 2, complete: 3 }

export function sortCommitments(cs: Commitment[], key: SortKey, dir: 1 | -1): Commitment[] {
  const arr = [...cs]
  arr.sort((a, b) => {
    if (key === 'urgency') {
      const r = STATUS_RANK[a.status] - STATUS_RANK[b.status]
      if (r !== 0) return r * dir
      return a.eff_deadline < b.eff_deadline ? -dir : a.eff_deadline > b.eff_deadline ? dir : 0
    }
    const x = key === 'team' ? a.team : a.eff_deadline
    const y = key === 'team' ? b.team : b.eff_deadline
    return x < y ? -dir : x > y ? dir : 0
  })
  return arr
}
