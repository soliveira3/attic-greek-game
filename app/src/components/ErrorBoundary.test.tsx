import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function Broken(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  // React logs caught errors to the console; keep the test output clean
  beforeEach(() => void vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('shows a way out instead of a blank page when a page crashes', () => {
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('heading', { level: 1, name: /something went wrong/i })).toBeInTheDocument()
    expect(screen.getByText(/your progress is safe/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to your path/i })).toHaveAttribute('href', '#/')
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
  })

  it('shows its children when nothing goes wrong', () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('fine')).toBeInTheDocument()
  })
})
