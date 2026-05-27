import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Commitment, Tier } from '../api/types'
import { useStore } from '../store/store'
import { nice, relTag } from '../lib/format'
import { copyText, draftFor } from '../lib/drafts'
import { Avatar, Drawer, OwnerCell, Pill, TeamTag } from './bits'

const AGENT_TAG: Partial<Record<Tier, string>> = { owner: 'Nudge', fa: 'Escalate', founder: 'Escalate' }

type Act =
  | { date: string; kind: 'update' | 'slip' | 'done'; text: string }
  | { date: string; kind: 'agent'; tier: Tier; text: string }

export function DetailDrawer({
  id,
  onClose,
  onTask,
}: {
  id: string | null
  onClose: () => void
  onTask: (c: Commitment) => void
}) {
  const store = useStore()
  const { asOf, today } = store
  const [c, setC] = useState<Commitment | null>(null)
  const [msTitle, setMsTitle] = useState('')
  const [msDate, setMsDate] = useState('')
  const [upText, setUpText] = useState('')
  const [moveDate, setMoveDate] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!id) return
    const d = await api.get(id, asOf)
    setC(d)
    setMsDate(d.eff_deadline)
    setMoveDate(d.eff_deadline)
  }, [id, asOf])

  useEffect(() => {
    if (id) reload()
    else setC(null)
  }, [id, reload])

  const wrap = (p: Promise<unknown>) => p.then(reload)

  const title = c ? c.title : ''

  return (
    <Drawer open={!!id} title={title} onClose={onClose}>
      {!c ? null : (
        <DetailBody
          c={c}
          today={today}
          msTitle={msTitle}
          setMsTitle={setMsTitle}
          msDate={msDate}
          setMsDate={setMsDate}
          upText={upText}
          setUpText={setUpText}
          moveDate={moveDate}
          setMoveDate={setMoveDate}
          copied={copied}
          onToggleMs={(m) => wrap(store.toggleMilestone(c.id, m.id, !m.done))}
          onAddMs={() => {
            if (!msTitle.trim()) return
            wrap(store.addMilestone(c.id, msTitle.trim(), msDate || c.eff_deadline)).then(() => setMsTitle(''))
          }}
          onLog={() => {
            if (!upText.trim()) return
            wrap(store.addUpdate(c.id, upText.trim())).then(() => setUpText(''))
          }}
          onMove={() => moveDate && wrap(store.reschedule(c.id, moveDate, 'rescheduled'))}
          onDelivered={() => wrap(store.markDelivered(c))}
          onDelete={() => {
            if (confirm('Delete this commitment?')) store.removeCommitment(c.id).then(onClose)
          }}
          onCopy={(key, text) => {
            copyText(text)
            setCopied(key)
            setTimeout(() => setCopied((k) => (k === key ? null : k)), 1300)
          }}
          onTask={() => onTask(c)}
        />
      )}
    </Drawer>
  )
}

function DetailBody(props: {
  c: Commitment
  today: string
  msTitle: string
  setMsTitle: (s: string) => void
  msDate: string
  setMsDate: (s: string) => void
  upText: string
  setUpText: (s: string) => void
  moveDate: string
  setMoveDate: (s: string) => void
  copied: string | null
  onToggleMs: (m: Commitment['milestones'][number]) => void
  onAddMs: () => void
  onLog: () => void
  onMove: () => void
  onDelivered: () => void
  onDelete: () => void
  onCopy: (key: string, text: string) => void
  onTask: () => void
}) {
  const { c, today } = props
  const rel = relTag(c)
  const msDone = (m: Commitment['milestones'][number]) => m.done && m.done_on != null && m.done_on <= today

  // merged activity (newest first); raw slips stand in for 'log' agent events
  const acts: Act[] = [
    ...c.updates.map((u) => ({ date: u.date, kind: 'update' as const, text: u.text })),
    ...c.slips.map((s) => ({
      date: s.date,
      kind: 'slip' as const,
      text: `Deadline moved ${nice(s.from_date)} to ${nice(s.to_date)} · ${s.reason}`,
    })),
    ...c.milestones
      .filter((m) => m.done && m.done_on)
      .map((m) => ({ date: m.done_on as string, kind: 'done' as const, text: `Completed: ${m.title}` })),
    ...c.events
      .filter((e) => e.tier !== 'log' && e.date <= today)
      .map((e) => ({ date: e.date, kind: 'agent' as const, tier: e.tier, text: e.message })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  return (
    <>
      <Pill status={c.status} />

      <div className="sec">
        <div className="kv">
          <span>Team</span>
          <TeamTag team={c.team} />
        </div>
        <div className="kv">
          <span>Owner</span>
          <OwnerCell name={c.owner} />
        </div>
        <div className="kv">
          <span>Deadline</span>
          <b className="tnum">
            {nice(c.eff_deadline)} <span className={`rel ${rel.cls}`}>{rel.text}</span>
          </b>
        </div>
        <div className="kv">
          <span>Source</span>
          <b>{c.source}</b>
        </div>
      </div>

      <div className="sec">
        <h4>Milestones</h4>
        <div className="c-sub" style={{ marginBottom: 8 }}>
          {c.last_reached ? (
            <>
              Reached: <b>{c.last_reached}</b>
            </>
          ) : (
            'Not started'
          )}
          {c.next_milestone ? (
            <>
              {' '}
              · Next: <b>{c.next_milestone}</b>
            </>
          ) : (
            ' · all done'
          )}
        </div>
        <div className="mslist">
          {c.milestones.map((m) => {
            const dn = msDone(m)
            return (
              <div className={'mrow' + (dn ? ' done' : '')} key={m.id}>
                <div className={'mck' + (dn ? ' done' : '')} onClick={() => props.onToggleMs(m)} />
                <div>
                  <div className="mt">{m.title}</div>
                  <div className="c-sub tnum">
                    due {nice(m.due)}
                    {dn && m.done_on ? ` · done ${nice(m.done_on)}` : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="row-actions" style={{ marginTop: 8 }}>
          <input
            placeholder="Add a milestone…"
            style={{ flex: 1 }}
            value={props.msTitle}
            onChange={(e) => props.setMsTitle(e.target.value)}
          />
          <input type="date" style={{ width: 150 }} value={props.msDate} onChange={(e) => props.setMsDate(e.target.value)} />
          <button onClick={props.onAddMs}>+ Add</button>
        </div>
      </div>

      <div className="sec">
        <h4>Activity</h4>
        <div className="row-actions" style={{ margin: '0 0 11px' }}>
          <input
            placeholder="Log an update…"
            style={{ flex: 1 }}
            value={props.upText}
            onChange={(e) => props.setUpText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && props.onLog()}
          />
          <button className="primary" onClick={props.onLog}>
            Log
          </button>
        </div>
        <div className="tllog">
          {acts.length === 0 ? (
            <div className="c-sub">No activity yet.</div>
          ) : (
            acts.map((a, i) => {
              const agent = a.kind === 'agent'
              const key = `${a.kind}-${a.date}-${i}`
              return (
                <div className="act" key={key}>
                  <span className={`adot ${a.kind}` + (agent ? ` ${a.tier}` : '')} />
                  <div style={{ flex: 1 }}>
                    <div className="atxt">
                      {agent && <span className={`atag ${a.tier}`}>{AGENT_TAG[a.tier]}</span>} {a.text}
                    </div>
                    <div className="adate tnum">{nice(a.date)}</div>
                    {agent && (
                      <div className="evbtns">
                        <button className="mini" onClick={() => props.onCopy(key, draftFor(a.tier, c))}>
                          {props.copied === key ? '✓ Copied' : '⧉ Copy'}
                        </button>
                        {(a.tier === 'fa' || a.tier === 'founder') && (
                          <button className="mini" onClick={props.onTask}>
                            ↳ Task
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="sec">
        <h4>Actions</h4>
        <div className="row-actions">
          <input type="date" style={{ width: 150 }} value={props.moveDate} onChange={(e) => props.setMoveDate(e.target.value)} />
          <button onClick={props.onMove}>Move deadline</button>
          <button onClick={props.onDelivered}>Mark delivered</button>
          <button onClick={props.onDelete} style={{ color: 'var(--red)' }}>
            Delete
          </button>
        </div>
      </div>
    </>
  )
}
