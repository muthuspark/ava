import { ref, onUnmounted } from 'vue'
import { getStats } from './useStats'
import { useInferenceWorker } from './useInferenceWorker'

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
  const {
    isLoading,
    whisperLoadProgress: loadProgress,
    whisperLoaded: isModelLoaded,
    load,
    transcribe
  } = useInferenceWorker()
  const isListening = ref(false)
  const transcript = ref('')
  const error = ref<string | null>(null)

  let vad: VADInstance | null = null
  let sttStartTime = 0

  async function loadModel() {
    if (isModelLoaded.value) return

    error.value = null

    if (typeof SharedArrayBuffer === 'undefined' || !window.crossOriginIsolated) {
      error.value = 'Whisper requires SharedArrayBuffer. Use Chrome or Edge with cross-origin isolation.'
      isSupported.value = false
      return
    }

    try {
      // Load VAD bundle (avoids CommonJS/ESM issues)
      const inferenceLoad = load()
      const vadModule = await loadVADBundle()
      await inferenceLoad

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
          try {
            const text = await transcribe(audio)

            if (sttStartTime > 0) {
              const sttTime = performance.now() - sttStartTime
              getStats().addSTTTime(sttTime)
            }

            if (text.trim()) {
              transcript.value = text.trim()
            }
          } catch (e) {
            if (!(e instanceof Error && e.message === 'Inference cancelled')) {
              error.value = 'Transcription failed'
            }
          }
        }
      })

      // Pause VAD immediately - only start when user clicks
      if (vad) vad.pause()

    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load speech models'
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
