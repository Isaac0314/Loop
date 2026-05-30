import { useState } from 'react'
import type { Activity, Commitment, Tier } from '../api/types'
import { useStore } from '../store/store'
import { nice } from '../lib/format'
import { copyText, draftFor } from '../lib/drafts'
import { passesFilter, type Filter } from '../lib/select'
import { Avatar } from './bits'

const TIER_LABEL: Record<Tier, string> = { owner: 'Nudge', fa: 'Escalate', founder: 'Escalate', log: 'Reschedule' }
const TIER_STATUS: Record<Tier, string> = {
  owner: 'Email sent · awaiting reply',
  fa: 'Escalated to you',
  founder: 'Escalated to founders',
  log: 'Logged',
}

export function ActivityFeed({
  filter,
  onOpen,
  onTask,
}: {
  filter: Filter
  onOpen: (id: string) => void
  onTask: (c: Commitment) => void
}) {
  const { commitments, activity } = useStore()
  const [copied, setCopied] = useState<string | null>(null)

  const byId = new Map(commitments.map((c) => [c.id, c]))
  let events = activity.filter((e) => e.tier !== 'log')
  if (filter !== 'all') {
    const ids = new Set(commitments.filter((c) => passesFilter(c, filter)).map((c) => c.id))
    events = events.filter((e) => ids.has(e.commitment_id))
  }

  const draft = (e: Activity): string => {
    const c = byId.get(e.commitment_id)
    return c ? draftFor(e.tier, c) : e.message
  }
  const onCopy = (e: Activity, key: string) => {
    copyText(draft(e))
    setCopied(key)
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1300)
  }
  const onMail = (e: Activity) => {
    const c = byId.get(e.commitment_id)
    const subject = 'Loop AI: ' + (c ? c.title : 'update')
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(draft(e))}`
  }

  return (
    <div className="card">
      <div className="card-h">
        <h2>Agent activity</h2>
        <span className="r">{events.length} actions</span>
      </div>
      <div className="feed">
        {!events.length ? (
          <div className="empty">
            {filter !== 'all'
              ? 'No agent actions for this filter.'
              : "No actions. Everything's on track; the agent stays quiet until something needs attention."}
          </div>
        ) : (
          events.map((e, i) => {
            const key = `${e.commitment_id}-${e.date}-${e.tier}-${i}`
            const c = byId.get(e.commitment_id)
            return (
              <div className="ev" data-tier={e.tier} style={{ cursor: 'pointer' }} key={key}>
                <div className="top" onClick={() => onOpen(e.commitment_id)}>
                  {c && <Avatar name={c.owner} />}
                  <span className={`tier ${e.tier}`}>{TIER_LABEL[e.tier]}</span>
                  <span className={`estat ${e.tier}`}>{TIER_STATUS[e.tier]}</span>
                  <span className="date tnum" style={{ marginLeft: 'auto' }}>
                    {nice(e.date)}
                  </span>
                </div>
                <div className="msg" onClick={() => onOpen(e.commitment_id)}>
                  {e.message}
                </div>
                <div className="evbtns">
                  <button className="mini" onClick={() => onCopy(e, key)}>
                    {copied === key ? '✓ Copied' : '⧉ Copy'}
                  </button>
                  <button className="mini" onClick={() => onMail(e)}>
                    ✉ Email
                  </button>
                  {(e.tier === 'fa' || e.tier === 'founder') && c && (
                    <button className="mini" onClick={() => onTask(c)}>
                      ↳ Turn into task
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
