// Presentation helpers only - formatting, colours, and a small markdown
// renderer. No business logic lives here; status/deadlines come from the API.
import type { Commitment, Status } from '../api/types'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function iso(d: Date): string {
  return (
    d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  )
}
export const parseISO = (s: string) => new Date(s + 'T12:00:00')
export const REAL_TODAY = iso(new Date())

export function addDays(s: string, n: number): string {
  const t = parseISO(s)
  t.setDate(t.getDate() + n)
  return iso(t)
}
export const daysBetween = (a: string, b: string) =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 864e5)

/** "Wed 4 Jun" */
export function nice(s: string): string {
  const t = parseISO(s)
  return `${WD[t.getDay()]} ${t.getDate()} ${MON[t.getMonth()]}`
}
export const isMonday = (s: string) => parseISO(s).getDay() === 1

export const firstName = (n: string) => (n || '').split(' ')[0] || n
export function initials(name: string): string {
  return (name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
export function hashHue(s: string): number {
  let h = 0
  for (let k = 0; k < (s || '').length; k++) h = (h * 31 + s.charCodeAt(k)) % 360
  return h
}

const TEAM_COLOR: Record<string, string> = {
  Engineering: '#3b5bdb',
  Commercial: '#0d9488',
  "Founder's Office": '#9333ea',
  Product: '#d97706',
}
export const teamColor = (t: string) => TEAM_COLOR[t] ?? '#64748b'

export const STATUS_LABEL: Record<Status, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  missed: 'Missed',
  complete: 'Delivered',
}

/** Relative deadline tag derived from the server's computed fields. */
export function relTag(c: Commitment): { text: string; cls: 'over' | 'soon' | 'ok' } {
  if (c.status === 'complete') return { text: 'delivered', cls: 'ok' }
  const left = c.days_left
  if (left < 0) return { text: `${-left}d overdue`, cls: 'over' }
  if (left === 0) return { text: 'today', cls: 'soon' }
  return { text: `in ${left}d`, cls: left <= 3 ? 'soon' : 'ok' }
}

/** Percentage position of a date within [a, b] window, clamped 0–100. */
export function pct(s: string, a: string, b: string): number {
  const span = parseISO(b).getTime() - parseISO(a).getTime()
  if (span <= 0) return 0
  return Math.max(0, Math.min(100, ((parseISO(s).getTime() - parseISO(a).getTime()) / span) * 100))
}

export const avatarHtml = (name: string) =>
  `<span class="av" style="background:hsl(${hashHue(name)} 52% 45%)">${initials(name)}</span>`

// ---- markdown -> HTML (small, dependency-free; escapes first) ----
export function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (s: string) =>
    s
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\*([^*]+)\*/g, '<i>$1</i>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
  const lines = esc(md).split(/\r?\n/)
  let out = '',
    ul = false
  for (const ln of lines) {
    const t = ln.trim()
    if (!t) {
      if (ul) {
        out += '</ul>'
        ul = false
      }
      continue
    }
    const m = t.match(/^[-*•]\s+(.*)/)
    if (m) {
      if (!ul) {
        out += '<ul>'
        ul = true
      }
      out += '<li>' + inline(m[1]) + '</li>'
      continue
    }
    if (ul) {
      out += '</ul>'
      ul = false
    }
    const h = t.match(/^#{1,3}\s+(.*)/)
    if (h) {
      out += `<div class="aih">${inline(h[1])}</div>`
      continue
    }
    if (/^action:/i.test(t)) {
      out += `<div class="rec"><b>Action:</b> ${inline(t.replace(/^action:\s*/i, ''))}</div>`
      continue
    }
    out += '<p>' + inline(t) + '</p>'
  }
  if (ul) out += '</ul>'
  return out
}

/** Colour team names, inject owner avatars, and make commitment titles
 *  clickable (data-open) inside rendered brief / answer HTML. */
export function enrichHtml(html: string, commitments: Commitment[]): string {
  const teams = [...new Set(commitments.map((c) => c.team))]
  for (const t of teams) {
    const c = teamColor(t)
    html = html.split(`<b>${t}</b>`).join(`<b style="color:${c}">${t}</b>`)
    html = html.split(`<div class="aih">${t}</div>`).join(`<div class="aih" style="color:${c}">${t}</div>`)
  }
  for (const it of commitments) {
    html = html
      .split(`<b>${it.title}</b>`)
      .join(
        `<b class="brieflink" data-open="${it.id}" style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px">${it.title}</b>`,
      )
  }
  for (const nm of [...new Set(commitments.map((c) => c.owner))]) {
    html = html.split(nm).join(`<span class="owner-cell">${avatarHtml(nm)}${nm}</span>`)
  }
  return html
}
