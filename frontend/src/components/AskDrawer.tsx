import { useRef, useState } from 'react'
import { api } from '../api/client'
import { useStore } from '../store/store'
import { enrichHtml, mdToHtml } from '../lib/format'
import { Drawer } from './bits'

const SUGGESTIONS = [
  "What's at risk this week?",
  'What should I focus on first?',
  'Push the Greenfield pilot to next Friday',
  'Add milestone QA sign-off to the onboarding flow',
  'Create a task to chase the ICO renewal for Dani by Friday',
]

interface QA {
  id: number
  q: string
  html: string
}

export function AskDrawer({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: (id: string) => void }) {
  const { asOf, commitments, refresh } = useStore()
  const [items, setItems] = useState<QA[]>([])
  const [input, setInput] = useState('')
  const idRef = useRef(0)

  const ask = async (raw: string) => {
    const q = raw.trim()
    if (!q) return
    setInput('')
    const myId = ++idRef.current
    setItems((prev) => [{ id: myId, q, html: '<span class="thinking">Reading the commitments…</span>' }, ...prev])
    const set = (html: string) => setItems((prev) => prev.map((it) => (it.id === myId ? { ...it, html } : it)))
    try {
      const r = await api.act(q, asOf)
      if (r.action === 'answer') {
        set(enrichHtml(mdToHtml(r.answer || ''), commitments))
      } else if (r.action === 'error') {
        set(`<p>${r.message || "I couldn't do that."}</p>`)
      } else {
        set(`<div class="rec">${r.message || 'Done.'}</div>`)
        await refresh()
      }
    } catch {
      set('<p>Something went wrong reaching the agent.</p>')
    }
  }

  const onAnswerClick = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest('[data-open]')
    if (el) onOpen(el.getAttribute('data-open')!)
  }

  return (
    <Drawer
      open={open}
      title="Ask the agent"
      onClose={onClose}
      footer={
        <div className="askbar">
          <input
            value={input}
            placeholder="e.g. what's at risk this week?"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask(input)}
          />
          <button className="primary" onClick={() => ask(input)}>
            Ask
          </button>
        </div>
      }
    >
      <div className="ask-chips">
        {SUGGESTIONS.map((s) => (
          <button className="chip" key={s} onClick={() => ask(s)}>
            {s}
          </button>
        ))}
      </div>
      <div onClick={onAnswerClick}>
        {items.map((it) => (
          <div className="qa" key={it.id}>
            <div className="q">{it.q}</div>
            <div className="a" dangerouslySetInnerHTML={{ __html: it.html }} />
          </div>
        ))}
      </div>
    </Drawer>
  )
}
