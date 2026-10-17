import { ALL_FORMATS, AudioSampleSink, BlobSource, Input, type InputAudioTrack } from 'mediabunny'

/** Largest sample rate the WASM `fingerprint` accepts (Rust `u16`). */
export const MAX_SAMPLE_RATE = 65535
/** Rate used when the source rate does not fit in a `u16`. */
export const FALLBACK_SAMPLE_RATE = 44100

export interface DecodedAudio {
  samples: Int16Array
  sampleRate: number
  originalSampleRate: number
  channels: number
  duration: number
  resampled: boolean
}

/**
 * Decodes an audio file at its native sample rate, downmixes it to mono by
 * averaging all channels and converts it to 16-bit PCM. Audio above 65535 Hz
 * is resampled to 44100 Hz.
 */
export async function decodeAudioFile(file: File): Promise<DecodedAudio> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) })
  try {
    return await decodeInput(input)
  } finally {
    input.dispose()
  }
}

async function decodeInput(input: Input): Promise<DecodedAudio> {
  const track = await input.getPrimaryAudioTrack()
  if (!track) throw new Error('No audio track found in this file.')
  if (!(await track.canDecode())) {
    throw new Error(`This browser cannot decode the "${track.codec ?? 'unknown'}" codec.`)
  }

  const originalSampleRate = track.sampleRate
  const channels = track.numberOfChannels

  let mono = await decodeMono(track)
  let sampleRate = originalSampleRate
  const resampled = originalSampleRate > MAX_SAMPLE_RATE
  if (resampled) {
    mono = await resample(mono, originalSampleRate, FALLBACK_SAMPLE_RATE)
    sampleRate = FALLBACK_SAMPLE_RATE
  }

  return {
    samples: toInt16(mono),
    sampleRate,
    originalSampleRate,
    channels,
    duration: mono.length / sampleRate,
    resampled,
  }
}

/** Decodes every sample of the track, averaging all channels into one. */
async function decodeMono(track: InputAudioTrack): Promise<Float32Array> {
  const chunks: Float32Array[] = []
  let length = 0

  for await (const sample of new AudioSampleSink(track).samples()) {
    try {
      const { numberOfFrames: frames, numberOfChannels } = sample
      const mono = new Float32Array(frames)
      const plane = new Float32Array(frames)
      for (let c = 0; c < numberOfChannels; c++) {
        sample.copyTo(plane, { planeIndex: c, format: 'f32-planar' })
        for (let i = 0; i < frames; i++) mono[i] += plane[i]
      }
      if (numberOfChannels > 1) {
        for (let i = 0; i < frames; i++) mono[i] /= numberOfChannels
      }
      chunks.push(mono)
      length += frames
    } finally {
      sample.close()
    }
  }

  const out = new Float32Array(length)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

async function resample(samples: Float32Array, from: number, to: number): Promise<Float32Array> {
  const source = new AudioBuffer({ length: samples.length, sampleRate: from, numberOfChannels: 1 })
  source.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)

  const offline = new OfflineAudioContext(1, Math.ceil((samples.length * to) / from), to)
  const node = offline.createBufferSource()
  node.buffer = source
  node.connect(offline.destination)
  node.start()
  return (await offline.startRendering()).getChannelData(0)
}

function toInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}
