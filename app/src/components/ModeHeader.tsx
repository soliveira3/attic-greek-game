// The heading row of a free-practice page: back to Practice, the mode's name, and a score.
import type { ReactNode } from 'react'
import { href } from '../app/router'
import { Icon } from './Icon'

interface Props {
  title: string
  /** Where the close button goes. */
  back?: 'practice' | 'home'
  children?: ReactNode
}

export function ModeHeader({ title, back = 'practice', children }: Props) {
  return (
    <div className="mode-header">
      <a className="icon-btn" href={href(back)} aria-label={back === 'home' ? 'Back to the path' : 'Back to Practice'}>
        <Icon name="close" />
      </a>
      <h1 tabIndex={-1}>{title}</h1>
      <div className="mode-extra">{children}</div>
    </div>
  )
}
