import type { FingerprintRequest, FingerprintResponse } from '../workers/fingerprint.worker'

let worker: Worker | undefined
let nextId = 0
const pending = new Map<number, (res: FingerprintResponse) => void>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/fingerprint.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (event: MessageEvent<FingerprintResponse>) => {
      pending.get(event.data.id)?.(event.data)
      pending.delete(event.data.id)
    }
    worker.onerror = (event) => {
      const error = event.message || 'Fingerprint worker failed'
      for (const [id, settle] of pending) settle({ id, ok: false, error })
      pending.clear()
    }
  }
  return worker
}

/** Fingerprints mono 16-bit PCM in a Web Worker. */
export function fingerprintInWorker(
  sampleRate: number,
  samples: Int16Array,
): Promise<{ fingerprint: string; elapsedMs: number }> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, (res) => {
      if (res.ok) resolve({ fingerprint: res.fingerprint, elapsedMs: res.elapsedMs })
      else reject(new Error(res.error))
    })
    // Transfer a copy so the caller keeps its samples
    const copy = samples.slice()
    getWorker().postMessage({ id, sampleRate, samples: copy } satisfies FingerprintRequest, [
      copy.buffer,
    ])
  })
}
