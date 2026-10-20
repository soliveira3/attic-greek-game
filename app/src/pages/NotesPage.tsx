import { href } from '../app/router'

export function NotesPage({ topic }: { topic?: string }) {
  return (
    <div className="page">
      <h1 tabIndex={-1}>Grammar notes</h1>
      <p>
        The grammar notes are still being written{topic ? `; this link will open the note on “${topic}”` : ''}. Until then,
        Smyth’s <cite>Greek Grammar</cite> covers every form drilled here.
      </p>
      <p>
        <a href={href('home')}>Back to the start</a>
      </p>
    </div>
  )
}
