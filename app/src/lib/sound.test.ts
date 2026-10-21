import { afterEach, describe, expect, it, vi } from 'vitest'

describe('playSound', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })
  it('stays silent where Web Audio is missing', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const { playSound } = await import('./sound')
    expect(() => playSound('right')).not.toThrow()
  })
  it('plays each note of a sound once', async () => {
    const started: number[] = []
    const param = { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
    class FakeContext {
      currentTime = 0
      destination = {}
      createOscillator() {
        return { type: '', frequency: { value: 0 }, connect: (g: unknown) => g, start: (t: number) => started.push(t), stop: vi.fn() }
      }
      createGain() {
        return { gain: param, connect: (d: unknown) => d }
      }
    }
    vi.stubGlobal('AudioContext', FakeContext)
    const { playSound } = await import('./sound')
    playSound('done')
    expect(started).toHaveLength(4)
    playSound('wrong')
    expect(started).toHaveLength(6)
  })
  it('never lets a failing sound break a round', async () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('no audio')
        }
      },
    )
    const { playSound } = await import('./sound')
    expect(() => playSound('right')).not.toThrow()
  })
})
