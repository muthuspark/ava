import { ref, shallowRef } from 'vue'
import { Wllama } from '@wllama/wllama'

const CONFIG_PATHS = {
  'single-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/esm/single-thread/wllama.wasm',
  'multi-thread/wllama.wasm': 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.7/esm/multi-thread/wllama.wasm',
}

// Gemma 3 270M - Ultra fast, ~180MB
const DEFAULT_MODEL = {
  repo: 'unsloth/gemma-3-270m-it-GGUF',
  file: 'gemma-3-270m-it-Q4_K_M.gguf'
}

// Sentence boundary pattern - matches . ! ? , followed by space or end
const SENTENCE_BOUNDARY = /[.!?,](?:\s|$)/

export function useWllama() {
  const wllama = shallowRef<Wllama | null>(null)
  const isLoading = ref(false)
  const isGenerating = ref(false)
  const loadProgress = ref(0)
  const error = ref<string | null>(null)
  const isModelLoaded = ref(false)
  const response = ref('')

  async function loadModel(repo?: string, file?: string) {
    if (isModelLoaded.value) return

    isLoading.value = true
    loadProgress.value = 0
    error.value = null

    try {
      wllama.value = new Wllama(CONFIG_PATHS)

      await wllama.value.loadModelFromHF(
        repo || DEFAULT_MODEL.repo,
        file || DEFAULT_MODEL.file,
        {
          progressCallback: ({ loaded, total }) => {
            loadProgress.value = Math.round((loaded / total) * 100)
          }
        }
      )

      isModelLoaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load model'
    } finally {
      isLoading.value = false
    }
  }

  // Streaming generation with sentence callbacks
  async function generateStreaming(
    prompt: string,
    onSentence: (sentence: string) => void
  ): Promise<string> {
    if (!wllama.value || !isModelLoaded.value) {
      throw new Error('Model not loaded')
    }

    isGenerating.value = true
    response.value = ''
    error.value = null

    let buffer = ''
    let spokenText = ''

    try {
      const formattedPrompt = formatChatPrompt(prompt)

      const result = await wllama.value.createCompletion(formattedPrompt, {
        nPredict: 64,
        sampling: {
          temp: 0.7,
          top_k: 40,
          top_p: 0.9,
        },
        onNewToken: (_token, _piece, currentText) => {
          // Strip any trailing special tokens from display (Gemma uses <end_of_turn>)
          const cleanText = currentText.replace(/<end_of_turn>.*$/s, '').trim()
          response.value = cleanText

          // Get new content since last check
          const newContent = cleanText.slice(spokenText.length)
          buffer += newContent
          spokenText = cleanText

          // Check for sentence boundaries and emit complete sentences
          let match
          while ((match = SENTENCE_BOUNDARY.exec(buffer)) !== null) {
            const sentenceEnd = match.index + match[0].length
            const sentence = buffer.slice(0, sentenceEnd).trim()

            if (sentence) {
              onSentence(sentence)
            }

            buffer = buffer.slice(sentenceEnd)
          }
        }
      })

      // Clean final result (Gemma uses <end_of_turn>)
      const cleanResult = result.replace(/<end_of_turn>.*$/s, '').trim()
      response.value = cleanResult

      // Emit any remaining text in buffer
      if (buffer.trim()) {
        onSentence(buffer.trim())
      }

      return cleanResult
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to generate response'
      throw e
    } finally {
      isGenerating.value = false
    }
  }

  // Original non-streaming version
  async function generateResponse(prompt: string, onToken?: (token: string) => void): Promise<string> {
    if (!wllama.value || !isModelLoaded.value) {
      throw new Error('Model not loaded')
    }

    isGenerating.value = true
    response.value = ''
    error.value = null

    try {
      const formattedPrompt = formatChatPrompt(prompt)

      const result = await wllama.value.createCompletion(formattedPrompt, {
        nPredict: 64,
        sampling: {
          temp: 0.7,
          top_k: 40,
          top_p: 0.9,
        },
        onNewToken: (_token, _piece, currentText) => {
          const cleanText = currentText.replace(/<end_of_turn>.*$/s, '').trim()
          response.value = cleanText
          if (onToken) {
            onToken(cleanText)
          }
        }
      })

      const cleanResult = result.replace(/<end_of_turn>.*$/s, '').trim()
      response.value = cleanResult
      return cleanResult
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to generate response'
      throw e
    } finally {
      isGenerating.value = false
    }
  }

  function formatChatPrompt(userMessage: string): string {
    // Gemma 3 chat template
    return `<start_of_turn>user
You are Ava. Reply in 1-2 short sentences only.

${userMessage}<end_of_turn>
<start_of_turn>model
`
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
