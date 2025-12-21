import { ref, onMounted } from 'vue'

export function useSpeechSynthesis() {
  const isSupported = ref(false)
  const isSpeaking = ref(false)
  const voices = ref<SpeechSynthesisVoice[]>([])
  const selectedVoice = ref<SpeechSynthesisVoice | null>(null)
  const pendingCount = ref(0)
  const error = ref<string | null>(null)

  let synth: SpeechSynthesis | null = null
  let onQueueEmpty: (() => void) | null = null

  onMounted(() => {
    if ('speechSynthesis' in window) {
      isSupported.value = true
      synth = window.speechSynthesis

      // Load voices (they load asynchronously in some browsers)
      const loadVoices = () => {
        const availableVoices = synth!.getVoices()
        voices.value = availableVoices

        // Default to UK English Female voice
        if (!selectedVoice.value && availableVoices.length > 0) {
          selectedVoice.value =
            availableVoices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('female')) ||
            availableVoices.find(v => v.lang === 'en-US') ||
            availableVoices.find(v => v.lang.startsWith('en')) ||
            availableVoices[0]
        }
      }

      loadVoices()
      synth.onvoiceschanged = loadVoices
    }
  })

  // Queue a sentence for speaking (doesn't cancel existing speech)
  function queueSentence(text: string): void {
    if (!synth || !isSupported.value || !text.trim()) return

    pendingCount.value++
    const utterance = new SpeechSynthesisUtterance(text.trim())

    if (selectedVoice.value) {
      utterance.voice = selectedVoice.value
    }

    utterance.rate = 1.15  // Slightly faster for streaming
    utterance.pitch = 1

    utterance.onstart = () => {
      isSpeaking.value = true
    }

    utterance.onend = () => {
      pendingCount.value--
      if (pendingCount.value === 0) {
        isSpeaking.value = false
        if (onQueueEmpty) {
          onQueueEmpty()
          onQueueEmpty = null
        }
      }
    }

    utterance.onerror = (event) => {
      pendingCount.value--
      if (pendingCount.value === 0) {
        isSpeaking.value = false
      }
      if (event.error !== 'canceled') {
        if (event.error === 'not-allowed') {
          error.value = 'Audio playback not allowed. Please allow sound permission in browser/system settings.'
        } else {
          error.value = `Speech error: ${event.error}`
        }
      }
    }

    synth.speak(utterance)
  }

  // Wait for all queued speech to finish
  function waitForQueue(): Promise<void> {
    return new Promise((resolve) => {
      if (pendingCount.value === 0 && !synth?.speaking) {
        resolve()
        return
      }
      onQueueEmpty = resolve
    })
  }

  // Original speak function (cancels existing and waits)
  function speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!synth || !isSupported.value) {
        reject(new Error('Speech synthesis not supported'))
        return
      }

      // Cancel any ongoing speech
      synth.cancel()
      pendingCount.value = 0

      const utterance = new SpeechSynthesisUtterance(text)

      if (selectedVoice.value) {
        utterance.voice = selectedVoice.value
      }

      utterance.rate = 1.1
      utterance.pitch = 1

      utterance.onstart = () => {
        isSpeaking.value = true
      }

      utterance.onend = () => {
        isSpeaking.value = false
        resolve()
      }

      utterance.onerror = (event) => {
        isSpeaking.value = false
        if (event.error !== 'canceled') {
          if (event.error === 'not-allowed') {
            error.value = 'Audio playback not allowed. Please allow sound permission in browser/system settings.'
          } else {
            error.value = `Speech error: ${event.error}`
          }
          reject(new Error(error.value))
        } else {
          resolve()
        }
      }

      synth.speak(utterance)
    })
  }

  function stop() {
    if (synth) {
      synth.cancel()
      pendingCount.value = 0
      isSpeaking.value = false
      onQueueEmpty = null
    }
  }

  function setVoice(voice: SpeechSynthesisVoice) {
    selectedVoice.value = voice
  }

  return {
    isSupported,
    isSpeaking,
    voices,
    selectedVoice,
    pendingCount,
    error,
    speak,
    queueSentence,
    waitForQueue,
    stop,
    setVoice
  }
}
