// How to type Greek, with an example taken from the data (never typed by hand).

import { useApp } from '../app/AppContext'
import { greekToBeta } from '../lib/betacode'

export function TypingHint({ id }: { id?: string }) {
  const { data } = useApp()
  const example = data.lemmasWhere({ pos: ['verb'] })[0]
  return (
    <p id={id} className="hint">
      Type Greek, or beta code that turns into Greek as you type
      {example && (
        <>
          {' '}
          (<kbd>{greekToBeta(example.lemma)}</kbd> gives <span lang="grc">{example.lemma}</span>)
        </>
      )}
      : marks go after the letter — <kbd>)</kbd> smooth, <kbd>(</kbd> rough, <kbd>/</kbd> acute, <kbd>\</kbd> grave,{' '}
      <kbd>=</kbd> circumflex, <kbd>|</kbd> iota subscript, <kbd>+</kbd> diaeresis.
    </p>
  )
}
