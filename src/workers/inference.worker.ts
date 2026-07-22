import { pipeline } from '@huggingface/transformers'
import type { Wllama } from '@wllama/wllama'
import type {
  InferenceBackend,
  InferenceCommand,
  InferenceEvent,
  InferenceModel
} from '../types/inference'

const CONFIG_PATHS = {
  'single-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/esm/single-thread/wllama.wasm',
  'multi-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/esm/multi-thread/wllama.wasm',
}

const WHISPER_MODEL = 'onnx-community/whisper-tiny.en'
const LLM_MODEL = {
  repo: 'unsloth/gemma-3-270m-it-GGUF',
  file: 'gemma-3-270m-it-Q4_K_M.gguf'
}
const SENTENCE_BOUNDARY = /[.!?,](?:\s|$)/

type Transcriber = (audio: Float32Array) => Promise<{ text: string }>

let transcriber: Transcriber | null = null
let wllama: Wllama | null = null
let loadPromise: Promise<void> | null = null
let whisperBackend: InferenceBackend = 'wasm'
const cancelledRequests = new Set<number>()

function emit(event: InferenceEvent) {
  self.postMessage(event)
}

function hasWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

function reportProgress(model: InferenceModel, progress: number) {
  emit({ type: 'progress', model, progress: Math.max(0, Math.min(100, Math.round(progress))) })
}

async function loadWhisper() {
  reportProgress('whisper', 0)

  if (hasWebGPU()) {
    try {
      transcriber = await (pipeline as Function)('automatic-speech-recognition', WHISPER_MODEL, {
        device: 'webgpu',
        dtype: 'q4',
        progress_callback: (info: { progress?: number }) => {
          if (typeof info.progress === 'number') reportProgress('whisper', info.progress)
        }
      }) as Transcriber
      whisperBackend = 'webgpu'
      emit({ type: 'backend', model: 'whisper', backend: 'webgpu' })
      reportProgress('whisper', 100)
      return
    } catch {
      // Retry with WASM below. WebGPU is an optimization, not a requirement.
      transcriber = null
    }
  }

  transcriber = await (pipeline as Function)('automatic-speech-recognition', WHISPER_MODEL, {
    dtype: 'q4',
    progress_callback: (info: { progress?: number }) => {
      if (typeof info.progress === 'number') reportProgress('whisper', info.progress)
    }
  }) as Transcriber
  whisperBackend = 'wasm'
  emit({ type: 'backend', model: 'whisper', backend: 'wasm' })
  reportProgress('whisper', 100)
}

async function loadLLM() {
  reportProgress('llm', 0)
  // Wllama resolves asset paths through document.baseURI, but this module
  // runs in a worker. Provide the minimal browser-compatible base URI shim
  // before dynamically loading the runtime.
  if (!('document' in globalThis)) {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { baseURI: self.location.href }
    })
  }
  const { Wllama } = await import('@wllama/wllama')
  wllama = new Wllama(CONFIG_PATHS)
  await wllama.loadModelFromHF(LLM_MODEL.repo, LLM_MODEL.file, {
    progressCallback: ({ loaded, total }: { loaded: number; total: number }) => {
      reportProgress('llm', total > 0 ? (loaded / total) * 100 : 0)
    }
  })
  emit({ type: 'backend', model: 'llm', backend: 'wasm' })
  reportProgress('llm', 100)
}

async function loadModels() {
  if (loadPromise) return loadPromise

  loadPromise = Promise.all([loadWhisper(), loadLLM()])
    .then(() => {
      emit({
        type: 'ready',
        backends: { whisper: whisperBackend, llm: 'wasm' }
      })
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to load inference models'
      emit({ type: 'error', message, fatal: true })
      loadPromise = null
      throw error
    })

  return loadPromise
}

function formatChatPrompt(userMessage: string): string {
  return `<start_of_turn>user
You are Ava. Reply in 1-2 short sentences only.

${userMessage}<end_of_turn>
<start_of_turn>model
`
}

async function transcribe(requestId: number, audio: Float32Array) {
  if (!transcriber) throw new Error('Speech model not loaded')
  if (cancelledRequests.has(requestId)) {
    cancelledRequests.delete(requestId)
    return
  }

  const result = await transcriber(audio)
  if (cancelledRequests.has(requestId)) {
    cancelledRequests.delete(requestId)
    return
  }
  const text = result?.text?.trim() || ''
  if (text) emit({ type: 'transcription', requestId, text })
  cancelledRequests.delete(requestId)
}

async function generate(requestId: number, prompt: string) {
  if (!wllama) throw new Error('Language model not loaded')

  let buffer = ''
  let spokenText = ''
  const formattedPrompt = formatChatPrompt(prompt)

  const result = await wllama.createCompletion(formattedPrompt, {
    nPredict: 64,
    sampling: { temp: 0.7, top_k: 40, top_p: 0.9 },
    onNewToken: (_token, _piece, currentText) => {
      if (cancelledRequests.has(requestId)) return

      const cleanText = currentText.replace(/<end_of_turn>.*$/s, '').trim()
      const newContent = cleanText.slice(spokenText.length)
      buffer += newContent
      spokenText = cleanText
      emit({ type: 'generation-update', requestId, text: cleanText })

      let match
      while ((match = SENTENCE_BOUNDARY.exec(buffer)) !== null) {
        const sentenceEnd = match.index + match[0].length
        const sentence = buffer.slice(0, sentenceEnd).trim()
        if (sentence) emit({ type: 'sentence', requestId, text: sentence })
        buffer = buffer.slice(sentenceEnd)
      }
    }
  })

  if (cancelledRequests.has(requestId)) {
    cancelledRequests.delete(requestId)
    return
  }
  const cleanResult = result.replace(/<end_of_turn>.*$/s, '').trim()
  if (buffer.trim()) emit({ type: 'sentence', requestId, text: buffer.trim() })
  emit({ type: 'complete', requestId, text: cleanResult })
  cancelledRequests.delete(requestId)
}

self.onmessage = (message: MessageEvent<InferenceCommand>) => {
  const command = message.data

  if (command.type === 'cancel') {
    cancelledRequests.add(command.requestId)
    return
  }

  if (command.type === 'load') {
    void loadModels().catch(() => undefined)
    return
  }

  const operation = command.type === 'transcribe'
    ? transcribe(command.requestId, command.audio)
    : generate(command.requestId, command.prompt)

  void operation.catch((error: unknown) => {
    if (cancelledRequests.has(command.requestId)) {
      cancelledRequests.delete(command.requestId)
      return
    }
    const message = error instanceof Error ? error.message : 'Inference failed'
    emit({ type: 'error', requestId: command.requestId, message })
  })
}
