import { Fragment, type CSSProperties } from 'react'
import type { Commitment } from '../api/types'
import { useStore } from '../store/store'
import { addDays, isMonday, nice, parseISO, pct } from '../lib/format'
import { OwnerCell, TeamTag } from './bits'

const msDone = (m: Commitment['milestones'][number], today: string) =>
  m.done && m.done_on != null && m.done_on <= today

export function Timeline({ rows, onOpen }: { rows: Commitment[]; onOpen: (id: string) => void }) {
  const { commitments, today } = useStore()

  if (!rows.length) return <div className="empty">No commitments match this filter.</div>

  // Window spans every commitment (not just the filtered ones), padded a little.
  let ws = today
  let we = today
  for (const c of commitments) {
    if (parseISO(c.start) < parseISO(ws)) ws = c.start
    if (parseISO(c.eff_deadline) > parseISO(we)) we = c.eff_deadline
  }
  ws = addDays(ws, -1)
  we = addDays(we, 2)

  // weekly ticks (Mondays)
  const ticks: { left: string; transform?: string; label: string }[] = []
  for (let m = ws; parseISO(m) <= parseISO(we); m = addDays(m, 1)) {
    if (!isMonday(m)) continue
    const p = pct(m, ws, we)
    if (p < 6) ticks.push({ left: '0', label: nice(m) })
    else if (p > 94) ticks.push({ left: 'auto', label: nice(m) }) // right:0 handled below
    else ticks.push({ left: `${p}%`, transform: 'translateX(-50%)', label: nice(m) })
  }

  const teams = [...new Set(rows.map((c) => c.team))]
  const tp = pct(today, ws, we)

  return (
    <div className="tlwrap">
      <div className="tlgrid">
        <div className="axis">
          {ticks.map((t, i) => (
            <div
              key={i}
              className="tick"
              style={t.left === 'auto' ? { right: 0 } : { left: t.left, transform: t.transform }}
            >
              {t.label}
            </div>
          ))}
        </div>
      </div>

      <div className="tlgrid tl-body">
        <div className="today-line" style={{ left: `calc(256px + (100% - 256px) * ${tp / 100})` }} />
        {teams.map((team) => (
          <Group key={team} team={team} rows={rows.filter((c) => c.team === team)} ws={ws} we={we} today={today} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

function Group({
  team,
  rows,
  ws,
  we,
  today,
  onOpen,
}: {
  team: string
  rows: Commitment[]
  ws: string
  we: string
  today: string
  onOpen: (id: string) => void
}) {
  return (
    <>
      <div className="teamhdr">
        <TeamTag team={team} />
      </div>
      {rows.map((c) => {
        const left = pct(c.start, ws, we)
        const width = Math.max(3, pct(c.eff_deadline, ws, we) - left)
        const barStyle: CSSProperties = { left: `${left}%`, width: `${width}%` }
        return (
          <Fragment key={c.id}>
            <div className="row-lbl">
              <div className="t" title={c.title}>
                {c.title}
              </div>
              <div className="m">
                <OwnerCell name={c.owner} />
              </div>
            </div>
            <div className="track">
              <div
                className={`bar s-${c.status}`}
                style={barStyle}
                title={`${c.title} · due ${nice(c.eff_deadline)}`}
                onClick={() => onOpen(c.id)}
              >
                <span className="blabel">{nice(c.eff_deadline)}</span>
              </div>
              {c.milestones.map((m) => (
                <div
                  key={m.id}
                  className={'ms' + (msDone(m, today) ? ' done' : '')}
                  style={{ left: `${pct(m.due, ws, we)}%` }}
                  title={`${m.title} · due ${nice(m.due)}${msDone(m, today) ? ' ✓' : ''}`}
                />
              ))}
            </div>
          </Fragment>
        )
      })}
    </>
  )
}
