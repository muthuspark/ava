import { ref, onUnmounted } from 'vue'
import { WhisperTranscriber } from 'whisper-web-transcriber'

export function useWhisper() {
  const isSupported = ref(true)
  const isLoading = ref(false)
  const isModelLoaded = ref(false)
  const isListening = ref(false)
  const transcript = ref('')
  const loadProgress = ref(0)
  const error = ref<string | null>(null)

  let transcriber: WhisperTranscriber | null = null

  async function loadModel() {
    if (isModelLoaded.value || isLoading.value) return

    isLoading.value = true
    loadProgress.value = 0
    error.value = null

    try {
      transcriber = new WhisperTranscriber({
        modelSize: 'tiny-en-q5_1', // Smallest and fastest (~31MB)
        onTranscription: (text: string) => {
          if (text.trim()) {
            transcript.value = text.trim()
          }
        },
        onProgress: (progress: number) => {
          loadProgress.value = Math.round(progress)
        },
        onStatus: (status: string) => {
          console.log('Whisper status:', status)
        },
        audioIntervalMs: 2000 // Process audio every 2 seconds for faster response
      })

      await transcriber.loadModel()
      isModelLoaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load Whisper model'
      isSupported.value = false
    } finally {
      isLoading.value = false
    }
  }

  async function start() {
    if (!transcriber || !isModelLoaded.value) {
      error.value = 'Whisper model not loaded'
      return
    }

    error.value = null
    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true })
      await transcriber.startRecording()
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
    if (transcriber && isListening.value) {
      transcriber.stopRecording()
      isListening.value = false
    }
  }

  function clear() {
    transcript.value = ''
    error.value = null
  }

  onUnmounted(() => {
    if (transcriber) {
      transcriber.destroy()
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
