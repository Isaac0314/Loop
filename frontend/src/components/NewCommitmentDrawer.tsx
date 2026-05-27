import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useStore } from '../store/store'
import { addDays, REAL_TODAY } from '../lib/format'
import { Drawer } from './bits'

export interface Prefill {
  title?: string
  team?: string
  owner?: string
  deadline?: string
}

export function NewCommitmentDrawer({
  open,
  onClose,
  prefill,
}: {
  open: boolean
  onClose: () => void
  prefill?: Prefill | null
}) {
  const { commitments, createCommitment } = useStore()
  const [title, setTitle] = useState('')
  const [team, setTeam] = useState('')
  const [owner, setOwner] = useState('')
  const [start, setStart] = useState(REAL_TODAY)
  const [deadline, setDeadline] = useState(addDays(REAL_TODAY, 14))
  const [ms, setMs] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [saving, setSaving] = useState(false)

  // (re)initialise whenever the drawer opens
  useEffect(() => {
    if (!open) return
    setTitle(prefill?.title ?? '')
    setTeam(prefill?.team ?? '')
    setOwner(prefill?.owner ?? '')
    setStart(REAL_TODAY)
    setDeadline(prefill?.deadline ?? addDays(REAL_TODAY, 14))
    setMs('')
  }, [open, prefill])

  const teams = [...new Set(commitments.map((c) => c.team))]

  const suggest = async () => {
    if (!title.trim()) {
      alert('Add a title first.')
      return
    }
    setSuggesting(true)
    try {
      const r = await api.suggestMilestones(title.trim(), team, start, deadline)
      if (r.milestones?.length) setMs(r.milestones.join('\n'))
      else alert('Could not reach the AI. Type milestones manually.')
    } catch {
      alert('Could not reach the AI. Type milestones manually.')
    } finally {
      setSuggesting(false)
    }
  }

  const create = async () => {
    if (!title.trim()) {
      alert('Title required')
      return
    }
    setSaving(true)
    try {
      await createCommitment({
        title: title.trim(),
        team: team.trim() || 'General',
        owner: owner.trim() || 'Unassigned',
        start,
        deadline,
        milestones: ms
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} title="New commitment" onClose={onClose}>
      <div className="field">
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ship onboarding revamp" />
      </div>
      <div className="grid2">
        <div className="field">
          <label>Team</label>
          <input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Engineering" list="teamlist" />
          <datalist id="teamlist">
            {teams.map((t) => (
              <option value={t} key={t} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label>Owner</label>
          <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Full name" />
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <label>Start</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label>Deadline</label>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>
          Milestones (optional, one per line)
          <button className="genbtn" type="button" style={{ float: 'right' }} onClick={suggest} disabled={suggesting}>
            {suggesting ? '✦ Thinking…' : '✦ Suggest with AI'}
          </button>
        </label>
        <textarea rows={3} value={ms} onChange={(e) => setMs(e.target.value)} placeholder={'Spec sign-off\nStaging deploy\nProd ship'} />
      </div>
      <button className="primary" style={{ marginTop: 8 }} onClick={create} disabled={saving}>
        {saving ? 'Creating…' : 'Create commitment'}
      </button>
    </Drawer>
  )
}
