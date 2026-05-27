import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useStore } from '../store/store'
import { addDays, enrichHtml, isMonday, mdToHtml, nice, REAL_TODAY } from '../lib/format'

function recentMonday(s: string): string {
  let m = s
  for (let g = 0; g < 7 && !isMonday(m); g++) m = addDays(m, -1)
  return m
}
function nextMonday(): string {
  let m = addDays(REAL_TODAY, 1)
  for (let g = 0; g < 7 && !isMonday(m); g++) m = addDays(m, 1)
  return m
}

export function WeeklyBrief({ onOpen }: { onOpen: (id: string) => void }) {
  const { commitments, asOf, today } = useStore()
  const [raw, setRaw] = useState('')
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.brief(asOf)
      setRaw(r.answer || '')
      setLive(r.live)
    } catch {
      setRaw('Could not load the brief.')
    } finally {
      setLoading(false)
    }
  }, [asOf])

  useEffect(() => {
    load()
  }, [load])

  // Enrich at render time so colours/links/avatars appear once the commitments
  // have loaded, regardless of which fetch (brief vs list) resolves first.
  const html = useMemo(() => (raw ? enrichHtml(mdToHtml(raw), commitments) : ''), [raw, commitments])

  const onBodyClick = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest('[data-open]')
    if (el) onOpen(el.getAttribute('data-open')!)
  }

  return (
    <div className="card brief" id="brief">
      <div className="brief-h">
        <div>
          <h3>Weekly Ops Brief</h3>
          <div className="sched">
            ⏱ Auto-sent every Monday 9:00am · next {nice(nextMonday())}
          </div>
        </div>
        <div className="bnav">
          <button className="genbtn" onClick={load} disabled={loading}>
            {loading ? '✦ Generating…' : live ? '✦ Regenerate with AI' : '↻ Regenerate'}
          </button>
          <span className="tnum" title={live ? 'Written by the model' : 'Deterministic fallback'}>
            {live ? 'Live AI' : 'Local'} · Week of {nice(recentMonday(today))}
          </span>
        </div>
      </div>
      {loading ? (
        <div style={{ padding: '44px 16px', textAlign: 'center', color: '#9aa3b2', fontSize: 13, letterSpacing: '.02em' }}>
          ✦ Writing this week's brief…
        </div>
      ) : (
        <div onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  )
}
