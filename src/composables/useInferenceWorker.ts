import { ref } from 'vue'
import type { InferenceBackend, InferenceCommand, InferenceEvent } from '../types/inference'

type PendingTranscription = {
  kind: 'transcription'
  resolve: (text: string) => void
  reject: (error: Error) => void
}

type PendingGeneration = {
  kind: 'generation'
  onUpdate?: (text: string) => void
  onSentence?: (text: string) => void
  resolve: (text: string) => void
  reject: (error: Error) => void
}

type PendingRequest = PendingTranscription | PendingGeneration

const isLoading = ref(false)
const isReady = ref(false)
const error = ref<string | null>(null)
const whisperLoadProgress = ref(0)
const llmLoadProgress = ref(0)
const whisperLoaded = ref(false)
const llmLoaded = ref(false)
const whisperBackend = ref<InferenceBackend | null>(null)
const llmBackend = ref<InferenceBackend | null>(null)

let worker: Worker | null = null
let loadPromise: Promise<void> | null = null
let resolveLoad: (() => void) | null = null
let rejectLoad: ((error: Error) => void) | null = null
let nextRequestId = 0
const pending = new Map<number, PendingRequest>()

function createWorker() {
  if (worker) return worker

  worker = new Worker(new URL('../workers/inference.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (message: MessageEvent<InferenceEvent>) => handleEvent(message.data)
  worker.onerror = () => {
    error.value = 'Inference worker failed. Please reload Ava.'
    isReady.value = false
    isLoading.value = false
    rejectLoad?.(new Error(error.value))
    resolveLoad = null
    rejectLoad = null
    for (const request of pending.values()) {
      request.reject(new Error(error.value))
    }
    pending.clear()
  }
  return worker
}

function send(command: InferenceCommand, transfer?: Transferable[]) {
  createWorker().postMessage(command, transfer || [])
}

function handleEvent(event: InferenceEvent) {
  if (event.type === 'progress') {
    if (event.model === 'whisper') whisperLoadProgress.value = event.progress
    if (event.model === 'llm') llmLoadProgress.value = event.progress
    return
  }

  if (event.type === 'backend') {
    if (event.model === 'whisper') whisperBackend.value = event.backend
    if (event.model === 'llm') llmBackend.value = event.backend
    return
  }

  if (event.type === 'ready') {
    isLoading.value = false
    isReady.value = true
    whisperBackend.value = event.backends.whisper
    llmBackend.value = event.backends.llm
    whisperLoaded.value = true
    llmLoaded.value = true
    resolveLoad?.()
    resolveLoad = null
    rejectLoad = null
    return
  }

  if (event.type === 'error') {
    error.value = event.message
    if (event.fatal) {
      isLoading.value = false
      isReady.value = false
      if (loadPromise) {
        loadPromise = null
      }
      rejectLoad?.(new Error(event.message))
      resolveLoad = null
      rejectLoad = null
    }

    if (event.requestId !== undefined) {
      const request = pending.get(event.requestId)
      if (request) {
        request.reject(new Error(event.message))
        pending.delete(event.requestId)
      }
    }
    return
  }

  if (event.requestId === undefined) return
  const request = pending.get(event.requestId)
  if (!request) return

  if (event.type === 'transcription' && request.kind === 'transcription') {
    request.resolve(event.text)
    pending.delete(event.requestId)
  } else if (event.type === 'generation-update' && request.kind === 'generation') {
    request.onUpdate?.(event.text)
  } else if (event.type === 'sentence' && request.kind === 'generation') {
    request.onSentence?.(event.text)
  } else if (event.type === 'complete' && request.kind === 'generation') {
    request.resolve(event.text)
    pending.delete(event.requestId)
  }
}

function load(): Promise<void> {
  if (isReady.value) return Promise.resolve()
  if (loadPromise) return loadPromise

  isLoading.value = true
  error.value = null
  whisperLoaded.value = false
  llmLoaded.value = false
  whisperLoadProgress.value = 0
  llmLoadProgress.value = 0

  loadPromise = new Promise<void>((resolve, reject) => {
    resolveLoad = resolve
    rejectLoad = reject
    send({ type: 'load' })
  }).catch((loadError: unknown) => {
    loadPromise = null
    throw loadError
  })

  return loadPromise
}

function transcribe(audio: Float32Array): Promise<string> {
  const requestId = ++nextRequestId
  return new Promise<string>((resolve, reject) => {
    pending.set(requestId, { kind: 'transcription', resolve, reject })
    send({ type: 'transcribe', requestId, audio }, [audio.buffer])
  })
}

function generateStreaming(
  prompt: string,
  onSentence: (sentence: string) => void,
  onUpdate?: (text: string) => void
): Promise<string> {
  const requestId = ++nextRequestId
  return new Promise<string>((resolve, reject) => {
    pending.set(requestId, {
      kind: 'generation',
      onSentence,
      onUpdate,
      resolve,
      reject
    })
    send({ type: 'generate', requestId, prompt })
  })
}

function cancel(requestId: number) {
  const request = pending.get(requestId)
  if (!request) return
  pending.delete(requestId)
  request.reject(new Error('Inference cancelled'))
  send({ type: 'cancel', requestId })
}

function cancelAll() {
  for (const [requestId, request] of pending.entries()) {
    request.reject(new Error('Inference cancelled'))
    send({ type: 'cancel', requestId })
  }
  pending.clear()
}

export function useInferenceWorker() {
  return {
    isLoading,
    isReady,
    error,
    whisperLoadProgress,
    llmLoadProgress,
    whisperLoaded,
    llmLoaded,
    whisperBackend,
    llmBackend,
    load,
    transcribe,
    generateStreaming,
    cancel,
    cancelAll
  }
}
