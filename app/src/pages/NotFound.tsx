import { href } from '../app/router'

export function NotFound() {
  return (
    <div className="page">
      <h1 tabIndex={-1}>Page not found</h1>
      <p>
        <a href={href('home')}>Back to the start</a>
      </p>
    </div>
  )
}
