// A small line-icon set drawn for the app (24 × 24, round caps); decorative unless labelled.

const PATHS = {
  path: 'M12 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM7 14.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM17 14.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM10.5 7.5l-2.2 7.2M13.5 7.5l2.2 7.2',
  review: 'M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4',
  practice: 'M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11',
  progress: 'M4 20h16M7 16v-5M12 16V6M17 16v-8',
  notes: 'M4 5.5C4 4.7 4.7 4 5.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4ZM20 5.5c0-.8-.7-1.5-1.5-1.5H14a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6Z',
  settings:
    'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5',
  flame: 'M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.4 3.6-8.3.4 1.6 1.3 2.7 2.4 3.3.1-2.8 1.5-5.3 3.6-6.8-.3 2.7.8 4.4 2.2 6.1 1.1 1.4 1.7 3.1 1.7 5.1 0 4-2.8 6.8-7 6.8Z',
  bolt: 'M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  wrong: 'M7 7l10 10M17 7 7 17',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9.5h-13Z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 9.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z',
  pen: 'M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5Zm9.5-13 3 3',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  grid: 'M4 4h16v16H4ZM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0ZM8 6H4.5c0 3 1.5 4.5 3.7 4.8M16 6h3.5c0 3-1.5 4.5-3.7 4.8M12 13v4M8.5 20.5h7M9.5 17h5v3.5h-5Z',
  timer: 'M12 8v5l3 2M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM9.5 2.5h5',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z',
  keyboard: 'M3 6.5h18v11H3ZM6.5 10h1M10 10h1M13.5 10h1M17 10h.5M7 14h10',
  play: 'M8 5.5v13l10.5-6.5Z',
} as const

export type IconName = keyof typeof PATHS

interface Props {
  name: IconName
  size?: number
  /** Accessible name; without it the icon is hidden from assistive technology. */
  label?: string
  className?: string
}

export function Icon({ name, size = 24, label, className }: Props) {
  const filled = name === 'flame' || name === 'bolt' || name === 'play'
  return (
    <svg
      className={['icon', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 1.2 : 2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
