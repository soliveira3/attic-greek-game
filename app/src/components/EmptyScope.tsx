import { href } from '../app/router'

export function EmptyScope() {
  return (
    <p className="warning">
      Nothing to practise with the current settings. <a href={href('settings')}>Change the settings</a> to choose what to
      drill.
    </p>
  )
}
