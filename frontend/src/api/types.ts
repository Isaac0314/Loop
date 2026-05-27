// TypeScript mirrors of the backend's Pydantic response models (app/schemas.py).
// Dates arrive as ISO strings ("YYYY-MM-DD").

export type Status = 'on_track' | 'at_risk' | 'missed' | 'complete'
export type Tier = 'owner' | 'fa' | 'founder' | 'log'

export interface Milestone {
  id: string
  title: string
  due: string
  done: boolean
  done_on: string | null
}

export interface Update {
  id: string
  text: string
  date: string
}

export interface Slip {
  id: string
  from_date: string
  to_date: string
  reason: string
  date: string
}

export interface AgentEvent {
  date: string
  tier: Tier
  commitment_id: string
  message: string
}

export interface Commitment {
  id: string
  title: string
  team: string
  owner: string
  source: string
  start: string
  deadline: string
  eff_deadline: string
  status: Status
  days_left: number
  slip_count: number
  next_milestone: string | null
  last_reached: string | null
  milestones: Milestone[]
  updates: Update[]
  slips: Slip[]
  events: AgentEvent[]
}

export interface Activity {
  date: string
  tier: Tier
  commitment_id: string
  title: string
  owner: string
  message: string
}

export interface Health {
  ok: boolean
  model: string
  model_ask: string
  key: boolean
  live: boolean
}

export interface BriefResp {
  answer: string
  live: boolean
}
export interface AskResp {
  answer: string
}
export interface ActResp {
  action: 'reschedule' | 'add_milestone' | 'create' | 'answer' | 'error'
  message?: string
  answer?: string
  commitment?: Commitment
}

// ---- request bodies ----
export interface CreateBody {
  title: string
  team?: string
  owner?: string
  start?: string | null
  deadline?: string | null
  milestones?: string[]
}
