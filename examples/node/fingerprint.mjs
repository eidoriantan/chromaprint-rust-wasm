// Fingerprints raw mono 16-bit PCM read from stdin.
//
//   ffmpeg -i song.mp3 -f s16le -ac 1 -ar 44100 - | node fingerprint.mjs 44100

import { readFile } from 'node:fs/promises'
import init, { fingerprint } from 'chromaprint-web'

const sampleRate = Number(process.argv[2] ?? 44100)
if (!Number.isInteger(sampleRate) || sampleRate < 1 || sampleRate > 65535) {
  console.error('Sample rate must be an integer between 1 and 65535')
  process.exit(1)
}

// Node has no `fetch` for `file:` URLs, so pass the WASM bytes in directly
const wasmUrl = import.meta.resolve('chromaprint-web/chromaprint_web_bg.wasm')
await init({ module_or_path: await readFile(new URL(wasmUrl)) })

const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)
const bytes = Buffer.concat(chunks)

// Copy into a fresh buffer so the Int16Array is 2-byte aligned
const samples = new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length - (bytes.length % 2)))

console.log(`DURATION=${Math.round(samples.length / sampleRate)}`)
console.log(`FINGERPRINT=${fingerprint(sampleRate, samples)}`)
