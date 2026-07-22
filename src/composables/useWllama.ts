import { ref } from 'vue'
import { useInferenceWorker } from './useInferenceWorker'

export function useWllama() {
  const {
    isLoading,
    llmLoadProgress: loadProgress,
    llmLoaded: isModelLoaded,
    load,
    generateStreaming: generateInWorker
  } = useInferenceWorker()
  const isGenerating = ref(false)
  const error = ref<string | null>(null)
  const response = ref('')

  async function loadModel(repo?: string, file?: string) {
    if (isModelLoaded.value) return

    error.value = null

    try {
      // Model selection remains owned by the worker for this change.
      void repo
      void file
      await load()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load model'
    }
  }

  async function generateStreaming(
    prompt: string,
    onSentence: (sentence: string) => void
  ): Promise<string> {
    if (!isModelLoaded.value) {
      throw new Error('Model not loaded')
    }

    isGenerating.value = true
    response.value = ''
    error.value = null

    try {
      return await generateInWorker(prompt, onSentence, (text) => {
        response.value = text
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to generate response'
      throw e
    } finally {
      isGenerating.value = false
    }
  }

  async function generateResponse(prompt: string, onToken?: (token: string) => void): Promise<string> {
    if (!isModelLoaded.value) {
      throw new Error('Model not loaded')
    }

    isGenerating.value = true
    response.value = ''
    error.value = null

    try {
      return await generateInWorker(prompt, () => {}, (text) => {
        response.value = text
        onToken?.(text)
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to generate response'
      throw e
    } finally {
      isGenerating.value = false
    }
  }

  function clearResponse() {
    response.value = ''
    error.value = null
  }

  return {
    isLoading,
    isGenerating,
    loadProgress,
    error,
    isModelLoaded,
    response,
    loadModel,
    generateResponse,
    generateStreaming,
    clearResponse
  }
}
