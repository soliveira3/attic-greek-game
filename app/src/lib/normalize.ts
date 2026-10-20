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

/** Order of marks after a letter, as in NFD of the stored forms (ἄ = α + breathing + accent). */
export const MARK_ORDER = [MACRON, BREVE, DIAERESIS, SMOOTH, ROUGH, ACUTE, GRAVE, CIRCUMFLEX, IOTA_SUBSCRIPT]
const KNOWN_MARKS = new Set(MARK_ORDER)
// Other code points keyboards produce for the same marks.
const MARK_ALIASES: Record<string, string> = { [cp(0x303)]: CIRCUMFLEX, [cp(0x311)]: CIRCUMFLEX }
// Characters typed for marks, replaced by the combining marks they stand for: spacing accents and
// breathings (NFKC would turn them into a space plus a mark), apostrophes and quotation marks
// used for a breathing (smart punctuation turns a word-initial ' into U+2018), and the symbols of
// beta code left in an answer box. The TLG capital marker `*` is dropped.
const FOLD: Record<string, string> = {
  [cp(0x1fbf)]: SMOOTH, // psili
  [cp(0x1fbd)]: SMOOTH, // koronis
  [cp(0x2bc)]: SMOOTH, // modifier letter apostrophe
  [cp(0x2019)]: SMOOTH, // right single quotation mark
  [cp(0x2018)]: SMOOTH, // left single quotation mark (smart punctuation for ')
  "'": SMOOTH,
  [cp(0x1ffe)]: ROUGH, // dasia
  [cp(0x2bd)]: ROUGH, // modifier letter reversed comma
  [cp(0x384)]: ACUTE, // tonos
  [cp(0xb4)]: ACUTE, // acute accent
  [cp(0x1ffd)]: ACUTE, // oxia
  [cp(0x1fef)]: GRAVE, // varia
  '`': GRAVE,
  [cp(0x1fc0)]: CIRCUMFLEX, // perispomeni
  [cp(0xa8)]: DIAERESIS, // diaeresis
  [cp(0x37a)]: IOTA_SUBSCRIPT, // ypogegrammeni
  [cp(0x1fcd)]: SMOOTH + GRAVE,
  [cp(0x1fce)]: SMOOTH + ACUTE,
  [cp(0x1fcf)]: SMOOTH + CIRCUMFLEX,
  [cp(0x1fdd)]: ROUGH + GRAVE,
  [cp(0x1fde)]: ROUGH + ACUTE,
  [cp(0x1fdf)]: ROUGH + CIRCUMFLEX,
  [cp(0x1fed)]: DIAERESIS + GRAVE,
  [cp(0x1fee)]: DIAERESIS + ACUTE,
  [cp(0x1fc1)]: DIAERESIS + CIRCUMFLEX,
  ')': SMOOTH,
  '(': ROUGH,
  '/': ACUTE,
  '\\': GRAVE,
  '=': CIRCUMFLEX,
  '|': IOTA_SUBSCRIPT,
  '+': DIAERESIS,
  _: MACRON,
  '^': BREVE,
  '*': '',
}
const INVISIBLE = new RegExp(`[${cp(0x200b)}-${cp(0x200f)}${cp(0x2060)}${cp(0xfeff)}${cp(0xad)}]`, 'gu')
const VOWELS = 'αεηιουω'

/** Whether `mark`, typed after `letter`, belongs to it (marks go on vowels; a breathing also on ρ). */
export function takesMark(letter: string, mark: string): boolean {
  const base = letter.toLowerCase()
  return VOWELS.includes(base) || (base === 'ρ' && (mark === SMOOTH || mark === ROUGH))
}

/**
 * A typed answer, ready to compare: trimmed, compatibility characters folded, invisible
 * characters removed, lowercase, every mark on its letter in canonical order (a mark typed before
 * its vowel moves onto it; unknown marks are dropped), final sigma, no length marks.
 */
export function canon(s: string): string {
  const folded = [...s.replace(INVISIBLE, '')].map((ch) => FOLD[ch] ?? ch).join('')
  const clusters: { base: string; marks: string[] }[] = []
  let pending: string[] = []
  for (const ch of folded.normalize('NFKC').toLowerCase().normalize('NFD')) {
    const mark = MARK_ALIASES[ch] ?? (COMBINING.test(ch) ? ch : null)
    if (mark !== null) {
      if (!KNOWN_MARKS.has(mark)) continue
      const last = clusters[clusters.length - 1]
      if (last && !pending.length && takesMark(last.base, mark)) last.marks.push(mark)
      else pending.push(mark)
      continue
    }
    // marks typed before this letter go on it if it can take them, the rest wait for the next one
    clusters.push({ base: ch, marks: pending.filter((m) => takesMark(ch, m)) })
    pending = pending.filter((m) => !takesMark(ch, m))
  }
  const text = clusters
    .map((c) => c.base + [...new Set(c.marks)].sort((a, b) => MARK_ORDER.indexOf(a) - MARK_ORDER.indexOf(b)).join(''))
    .join('')
  // trailing punctuation (a full stop inserted by a phone keyboard, a comma, ano teleia, ;)
  return key(finalSigma(nfc(text.replace(/[\p{P}\s]+$/u, '')))).trim()
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
