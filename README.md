# chromaprint-rust-wasm

[![npm](https://img.shields.io/npm/v/chromaprint-web)](https://www.npmjs.com/package/chromaprint-web)

A pure Rust implementation of [Chromaprint], compiled to WebAssembly and
published to npm as [`chromaprint-web`][npm].

Chromaprint is the audio fingerprinting algorithm behind [AcoustID]. This
package lets you compute those fingerprints in the browser or Node.js without
native binaries such as `fpcalc`.

**Demo:** <https://chromaprint.eidoriantan.com>, which decodes and fingerprints
audio files locally in your browser.

This is a fork of [0xcaff/rust-chromaprint][upstream] by Martin Charles. It has
been modified to remove deprecated code and is published to npm.

## Installation

```sh
npm install chromaprint-web
```

Or load it straight from a CDN with no build step:

```js
import init, { fingerprint } from 'https://cdn.jsdelivr.net/npm/chromaprint-web@1/chromaprint_web.js'
```

## Usage

```js
import init, { fingerprint } from 'chromaprint-web'

// Load the WebAssembly module once before calling `fingerprint`
await init()

// `samples` is mono 16-bit PCM (an Int16Array) at `sampleRate` Hz
const result = fingerprint(44100, samples)
// => "AQAAC0kkRVHCJEqU4IS6Hs8FH5eh_8jP4ztOHEoYQYwAgABBhog"
```

### Getting PCM samples in the browser

`fingerprint` does not decode audio files. In the browser, Web Audio can do
the decoding:

```js
const SAMPLE_RATE = 44100

async function fingerprintFile(file) {
  // An OfflineAudioContext decodes the file and resamples it to SAMPLE_RATE
  const context = new OfflineAudioContext(1, 1, SAMPLE_RATE)
  const audio = await context.decodeAudioData(await file.arrayBuffer())

  // Average every channel into one and convert to 16-bit integers
  const channels = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c))
  const samples = new Int16Array(audio.length)
  for (let i = 0; i < audio.length; i++) {
    let sum = 0
    for (const channel of channels) sum += channel[i]
    const s = Math.max(-1, Math.min(1, sum / channels.length))
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }

  return fingerprint(SAMPLE_RATE, samples)
}
```

Fingerprinting a full song takes a moment, so for real apps run it in a Web
Worker. See [`examples/vite-worker`](examples/vite-worker).

### Node.js

Node cannot `fetch` a `file:` URL, so read the `.wasm` file and pass its bytes
to `init`:

```js
import { readFile } from 'node:fs/promises'
import init, { fingerprint } from 'chromaprint-web'

const wasm = await readFile(new URL(import.meta.resolve('chromaprint-web/chromaprint_web_bg.wasm')))
await init({ module_or_path: wasm })
```

### Bundlers

With Vite, exclude the package from dependency pre-bundling, or the `.wasm`
file will not be found:

```js
// vite.config.js
export default {
  optimizeDeps: { exclude: ['chromaprint-web'] },
}
```

## API

### `init(input?)`

Loads and instantiates the WebAssembly module. Call it once and await it before
`fingerprint`. With no argument it fetches `chromaprint_web_bg.wasm` from next
to the JavaScript file. You can also pass `{ module_or_path }` with a URL, a
`Response`, the raw bytes or a compiled `WebAssembly.Module`.

`initSync({ module })` does the same synchronously from bytes or a compiled
module.

### `fingerprint(sampleRate, samples): string`

| Parameter | Type | Description |
| --- | --- | --- |
| `sampleRate` | `number` | Sample rate of `samples` in Hz, from 1 to 65535. |
| `samples` | `Int16Array` | Mono 16-bit PCM. Downmix stereo to mono first. |

Returns the compressed fingerprint, base64 encoded with the URL-safe alphabet
and no padding. This is the same format as `fpcalc` prints and that the
[AcoustID lookup API][acoustid-api] expects. Audio above 65535 Hz, such as
96 kHz, must be resampled first.

The fingerprint may differ slightly from the C library's output because of
small differences in the FFT, but AcoustID matches fingerprints by similarity,
so they still work for lookups.

## Looking up a fingerprint on AcoustID

Send the fingerprint with the duration in whole seconds and an
[AcoustID API key][acoustid-key]:

```js
const params = new URLSearchParams({
  client: 'YOUR_API_KEY',
  meta: 'recordings',
  duration: String(Math.round(duration)),
  fingerprint: result,
})
const response = await fetch(`https://api.acoustid.org/v2/lookup?${params}`)
```

## Examples

The [`examples`](examples) folder has runnable examples:

- [`browser/`](examples/browser): a single HTML file, no build step
- [`vite-worker/`](examples/vite-worker): Vite + TypeScript, fingerprinting in a Web Worker
- [`node/`](examples/node): Node.js with `ffmpeg` decoding
- [`fingerprint.rs`](examples/fingerprint.rs): the Rust crate used directly

## Building from source

You need [Rust] with the `wasm32-unknown-unknown` target and [wasm-pack].

```sh
rustup target add wasm32-unknown-unknown
wasm-pack build --target web
```

The package is written to `pkg/`. Run the tests with:

```sh
cargo test
```

Pushing a `v*.*.*` tag builds the package in CI and publishes it to npm. The
tag must match the `version` in `Cargo.toml`.

[Chromaprint]: https://acoustid.org/chromaprint
[AcoustID]: https://acoustid.org
[acoustid-api]: https://acoustid.org/webservice
[acoustid-key]: https://acoustid.org/new-application
[npm]: https://www.npmjs.com/package/chromaprint-web
[upstream]: https://github.com/0xcaff/rust-chromaprint
[Rust]: https://www.rust-lang.org/tools/install
[wasm-pack]: https://rustwasm.github.io/wasm-pack/
