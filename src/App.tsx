import { useState, type DragEvent, type ReactNode } from 'react'
import { decodeAudioFile, type DecodedAudio } from './lib/audio'
import { fingerprintInWorker } from './lib/fingerprint'

type Status = 'idle' | 'decoding' | 'fingerprinting' | 'done' | 'error'

interface Result {
  fileName: string
  fileSize: number
  audio: DecodedAudio
  fingerprint: string
  decodeMs: number
  fingerprintMs: number
  totalMs: number
}

const statusText: Record<Status, string> = {
  idle: '',
  decoding: 'Decoding audio…',
  fingerprinting: 'Computing fingerprint…',
  done: '',
  error: '',
}

const currentYear = new Date().getFullYear()

export default function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)

  const busy = status === 'decoding' || status === 'fingerprinting'

  async function handleFile(file: File) {
    setResult(null)
    setError('')
    setCopied(false)
    try {
      const start = performance.now()
      setStatus('decoding')
      const audio = await decodeAudioFile(file)
      const decodeMs = performance.now() - start

      setStatus('fingerprinting')
      const { fingerprint, elapsedMs } = await fingerprintInWorker(audio.sampleRate, audio.samples)

      setResult({
        fileName: file.name,
        fileSize: file.size,
        audio,
        fingerprint,
        decodeMs,
        fingerprintMs: elapsedMs,
        totalMs: performance.now() - start,
      })
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && !busy) void handleFile(file)
  }

  async function copy() {
    if (!result) return
    await navigator.clipboard.writeText(result.fingerprint)
    setCopied(true)
  }

  return (
    <div className="flex min-h-screen flex-col text-zinc-900 dark:text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 bg-white/80 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
          <a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <WaveIcon className="size-4" />
            </span>
            chromaprint.wasm
          </a>
          <nav className="flex items-center gap-1">
            <RepoLink href="https://github.com/eidoriantan/chromaprint-rust-wasm" label="Open Source" />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <section className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Audio fingerprinting in the browser
          </h1>
          <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
            A test page for rust-chromaprint compiled to WebAssembly. Audio is decoded locally,
            averaged to mono, and fingerprinted in a Web Worker. Nothing leaves your device.
          </p>
        </section>

        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
            dragging
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
              : 'border-zinc-300 bg-zinc-50/50 hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-zinc-700 dark:bg-zinc-900/30 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/20'
          } ${busy ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            type="file"
            accept="audio/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ''
            }}
          />
          <span className="mb-4 grid size-12 place-items-center rounded-full bg-white text-indigo-600 shadow-sm ring-1 ring-zinc-200 transition-transform group-hover:scale-105 dark:bg-zinc-900 dark:text-indigo-400 dark:ring-zinc-800">
            <UploadIcon className="size-5" />
          </span>
          <span className="font-medium">Drop an audio file here or click to choose</span>
          <span className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            MP3, WAV, FLAC, OGG, AAC and anything else your browser can decode
          </span>
        </label>

        {busy && (
          <p className="mt-6 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {statusText[status]}
          </p>
        )}

        {status === 'error' && (
          <p className="mt-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {result && (
          <section className="mt-10 space-y-8">
            <div>
              <SectionTitle>File</SectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Name" value={result.fileName} />
                <Stat label="Size" value={formatBytes(result.fileSize)} />
                <Stat label="Duration" value={`${result.audio.duration.toFixed(2)} s`} />
                <Stat label="Channels" value={`${result.audio.channels} → 1`} hint="averaged" />
                <Stat
                  label="Sample rate"
                  value={`${result.audio.sampleRate} Hz`}
                  hint={
                    result.audio.resampled
                      ? `resampled from ${result.audio.originalSampleRate} Hz`
                      : undefined
                  }
                />
                <Stat label="Samples" value={result.audio.samples.length.toLocaleString()} />
              </div>
            </div>

            <div>
              <SectionTitle>Timing</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Stat label="Decode" value={formatMs(result.decodeMs)} />
                <Stat label="Fingerprint (WASM)" value={formatMs(result.fingerprintMs)} accent />
                <Stat label="Total" value={formatMs(result.totalMs)} />
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle className="mb-0">
                  Fingerprint{' '}
                  <span className="font-normal normal-case tracking-normal">
                    ({result.fingerprint.length.toLocaleString()} chars)
                  </span>
                </SectionTitle>
                <button
                  type="button"
                  onClick={() => void copy()}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="max-h-64 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap dark:border-zinc-800 dark:bg-zinc-900/60">
                {result.fingerprint}
              </pre>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        © {currentYear}{' '}
        <a
          href="https://eidoriantan.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
        >
          @eidoriantan
        </a>
      </footer>
    </div>
  )
}

function RepoLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href.replace('https://', '')}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      <GitHubIcon className="size-4" />
      {label}
    </a>
  )
}

function SectionTitle({ children, className = 'mb-3' }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={`text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ${className}`}
    >
      {children}
    </h2>
  )
}

function Stat({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string
  value: string
  hint?: string
  accent?: boolean
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border p-4 ${
        accent
          ? 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/30'
          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40'
      }`}
    >
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 truncate font-semibold" title={value}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</div>}
    </div>
  )
}

function WaveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M4 10v4M8 6v12M12 9v6M16 4v16M20 10v4" />
    </svg>
  )
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

function formatMs(ms: number) {
  return ms < 1000 ? `${ms.toFixed(1)} ms` : `${(ms / 1000).toFixed(2)} s`
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}
