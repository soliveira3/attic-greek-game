// Unicode normalization for Greek strings. Mirrors pipeline/normalize.py; every comparison of
// Greek text in the app goes through this module (CLAUDE.md: never compare Greek with raw ===).

const cp = (code: number) => String.fromCodePoint(code)

export const MACRON = cp(0x304)
export const BREVE = cp(0x306)
export const ACUTE = cp(0x301)
export const GRAVE = cp(0x300)
export const CIRCUMFLEX = cp(0x342)
export const DIAERESIS = cp(0x308)
export const SMOOTH = cp(0x313)
export const ROUGH = cp(0x314)
export const IOTA_SUBSCRIPT = cp(0x345)

const LENGTH_MARKS = new Set([MACRON, BREVE])
const ACCENTS = new Set([ACUTE, GRAVE, CIRCUMFLEX])
const COMBINING = /\p{M}/u

export function nfc(s: string): string {
  return s.normalize('NFC')
}

function drop(s: string, marks: Set<string>): string {
  return nfc([...s.normalize('NFD')].filter((ch) => !marks.has(ch)).join(''))
}

/** Remove vowel-length marks (macron, breve). */
export function stripLength(s: string): string {
  return drop(s, LENGTH_MARKS)
}

/** Remove accents, diaeresis and length marks; keep breathings and iota subscript. */
export function stripAccents(s: string): string {
  return drop(s, new Set([...LENGTH_MARKS, ...ACCENTS, DIAERESIS]))
}

/** Remove every combining mark, leaving bare letters. */
export function stripAll(s: string): string {
  return nfc([...s.normalize('NFD')].filter((ch) => !COMBINING.test(ch)).join(''))
}

/** Use ς at the end of a word and σ elsewhere. */
export function finalSigma(s: string): string {
  return s.replace(/ς(?=[\p{L}\p{M}])/gu, 'σ').replace(/σ(?![\p{L}\p{M}])/gu, 'ς')
}

/** Matching key for stored forms: NFC without length marks. */
export function key(s: string): string {
  return stripLength(nfc(s))
}

/** A typed answer, ready to compare: trimmed, composed, lowercase, final sigma, no length marks. */
export function canon(s: string): string {
  return key(finalSigma(nfc(s.trim()).toLowerCase()))
}

/**
 * A stored form for display. Wiktionary writes a macron and a breve together on a vowel of
 * either length; that pair is always hidden. `lengthMarks: false` hides all length marks.
 */
export function displayForm(s: string, opts: { lengthMarks?: boolean } = {}): string {
  if (opts.lengthMarks === false) return stripLength(s)
  const out: string[] = []
  const chars = [...s.normalize('NFD')]
  for (let i = 0; i < chars.length; i++) {
    const both =
      (chars[i] === MACRON && chars[i + 1] === BREVE) || (chars[i] === BREVE && chars[i + 1] === MACRON)
    if (both) i++
    else out.push(chars[i])
  }
  return nfc(out.join(''))
}
