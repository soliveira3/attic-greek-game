// Player settings (SPEC §10), persisted in the store and validated on load.

import { type Strictness, STRICTNESS } from './check'
import {
  type LemmaClass,
  type Pos,
  type Tense,
  type VoiceGroup,
  ADJ_CLASSES,
  NOUN_CLASSES,
  POS,
  TENSES,
  VERB_CLASSES,
  VOICE_GROUPS,
} from './features'
import type { Store } from './storage'

export interface Settings {
  strictness: Strictness
  scope: {
    pos: Pos[]
    /** Empty means every class of the chosen parts of speech. */
    classes: LemmaClass[]
    tenses: Tense[]
    voices: VoiceGroup[]
    dual: boolean
  }
  /** Show vowel-length marks (macron, breve) in displayed forms. */
  lengthMarks: boolean
  /** New cards Review introduces per day (SPEC §8). */
  newPerDay: number
  /** XP a day that fills the daily goal ring (lib/path.ts). */
  dailyGoal: number
  /** Sound effects for right and wrong answers and finished lessons. */
  sound: boolean
}

export const DAILY_GOALS = [10, 20, 30, 50] as const

export const DEFAULT_SETTINGS: Settings = {
  strictness: 'ignore-accents',
  scope: { pos: [...POS], classes: [], tenses: [...TENSES], voices: [...VOICE_GROUPS], dual: false },
  lengthMarks: true,
  newPerDay: 20,
  dailyGoal: 20,
  sound: true,
}

export const MAX_NEW_PER_DAY = 200

const KEY = 'settings'
const ALL_CLASSES: readonly string[] = ['article', ...NOUN_CLASSES, ...ADJ_CLASSES, ...VERB_CLASSES]

function only<T extends string>(allowed: readonly string[], value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value.filter((v) => allowed.includes(v)) as T[]) : fallback
}

export function loadSettings(store: Store): Settings {
  const raw = store.read<Partial<Record<string, unknown>>>(KEY, {})
  const scope = (raw.scope ?? {}) as Partial<Record<string, unknown>>
  const d = DEFAULT_SETTINGS
  return {
    strictness: STRICTNESS.includes(raw.strictness as Strictness) ? (raw.strictness as Strictness) : d.strictness,
    scope: {
      pos: only(POS, scope.pos, d.scope.pos),
      classes: only(ALL_CLASSES, scope.classes, d.scope.classes),
      tenses: only(TENSES, scope.tenses, d.scope.tenses),
      voices: only(VOICE_GROUPS, scope.voices, d.scope.voices),
      dual: typeof scope.dual === 'boolean' ? scope.dual : d.scope.dual,
    },
    lengthMarks: typeof raw.lengthMarks === 'boolean' ? raw.lengthMarks : d.lengthMarks,
    newPerDay:
      Number.isInteger(raw.newPerDay) && (raw.newPerDay as number) >= 0 && (raw.newPerDay as number) <= MAX_NEW_PER_DAY
        ? (raw.newPerDay as number)
        : d.newPerDay,
    dailyGoal: (DAILY_GOALS as readonly unknown[]).includes(raw.dailyGoal) ? (raw.dailyGoal as number) : d.dailyGoal,
    sound: typeof raw.sound === 'boolean' ? raw.sound : d.sound,
  }
}

export function saveSettings(store: Store, settings: Settings): void {
  store.write(KEY, settings)
}
