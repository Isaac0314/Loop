// Ready-to-send message drafts for each escalation tier. These are the words a
// founder can copy straight into Slack or email; the agent has already decided
// (deterministically) that the nudge/escalation is warranted.
import type { Commitment, Tier } from '../api/types'
import { firstName, nice } from './format'

export function draftFor(tier: Tier, c: Commitment): string {
  const dl = nice(c.eff_deadline)
  const who = firstName(c.owner)
  if (tier === 'owner')
    return `Hi ${who},\n\nHope you're well. Quick check-in on "${c.title}": it's due ${dl} and I haven't seen an update in a little while. Could you let me know where it stands, and flag anything that's blocking? Happy to help clear it.\n\nThanks!`
  if (tier === 'fa')
    return `Hi [name],\n\nFlagging "${c.title}" (${c.team}): it's at risk for its ${dl} deadline and ${who} has gone quiet despite a nudge. Could we grab 10 minutes to unblock it before it slips? I can pull the details together beforehand.\n\nThanks!`
  if (tier === 'founder')
    return `Hi [name],\n\nWanted to flag that "${c.title}" has missed its ${dl} deadline (${c.owner}). I'd suggest a brief nudge to ${who} and agreeing a revised date today, so it doesn't knock on to other work. Happy to chase and report back.\n\nThanks!`
  return ''
}

export function copyText(t: string): void {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(t).catch(() => fallbackCopy(t))
  } else fallbackCopy(t)
}
function fallbackCopy(t: string): void {
  const ta = document.createElement('textarea')
  ta.value = t
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try {
    document.execCommand('copy')
  } catch {
    /* ignore */
  }
  ta.remove()
}
