import { ref, onUnmounted } from 'vue'
import { pipeline } from '@huggingface/transformers'
import { getStats } from './useStats'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Transcriber = (audio: Float32Array) => Promise<{ text: string }>

type VADInstance = { start: () => void; pause: () => void }

// Load VAD bundle script dynamically
async function loadVADBundle(): Promise<typeof window.vad> {
  if (window.vad) return window.vad

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/vad-bundle.min.js'
    script.onload = () => resolve(window.vad)
    script.onerror = () => reject(new Error('Failed to load VAD bundle'))
    document.head.appendChild(script)
  })
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vad: any
  }
}

export function useWhisper() {
  const isSupported = ref(true)
  const isLoading = ref(false)
  const isModelLoaded = ref(false)
  const isListening = ref(false)
  const transcript = ref('')
  const loadProgress = ref(0)
  const error = ref<string | null>(null)

  let vad: VADInstance | null = null
  let transcriber: Transcriber | null = null
  let sttStartTime = 0

  async function loadModel() {
    if (isModelLoaded.value || isLoading.value) return

    isLoading.value = true
    loadProgress.value = 0
    error.value = null

    try {
      // Load Whisper model via Transformers.js
      loadProgress.value = 10

      const pipelineInstance = await (pipeline as Function)(
        'automatic-speech-recognition',
        'onnx-community/whisper-tiny.en',
        {
          dtype: 'q4',
          progress_callback: (progressInfo: { progress?: number }) => {
            if (progressInfo.progress) {
              loadProgress.value = Math.round(10 + progressInfo.progress * 0.5)
            }
          }
        }
      )
      transcriber = pipelineInstance as Transcriber

      loadProgress.value = 60

      // Load VAD bundle (avoids CommonJS/ESM issues)
      const vadModule = await loadVADBundle()

      // Initialize VAD (Voice Activity Detection)
      vad = await vadModule.MicVAD.new({
        model: 'v5',
        positiveSpeechThreshold: 0.5,
        negativeSpeechThreshold: 0.35,
        redemptionMs: 800,   // Wait time after speech ends before triggering
        minSpeechMs: 200,
        preSpeechPadMs: 300,

        onSpeechStart: () => {
          sttStartTime = performance.now()
        },

        onSpeechEnd: async (audio: Float32Array) => {
          if (!transcriber) return

          try {
            const result = await transcriber(audio)

            if (sttStartTime > 0) {
              const sttTime = performance.now() - sttStartTime
              getStats().addSTTTime(sttTime)
            }

            const text = result?.text || ''
            if (text.trim()) {
              transcript.value = text.trim()
            }
          } catch {
            error.value = 'Transcription failed'
          }
        }
      })

      // Pause VAD immediately - only start when user clicks
      if (vad) vad.pause()

      loadProgress.value = 100
      isModelLoaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load speech models'
      isSupported.value = false
    } finally {
      isLoading.value = false
    }
  }

  async function start() {
    if (!vad || !isModelLoaded.value) {
      error.value = 'Speech models not loaded'
      return
    }

    error.value = null
    try {
      vad.start()
      isListening.value = true
    } catch (e) {
      const err = e as Error
      if (err.name === 'NotAllowedError' || err.message?.includes('not-allowed')) {
        error.value = 'Microphone access denied. Please allow microphone permission and reload the page.'
      } else if (err.name === 'NotFoundError') {
        error.value = 'No microphone found. Please connect a microphone.'
      } else {
        error.value = err.message || 'Failed to start recording'
      }
      isListening.value = false
    }
  }

  function stop() {
    if (vad && isListening.value) {
      vad.pause()
      isListening.value = false
    }
  }

  function clear() {
    transcript.value = ''
    error.value = null
  }

  onUnmounted(() => {
    if (vad) {
      vad.pause()
    }
  })

  return {
    isSupported,
    isLoading,
    isModelLoaded,
    isListening,
    transcript,
    loadProgress,
    error,
    loadModel,
    start,
    stop,
    clear
  }
}
