// App store: holds the server-computed data (commitments, activity, health) and
// the time-travel offset. Every mutation calls the API then refetches, so the
// UI always reflects the backend's computed truth rather than a local guess.
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react'
import { api } from '../api/client'
import type { Activity, Commitment, CreateBody, Health } from '../api/types'
import { addDays, REAL_TODAY } from '../lib/format'

interface Store {
  health: Health | null
  commitments: Commitment[]
  activity: Activity[]
  loading: boolean

  // time-travel
  daysAhead: number
  asOf: string | null // null === today
  today: string // the effective "now" (real today or the simulated date)
  skipWeek: () => void
  backToToday: () => void

  refresh: () => Promise<void>

  // actions (all refetch on success)
  reschedule: (id: string, to: string, reason?: string) => Promise<void>
  toggleMilestone: (id: string, mid: string, done: boolean) => Promise<void>
  addMilestone: (id: string, title: string, due?: string | null) => Promise<void>
  addUpdate: (id: string, text: string) => Promise<void>
  createCommitment: (body: CreateBody) => Promise<void>
  removeCommitment: (id: string) => Promise<void>
  markDelivered: (c: Commitment) => Promise<void>
  resetDemo: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)
const MAX_AHEAD = 28

export function StoreProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<Health | null>(null)
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [daysAhead, setDaysAhead] = useState(0)
  const [loading, setLoading] = useState(true)

  const asOf = daysAhead === 0 ? null : addDays(REAL_TODAY, daysAhead)
  const today = asOf ?? REAL_TODAY

  // a ref keeps the latest asOf available to actions without re-creating them
  const asOfRef = useRef(asOf)
  asOfRef.current = asOf

  const refresh = useCallback(async () => {
    const [c, a] = await Promise.all([api.list(asOfRef.current), api.activity(asOfRef.current)])
    setCommitments(c)
    setActivity(a)
  }, [])

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
  }, [])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [asOf, refresh])

  const after = useCallback(
    async (p: Promise<unknown>) => {
      await p
      await refresh()
    },
    [refresh],
  )

  const value: Store = useMemo(
    () => ({
      health,
      commitments,
      activity,
      loading,
      daysAhead,
      asOf,
      today,
      skipWeek: () => setDaysAhead((n) => Math.min(n + 7, MAX_AHEAD)),
      backToToday: () => setDaysAhead(0),
      refresh,
      reschedule: (id, to, reason) => after(api.reschedule(id, to, reason)),
      toggleMilestone: (id, mid, done) => after(api.setMilestone(id, mid, done)),
      addMilestone: (id, title, due) => after(api.addMilestone(id, title, due)),
      addUpdate: (id, text) => after(api.addUpdate(id, text)),
      createCommitment: (body) => after(api.create(body)),
      removeCommitment: (id) => after(api.remove(id)),
      markDelivered: (c) =>
        after(Promise.all(c.milestones.filter((m) => !m.done).map((m) => api.setMilestone(c.id, m.id, true)))),
      resetDemo: () => after(api.reset()),
    }),
    [health, commitments, activity, loading, daysAhead, asOf, today, refresh, after],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore must be used inside <StoreProvider>')
  return v
}
