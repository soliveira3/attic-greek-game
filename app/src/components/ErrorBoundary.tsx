// Catches a crash in one page, so the player sees a way out instead of a blank screen.

import { Component, type ReactNode } from 'react'
import { href } from '../app/router'

interface Props {
  children: ReactNode
}

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="page">
        <h1 tabIndex={-1}>Something went wrong</h1>
        <p>This page hit an error. Your progress is safe: it is saved in this browser after every answer.</p>
        <p>
          <a href={href('home')}>Back to your path</a>
        </p>
        <p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Reload the page
          </button>
        </p>
      </div>
    )
  }
}
