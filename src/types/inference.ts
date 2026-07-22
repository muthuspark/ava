export type InferenceBackend = 'webgpu' | 'wasm'
export type InferenceModel = 'whisper' | 'llm'

export type InferenceCommand =
  | { type: 'load' }
  | { type: 'transcribe'; requestId: number; audio: Float32Array }
  | { type: 'generate'; requestId: number; prompt: string }
  | { type: 'cancel'; requestId: number }

export type InferenceEvent =
  | { type: 'progress'; model: InferenceModel; progress: number }
  | { type: 'backend'; model: InferenceModel; backend: InferenceBackend }
  | { type: 'ready'; backends: Record<InferenceModel, InferenceBackend> }
  | { type: 'transcription'; requestId: number; text: string }
  | { type: 'generation-update'; requestId: number; text: string }
  | { type: 'sentence'; requestId: number; text: string }
  | { type: 'complete'; requestId: number; text: string }
  | { type: 'error'; model?: InferenceModel; requestId?: number; message: string; fatal?: boolean }
