import { useState } from 'react'
import { useStore } from './store/store'
import { addDays } from './lib/format'
import { applyFilter, type Filter, type SortKey } from './lib/select'
import type { Commitment } from './api/types'
import { Header } from './components/Header'
import { Toolbar } from './components/Toolbar'
import { WeeklyBrief } from './components/WeeklyBrief'
import { CommitmentTable } from './components/CommitmentTable'
import { Timeline } from './components/Timeline'
import { ActivityFeed } from './components/ActivityFeed'
import { DetailDrawer } from './components/DetailDrawer'
import { AskDrawer } from './components/AskDrawer'
import { NewCommitmentDrawer, type Prefill } from './components/NewCommitmentDrawer'

type View = 'list' | 'timeline'

const VIEW_TITLE: Record<Filter, string> = {
  all: 'All commitments',
  attention: 'Needs attention',
  d3: 'Due within 3 days',
  d7: 'Due within 7 days',
}

export default function App() {
  const { commitments, today } = useStore()
  const [view, setView] = useState<View>('list')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'urgency', dir: 1 })

  const [detailId, setDetailId] = useState<string | null>(null)
  const [askOpen, setAskOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [prefill, setPrefill] = useState<Prefill | null>(null)

  const visible = applyFilter(commitments, filter)

  const onSort = (k: SortKey) =>
    setSort((s) => (s.key === k ? { key: k, dir: (s.dir * -1) as 1 | -1 } : { key: k, dir: 1 }))

  const openNew = () => {
    setPrefill(null)
    setNewOpen(true)
  }
  const onTask = (c: Commitment) => {
    setPrefill({ title: `Follow up: ${c.title}`, team: c.team, owner: c.owner, deadline: addDays(today, 2) })
    setNewOpen(true)
  }

  return (
    <>
      <Header onAsk={() => setAskOpen(true)} onNew={openNew} />
      <Toolbar view={view} setView={setView} filter={filter} setFilter={setFilter} />

      <div className="layout">
        <div>
          <WeeklyBrief onOpen={setDetailId} />
          <div className="card">
            <div className="card-h">
              <h2>{VIEW_TITLE[filter]}</h2>
              <span className="r">
                {visible.length} of {commitments.length}
              </span>
            </div>
            {view === 'list' ? (
              <CommitmentTable rows={visible} sort={sort} onSort={onSort} onOpen={setDetailId} />
            ) : (
              <Timeline rows={visible} onOpen={setDetailId} />
            )}
          </div>
        </div>

        <ActivityFeed filter={filter} onOpen={setDetailId} onTask={onTask} />
      </div>

      <DetailDrawer id={detailId} onClose={() => setDetailId(null)} onTask={onTask} />
      <AskDrawer open={askOpen} onClose={() => setAskOpen(false)} onOpen={setDetailId} />
      <NewCommitmentDrawer open={newOpen} onClose={() => setNewOpen(false)} prefill={prefill} />
    </>
  )
}
