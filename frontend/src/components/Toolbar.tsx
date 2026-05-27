import { useState } from 'react'
import { useStore } from '../store/store'
import { FILTER_DEFS, filterCount, type Filter } from '../lib/select'

type View = 'list' | 'timeline'

export function Toolbar({
  view,
  setView,
  filter,
  setFilter,
}: {
  view: View
  setView: (v: View) => void
  filter: Filter
  setFilter: (f: Filter) => void
}) {
  const { commitments, daysAhead, resetDemo } = useStore()
  const [resetting, setResetting] = useState(false)

  const onReset = async () => {
    if (!confirm('Restore the demo scenario? This clears your changes.')) return
    setResetting(true)
    try {
      await resetDemo()
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="toolbar">
      <div className="tabs">
        <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>
          List
        </button>
        <button className={view === 'timeline' ? 'on' : ''} onClick={() => setView('timeline')}>
          Timeline
        </button>
      </div>

      <div className="chips">
        {FILTER_DEFS.map(([k, label]) => (
          <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>
            {label}
            <span className="n">{filterCount(commitments, k)}</span>
          </button>
        ))}
      </div>

      <div className="spacer" />
      {daysAhead !== 0 && <span style={{ fontSize: 12, color: 'var(--faint)' }}>Viewing +{daysAhead}d ahead</span>}
      <button className="ghost" onClick={onReset} disabled={resetting} title="Restore the demo scenario">
        ↺ {resetting ? 'Resetting…' : 'Reset demo data'}
      </button>
    </div>
  )
}
