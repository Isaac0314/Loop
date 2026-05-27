import type { Commitment } from '../api/types'
import { useStore } from '../store/store'
import { nice, relTag } from '../lib/format'
import { sortCommitments, type SortKey } from '../lib/select'
import { OwnerCell, Pill, TeamTag } from './bits'

function lastUpdate(c: Commitment, today: string): string | null {
  const past = c.updates.filter((u) => u.date <= today).map((u) => u.date).sort()
  return past.length ? past[past.length - 1] : null
}

export function CommitmentTable({
  rows,
  sort,
  onSort,
  onOpen,
}: {
  rows: Commitment[]
  sort: { key: SortKey; dir: 1 | -1 }
  onSort: (k: SortKey) => void
  onOpen: (id: string) => void
}) {
  const { today } = useStore()
  const sorted = sortCommitments(rows, sort.key, sort.dir)
  const arrow = (k: SortKey) => (sort.key === k ? <span className="ar">{sort.dir > 0 ? '▲' : '▼'}</span> : null)

  if (!sorted.length) return <div className="empty">No commitments match this filter.</div>

  return (
    <table>
      <thead>
        <tr>
          <th onClick={() => onSort('urgency')}>Status{arrow('urgency')}</th>
          <th>Commitment</th>
          <th onClick={() => onSort('team')}>Team{arrow('team')}</th>
          <th>Owner</th>
          <th onClick={() => onSort('deadline')}>Deadline{arrow('deadline')}</th>
          <th>Last update</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {sorted.map((c) => {
          const rel = relTag(c)
          const lu = lastUpdate(c, today)
          return (
            <tr key={c.id} onClick={() => onOpen(c.id)}>
              <td>
                <Pill status={c.status} />
              </td>
              <td className="c-title">
                {c.title}
                {c.slip_count > 0 && <span className="slips" style={{ marginLeft: 6 }}>{c.slip_count}× slipped</span>}
              </td>
              <td>
                <TeamTag team={c.team} />
              </td>
              <td>
                <OwnerCell name={c.owner} />
              </td>
              <td className="dl tnum">
                {nice(c.eff_deadline)} <span className={`rel ${rel.cls}`}>{rel.text}</span>
              </td>
              <td className="c-sub tnum">{lu ? nice(lu) : '–'}</td>
              <td className="chev">›</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
