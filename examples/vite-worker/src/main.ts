import type { FingerprintRequest, FingerprintResponse } from './fingerprint.worker'

const SAMPLE_RATE = 44100

const worker = new Worker(new URL('./fingerprint.worker.ts', import.meta.url), { type: 'module' })
const pending = new Map<number, (res: FingerprintResponse) => void>()
let nextId = 0

worker.onmessage = (event: MessageEvent<FingerprintResponse>) => {
  pending.get(event.data.id)?.(event.data)
  pending.delete(event.data.id)
}

/** Fingerprints mono 16-bit PCM in the worker, keeping the main thread free. */
function fingerprintInWorker(sampleRate: number, samples: Int16Array): Promise<string> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, (res) => (res.ok ? resolve(res.fingerprint) : reject(new Error(res.error))))
    // The samples buffer is transferred, not copied
    worker.postMessage({ id, sampleRate, samples } satisfies FingerprintRequest, [samples.buffer])
  })
}

/** Decodes a file at SAMPLE_RATE and averages every channel into 16-bit mono PCM. */
async function decode(file: File): Promise<{ samples: Int16Array; duration: number }> {
  // Web Audio is not available in workers, so decoding happens here
  const context = new OfflineAudioContext(1, 1, SAMPLE_RATE)
  const audio = await context.decodeAudioData(await file.arrayBuffer())

  const channels = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c))
  const samples = new Int16Array(audio.length)
  for (let i = 0; i < audio.length; i++) {
    let sum = 0
    for (const channel of channels) sum += channel[i]
    const s = Math.max(-1, Math.min(1, sum / channels.length))
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return { samples, duration: audio.duration }
}

const output = document.querySelector<HTMLPreElement>('#output')!

document.querySelector<HTMLInputElement>('#file')!.addEventListener('change', async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  try {
    output.textContent = 'Decoding…'
    const { samples, duration } = await decode(file)

    output.textContent = 'Fingerprinting…'
    const result = await fingerprintInWorker(SAMPLE_RATE, samples)
    output.textContent = `Duration: ${duration.toFixed(2)} s\nFingerprint: ${result}`
  } catch (err) {
    output.textContent = `Error: ${err instanceof Error ? err.message : err}`
  }
})
