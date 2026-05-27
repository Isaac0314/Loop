// A tiny typed fetch wrapper around the FastAPI backend. Every method maps to
// one endpoint; nothing here computes status or dates - the server owns that.
import type {
  ActResp, Activity, AskResp, BriefResp, Commitment, CreateBody, Health,
} from './types'

const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')
const asOfQuery = (asOf?: string | null) => (asOf ? `?as_of=${asOf}` : '')

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} -> ${res.status}`)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })

export const api = {
  health: () => http<Health>('/api/health'),

  // reads (all accept an optional as_of date for time-travel)
  list: (asOf?: string | null) => http<Commitment[]>(`/api/commitments${asOfQuery(asOf)}`),
  get: (id: string, asOf?: string | null) =>
    http<Commitment>(`/api/commitments/${id}${asOfQuery(asOf)}`),
  activity: (asOf?: string | null) => http<Activity[]>(`/api/activity${asOfQuery(asOf)}`),

  // commitment mutations
  create: (body: CreateBody) => http<Commitment>('/api/commitments', post(body)),
  remove: (id: string) => http<void>(`/api/commitments/${id}`, { method: 'DELETE' }),
  reschedule: (id: string, to: string, reason = 'rescheduled') =>
    http<Commitment>(`/api/commitments/${id}/reschedule`, post({ to, reason })),
  addMilestone: (id: string, title: string, due?: string | null) =>
    http<Commitment>(`/api/commitments/${id}/milestones`, post({ title, due: due ?? null })),
  setMilestone: (id: string, mid: string, done: boolean) =>
    http<Commitment>(`/api/commitments/${id}/milestones/${mid}`, { method: 'PATCH', body: JSON.stringify({ done }) }),
  addUpdate: (id: string, text: string) =>
    http<Commitment>(`/api/commitments/${id}/updates`, post({ text })),

  // agent
  brief: (asOf?: string | null) => http<BriefResp>('/api/brief', post({ as_of: asOf ?? null })),
  ask: (q: string, asOf?: string | null) => http<AskResp>('/api/ask', post({ q, as_of: asOf ?? null })),
  act: (q: string, asOf?: string | null) => http<ActResp>('/api/act', post({ q, as_of: asOf ?? null })),
  suggestMilestones: (title: string, team: string, start?: string, deadline?: string) =>
    http<{ milestones: string[] }>('/api/suggest-milestones', post({ title, team, start, deadline })),

  // demo
  reset: () => http<{ ok: boolean }>('/api/demo/reset', { method: 'POST' }),
}
