import init, { fingerprint } from 'chromaprint-web'

export interface FingerprintRequest {
  id: number
  sampleRate: number
  samples: Int16Array
}

export type FingerprintResponse =
  | { id: number; ok: true; fingerprint: string; elapsedMs: number }
  | { id: number; ok: false; error: string }

const ready = init()

self.onmessage = async (event: MessageEvent<FingerprintRequest>) => {
  const { id, sampleRate, samples } = event.data
  try {
    await ready
    const start = performance.now()
    const result = fingerprint(sampleRate, samples)
    const elapsedMs = performance.now() - start
    self.postMessage({ id, ok: true, fingerprint: result, elapsedMs } satisfies FingerprintResponse)
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    self.postMessage({ id, ok: false, error } satisfies FingerprintResponse)
  }
}
