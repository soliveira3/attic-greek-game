// The mascot: Athena's little owl, the emblem on Attic coins, holding an olive sprig. Original
// drawing; colours come from the --owl-* tokens so it follows the theme.

export type Mood = 'calm' | 'happy' | 'cheer' | 'sad'

interface Props {
  mood?: Mood
  size?: number
  className?: string
}

export function Owl({ mood = 'calm', size = 120, className }: Props) {
  const wingLift = mood === 'cheer' ? -38 : 0
  const closed = mood === 'happy' || mood === 'cheer'
  return (
    <svg
      className={['owl', `owl-${mood}`, className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
    >
      {/* olive sprig */}
      <g className="owl-olive">
        <path d="M14 104 C 30 92, 40 84, 52 82" fill="none" stroke="var(--owl-stem)" strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="22" cy="93" rx="7" ry="3.2" transform="rotate(-50 22 93)" fill="var(--owl-leaf)" />
        <ellipse cx="31" cy="92" rx="7" ry="3.2" transform="rotate(25 31 92)" fill="var(--owl-leaf)" />
        <ellipse cx="34" cy="83" rx="7" ry="3.2" transform="rotate(-40 34 83)" fill="var(--owl-leaf)" />
        <circle cx="42" cy="89" r="3.6" fill="var(--owl-fruit)" />
      </g>
      {/* wings, behind the body */}
      <g transform={`rotate(${wingLift} 30 64)`}>
        <ellipse cx="28" cy="74" rx="11" ry="23" transform="rotate(14 28 74)" fill="var(--owl-wing)" />
      </g>
      <g transform={`rotate(${-wingLift} 90 64)`}>
        <ellipse cx="92" cy="74" rx="11" ry="23" transform="rotate(-14 92 74)" fill="var(--owl-wing)" />
      </g>
      {/* body and flat head */}
      <ellipse cx="60" cy="74" rx="33" ry="36" fill="var(--owl-body)" />
      <ellipse cx="60" cy="44" rx="35" ry="27" fill="var(--owl-body)" />
      <ellipse cx="60" cy="84" rx="21" ry="22" fill="var(--owl-belly)" />
      {[
        [52, 74],
        [66, 72],
        [58, 86],
        [70, 88],
        [49, 92],
      ].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x - 3} ${y} q3 3 6 0`} fill="none" stroke="var(--owl-wing)" strokeWidth="2" strokeLinecap="round" />
      ))}
      {[
        [44, 26],
        [54, 22],
        [66, 22],
        [76, 26],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2" fill="var(--owl-belly)" />
      ))}
      {/* face */}
      <circle cx="45" cy="47" r="15" fill="var(--owl-face)" />
      <circle cx="75" cy="47" r="15" fill="var(--owl-face)" />
      {closed ? (
        <>
          <path d="M37 49 q8 -9 16 0" fill="none" stroke="var(--owl-ink)" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M67 49 q8 -9 16 0" fill="none" stroke="var(--owl-ink)" strokeWidth="3.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="45" cy="47" r="10" fill="var(--owl-iris)" />
          <circle cx="75" cy="47" r="10" fill="var(--owl-iris)" />
          <circle cx={mood === 'sad' ? 45 : 46} cy={mood === 'sad' ? 50 : 47} r="5.5" fill="var(--owl-ink)" />
          <circle cx={mood === 'sad' ? 75 : 76} cy={mood === 'sad' ? 50 : 47} r="5.5" fill="var(--owl-ink)" />
          <circle cx="48" cy="44.5" r="2" fill="#fff" />
          <circle cx="78" cy="44.5" r="2" fill="#fff" />
        </>
      )}
      {/* brows: the little owl's pale eyebrows */}
      <path
        d={mood === 'sad' ? 'M33 36 q12 -2 22 4 M87 36 q-12 -2 -22 4' : 'M33 34 q12 -6 24 2 M87 34 q-12 -6 -24 2'}
        fill="none"
        stroke="var(--owl-belly)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M55 56 L65 56 L60 64 Z" fill="var(--owl-beak)" strokeLinejoin="round" />
      {/* feet */}
      <path d="M48 108 v4 M52 108 v4 M68 108 v4 M72 108 v4" stroke="var(--owl-beak)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
