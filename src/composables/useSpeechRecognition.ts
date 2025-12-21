import { ref, onUnmounted } from 'vue'
import type { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from '../types'

export function useSpeechRecognition() {
  const isSupported = ref(false)
  const isListening = ref(false)
  const transcript = ref('')
  const interimTranscript = ref('')
  const error = ref<string | null>(null)

  let recognition: SpeechRecognition | null = null

  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition

  if (SpeechRecognitionAPI) {
    isSupported.value = true
    recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      isListening.value = true
      error.value = null
    }

    recognition.onend = () => {
      isListening.value = false
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      isListening.value = false
      switch (event.error) {
        case 'not-allowed':
          error.value = 'Microphone access denied. Please allow microphone permissions.'
          break
        case 'no-speech':
          error.value = 'No speech detected. Please try again.'
          break
        case 'audio-capture':
          error.value = 'No microphone found. Please connect a microphone.'
          break
        case 'network':
          error.value = 'Network error occurred. Please check your connection.'
          break
        default:
          error.value = `Error: ${event.error}`
      }
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      let interim = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }

      if (finalTranscript) {
        transcript.value += finalTranscript
      }
      interimTranscript.value = interim
    }
  }

  function start() {
    if (!recognition) {
      error.value = 'Speech recognition is not supported in this browser.'
      return
    }
    error.value = null
    try {
      recognition.start()
    } catch (e) {
      // Already started, ignore
    }
  }

  function stop() {
    if (recognition && isListening.value) {
      recognition.stop()
    }
  }

  function toggle() {
    if (isListening.value) {
      stop()
    } else {
      start()
    }
  }

  function clear() {
    transcript.value = ''
    interimTranscript.value = ''
    error.value = null
  }

  onUnmounted(() => {
    if (recognition) {
      recognition.stop()
    }
  })

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    toggle,
    clear
  }
}
