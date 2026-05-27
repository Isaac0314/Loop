// Small shared presentational components.
import type { ReactNode } from 'react'
import type { Status } from '../api/types'
import { hashHue, initials, STATUS_LABEL, teamColor } from '../lib/format'

export const Avatar = ({ name, className }: { name: string; className?: string }) => (
  <span className={'av' + (className ? ' ' + className : '')} style={{ background: `hsl(${hashHue(name)} 52% 45%)` }}>
    {initials(name)}
  </span>
)

export const OwnerCell = ({ name }: { name: string }) => (
  <span className="owner-cell">
    <Avatar name={name} />
    {name}
  </span>
)

export const Pill = ({ status }: { status: Status }) => (
  <span className={`pill s-${status}`}>{STATUS_LABEL[status]}</span>
)

export const TeamTag = ({ team }: { team: string }) => {
  const c = teamColor(team)
  return (
    <span className="team-tag" style={{ background: c + '14', color: c }}>
      {team}
    </span>
  )
}

export function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <>
      <div className={'scrim' + (open ? ' show' : '')} onClick={onClose} />
      <div className={'drawer' + (open ? ' show' : '')} role="dialog" aria-hidden={!open}>
        <div className="dh">
          <h3>{title}</h3>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="db">{children}</div>
        {footer}
      </div>
    </>
  )
}
