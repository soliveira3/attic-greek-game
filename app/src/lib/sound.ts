// Short synthesized sound effects (no audio files). Silent where Web Audio is missing.

export type Sound = 'right' | 'wrong' | 'done'

// [frequency in Hz, start in s, length in s]
const NOTES: Record<Sound, [number, number, number][]> = {
  right: [
    [784, 0, 0.12],
    [1175, 0.09, 0.2],
  ],
  wrong: [
    [220, 0, 0.16],
    [185, 0.12, 0.22],
  ],
  done: [
    [523, 0, 0.14],
    [659, 0.12, 0.14],
    [784, 0.24, 0.14],
    [1047, 0.36, 0.38],
  ],
}

let context: AudioContext | null = null

export function playSound(sound: Sound): void {
  try {
    const Ctx = globalThis.AudioContext
    if (!Ctx) return
    context ??= new Ctx()
    const ctx = context
    const t0 = ctx.currentTime
    for (const [freq, start, length] of NOTES[sound]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = sound === 'wrong' ? 'triangle' : 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t0 + start)
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + length)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0 + start)
      osc.stop(t0 + start + length + 0.02)
    }
  } catch {
    // sound is a nicety; never let it break a round
  }
}
