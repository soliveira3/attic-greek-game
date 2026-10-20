// On-screen polytonic keyboard (SPEC §7): letters, and marks that apply to the letter before the
// caret. Buttons keep the answer box focused when clicked and are in the tab order.

import { ACUTE, CIRCUMFLEX, DIAERESIS, GRAVE, IOTA_SUBSCRIPT, ROUGH, SMOOTH } from '../lib/normalize'
import { useTyping } from './typing'

const FINAL_SIGMA = String.fromCodePoint(0x3c2)
// α to ω, without final sigma (σ turns into ς at the end of a word by itself).
const LETTERS = Array.from({ length: 25 }, (_, i) => String.fromCodePoint(0x3b1 + i)).filter((c) => c !== FINAL_SIGMA)

const DOTTED_CIRCLE = String.fromCodePoint(0x25cc)
// The beta-code symbol for each mark: GreekInput already applies those to the previous letter.
const MARKS: [beta: string, name: string, mark: string][] = [
  [')', 'smooth breathing', SMOOTH],
  ['(', 'rough breathing', ROUGH],
  ['/', 'acute accent', ACUTE],
  ['\\', 'grave accent', GRAVE],
  ['=', 'circumflex', CIRCUMFLEX],
  ['|', 'iota subscript', IOTA_SUBSCRIPT],
  ['+', 'diaeresis', DIAERESIS],
]

export function GreekKeyboard() {
  const typing = useTyping()
  const key = (text: string, label: string, shown: string) => (
    <button
      key={label}
      type="button"
      className="key"
      aria-label={label}
      title={label}
      lang="grc"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => typing?.insert(text)}
    >
      {shown}
    </button>
  )
  return (
    <div className="keyboard" role="group" aria-label="Greek keyboard">
      <div className="keys">{LETTERS.map((l) => key(l, `letter ${l}`, l))}</div>
      <div className="keys marks">{MARKS.map(([beta, name, mark]) => key(beta, name, DOTTED_CIRCLE + mark))}</div>
    </div>
  )
}
