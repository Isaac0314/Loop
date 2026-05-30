import { useStore } from '../store/store'
import { nice } from '../lib/format'

export function Header({ onAsk, onNew }: { onAsk: () => void; onNew: () => void }) {
  const { daysAhead, today, skipWeek, backToToday } = useStore()
  const sim = daysAhead !== 0

  return (
    <header>
      <div className="brand">
        <div className="logo">L</div>
        <span className="wm">
          Loop <i>AI</i>
        </span>
      </div>
      <div className="spacer" />

      <div className={'today-chip' + (sim ? ' demo' : '')} title={sim ? `Previewing ${daysAhead} days ahead` : 'Live, as of today'}>
        <span className="dot" />
        <small>{sim ? 'SIM' : 'LIVE'}</small>
        <span className="tnum">{nice(today)}</span>
      </div>

      {sim && (
        <button className="ghost" onClick={backToToday}>
          ↩ Today
        </button>
      )}
      <button className={sim ? 'on' : ''} onClick={skipWeek}>
        {sim ? '⏭ +1 week' : '⏭ Skip a week'}
      </button>
      <button onClick={onAsk}>Ask the agent</button>
      <button className="primary" onClick={onNew}>
        + New commitment
      </button>
    </header>
  )
}
