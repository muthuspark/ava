import { ref, computed, watch } from 'vue'
import { useWhisper } from './useWhisper'
import { useSpeechSynthesis } from './useSpeechSynthesis'
import { useWllama } from './useWllama'
import { useAudioVisualizer } from './useAudioVisualizer'

export type ConversationState = 'idle' | 'ready' | 'listening' | 'processing' | 'thinking' | 'speaking' | 'loading'

export const stateColors: Record<ConversationState, { primary: string; secondary: string; glow: string }> = {
  'idle': { primary: '#6366f1', secondary: '#818cf8', glow: 'rgba(99, 102, 241, 0.3)' },
  'ready': { primary: '#22d3ee', secondary: '#67e8f9', glow: 'rgba(34, 211, 238, 0.3)' },
  'listening': { primary: '#22c55e', secondary: '#4ade80', glow: 'rgba(34, 197, 94, 0.4)' },
  'processing': { primary: '#f59e0b', secondary: '#fbbf24', glow: 'rgba(245, 158, 11, 0.3)' },
  'thinking': { primary: '#a855f7', secondary: '#c084fc', glow: 'rgba(168, 85, 247, 0.4)' },
  'speaking': { primary: '#ec4899', secondary: '#f472b6', glow: 'rgba(236, 72, 153, 0.4)' },
  'loading': { primary: '#6366f1', secondary: '#818cf8', glow: 'rgba(99, 102, 241, 0.3)' }
}

export const stateLabels: Record<ConversationState, string> = {
  'idle': 'Standby',
  'ready': 'Awaiting Signal',
  'listening': 'Echo Active',
  'processing': 'Processing',
  'thinking': 'Cortex Active',
  'speaking': 'Ava Active',
  'loading': 'Initializing'
}

export function useConversation() {
  const isProcessing = ref(false)
  const isConversationActive = ref(false)

  // Whisper (Speech-to-Text)
  const {
    isSupported,
    isLoading: isWhisperLoading,
    isModelLoaded: isWhisperLoaded,
    isListening,
    transcript,
    loadProgress: whisperLoadProgress,
    error: speechError,
    loadModel: loadWhisperModel,
    start: startListening,
    stop: stopListening,
    clear: clearTranscript
  } = useWhisper()

  // TTS (Text-to-Speech)
  const {
    isSupported: isTTSSupported,
    isSpeaking,
    error: ttsError,
    speak,
    queueSentence,
    waitForQueue,
    stop: stopSpeaking
  } = useSpeechSynthesis()

  // LLM
  const {
    isLoading: isLLMLoading,
    isGenerating,
    loadProgress: llmLoadProgress,
    error: llmError,
    isModelLoaded: isLLMLoaded,
    response,
    loadModel: loadLLMModel,
    generateStreaming
  } = useWllama()

  // Audio Visualizer
  const {
    frequencyData,
    start: startVisualizer,
    stop: stopVisualizer,
    simulateSpeaking,
    stopSimulation
  } = useAudioVisualizer()

  // Computed states
  const isModelLoading = computed(() => isWhisperLoading.value || isLLMLoading.value)
  const isModelLoaded = computed(() => isWhisperLoaded.value && isLLMLoaded.value)

  const currentState = computed<ConversationState>(() => {
    if (isWhisperLoading.value || isLLMLoading.value) return 'loading'
    if (isSpeaking.value) return 'speaking'
    if (isGenerating.value) return 'thinking'
    if (isProcessing.value) return 'processing'
    if (isListening.value) return 'listening'
    if (isConversationActive.value) return 'ready'
    return 'idle'
  })

  // Watch for speaking state to simulate audio visualization
  watch(isSpeaking, (speaking) => {
    if (speaking) {
      simulateSpeaking()
    } else {
      stopSimulation()
    }
  })

  // Watch for new transcriptions from Whisper
  watch(transcript, async (text) => {
    if (!text || !isModelLoaded.value || isGenerating.value || isSpeaking.value || !isConversationActive.value) {
      return
    }

    isProcessing.value = true
    stopListening()
    stopVisualizer()

    // Stream LLM response and queue sentences for TTS
    if (isTTSSupported.value) {
      await generateStreaming(text, (sentence: string) => {
        queueSentence(sentence)
      })
      await waitForQueue()
    } else {
      await generateStreaming(text, () => {})
    }

    isProcessing.value = false

    if (isConversationActive.value) {
      clearTranscript()
      startListening()
      startVisualizer()
    }
  })

  async function toggleConversation() {
    if (isConversationActive.value) {
      isConversationActive.value = false
      stopListening()
      stopSpeaking()
      stopVisualizer()
      stopSimulation()
    } else {
      isConversationActive.value = true
      clearTranscript()
      startListening()
      startVisualizer()
    }
  }

  async function initialize() {
    // Request microphone permission early
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Stop the stream immediately, we just needed permission
      stream.getTracks().forEach(track => track.stop())
    } catch (e) {
      const err = e as Error
      if (err.name === 'NotAllowedError') {
        speechError.value = 'Microphone access denied. Please allow microphone permission and reload the page.'
      }
    }

    // Load both models in parallel
    await Promise.all([loadWhisperModel(), loadLLMModel()])

    // Introduce Ava (also triggers TTS/audio permission)
    if (isTTSSupported.value) {
      await speak("Hi, I'm Ava, your AI assistant. Press the button below to start talking to me.")
    }
  }

  return {
    // State
    isSupported,
    isModelLoading,
    isModelLoaded,
    isConversationActive,
    currentState,

    // Whisper
    isWhisperLoading,
    whisperLoadProgress,
    isListening,
    transcript,
    speechError,

    // LLM
    isLLMLoading,
    llmLoadProgress,
    isGenerating,
    response,
    llmError,

    // TTS
    isSpeaking,
    ttsError,

    // Visualizer
    frequencyData,
    startVisualizer,
    stopVisualizer,

    // Actions
    toggleConversation,
    initialize
  }
}
