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

  // Get a valid voice, ensuring it exists in the current voices list
  function getValidVoice(): SpeechSynthesisVoice | null {
    if (!synth) return null

    const availableVoices = synth.getVoices()
    if (availableVoices.length === 0) return null

    // Check if selected voice is still available
    if (selectedVoice.value) {
      const found = availableVoices.find(v => v.name === selectedVoice.value!.name)
      if (found) return found
    }

    // Fall back to default voice selection
    return availableVoices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('google us english')) ||
      availableVoices.find(v => v.lang === 'en-GB' && v.name.toLowerCase().includes('female')) ||
      availableVoices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('female')) ||
      availableVoices.find(v => v.lang === 'en-AU' && v.name.toLowerCase().includes('female')) ||
      availableVoices.find(v => v.lang === 'en-AU') ||
      availableVoices.find(v => v.lang.startsWith('en')) ||
      availableVoices[0]
  }

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
            availableVoices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('Google US English')) ||
            availableVoices.find(v => v.lang === 'en-GB' && v.name.toLowerCase().includes('female')) ||
            availableVoices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('female')) ||
            availableVoices.find(v => v.lang === 'en-AU' && v.name.toLowerCase().includes('female')) ||
            availableVoices.find(v => v.lang === 'en-AU') ||
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

    error.value = null  // Clear error immediately when queueing new speech
    pendingCount.value++
    const utterance = new SpeechSynthesisUtterance(text.trim())

    const voice = getValidVoice()
    if (voice) {
      utterance.voice = voice
    }

    utterance.rate = 1.15  // Slightly faster for streaming
    utterance.pitch = 1

    utterance.onstart = () => {
      isSpeaking.value = true
      error.value = null  // Clear any previous errors on successful start
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
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
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

      // Cancel any ongoing speech and reset queue
      synth.cancel()
      pendingCount.value = 1  // This utterance counts as pending
      error.value = null  // Clear error immediately to prevent stale errors from canceled utterances

      const utterance = new SpeechSynthesisUtterance(text)

      const voice = getValidVoice()
      if (voice) {
        utterance.voice = voice
      }

      utterance.rate = 1.1
      utterance.pitch = 1

      utterance.onstart = () => {
        isSpeaking.value = true
        error.value = null  // Clear any previous errors on successful start
      }

      utterance.onend = () => {
        pendingCount.value--
        isSpeaking.value = false
        resolve()
      }

      utterance.onerror = (event) => {
        pendingCount.value--
        isSpeaking.value = false
        if (event.error !== 'canceled' && event.error !== 'interrupted') {
          if (event.error === 'not-allowed') {
            error.value = 'Audio playback not allowed. Please allow sound permission in browser/system settings.'
            resolve()
            return
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
