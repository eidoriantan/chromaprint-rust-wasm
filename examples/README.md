# Examples

Each example takes audio, turns it into mono 16-bit PCM and passes it to
`fingerprint(sampleRate, samples)`.

| Example | What it shows |
| --- | --- |
| [`browser/`](browser) | A single HTML file that loads the package from a CDN. No build step. |
| [`vite-worker/`](vite-worker) | A Vite + TypeScript app that fingerprints in a Web Worker. |
| [`node/`](node) | A Node.js script that fingerprints PCM piped in from `ffmpeg`. |
| [`fingerprint.rs`](fingerprint.rs) | Using the Rust crate directly, without WebAssembly. |

The full demo at <https://chromaprint.eidoriantan.com> is built the same way as
`vite-worker/`; its source is on the
[`gh-pages`](https://github.com/eidoriantan/chromaprint-rust-wasm/tree/gh-pages)
branch.

## browser

Serve the folder over HTTP (ES modules and `fetch` do not work from `file://`)
and open it:

```sh
npx serve examples/browser
```

## vite-worker

```sh
cd examples/vite-worker
npm install
npm run dev
```

Two things in `vite.config.ts` matter:

- `optimizeDeps.exclude: ['chromaprint-web']` stops Vite pre-bundling the
  package, which would break how it finds `chromaprint_web_bg.wasm`.
- `worker.format: 'es'` lets the worker use `import`.

## node

Needs [`ffmpeg`](https://ffmpeg.org) to decode the audio.

```sh
cd examples/node
npm install
ffmpeg -i song.mp3 -f s16le -ac 1 -ar 44100 - | node fingerprint.mjs 44100
```

Node cannot `fetch` a `file:` URL, so the script reads the `.wasm` file itself
and passes the bytes to `init()`.

## fingerprint.rs

From the repository root:

```sh
ffmpeg -i song.mp3 -f s16le -ac 1 -ar 44100 - | cargo run --example fingerprint -- 44100
```
