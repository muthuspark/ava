import { ref, computed } from 'vue'

// Keep last N samples for averaging
const MAX_SAMPLES = 10

export function useStats() {
  const sttTimes = ref<number[]>([])
  const llmTimes = ref<number[]>([])
  const ttsTimes = ref<number[]>([])

  const avgSTT = computed(() => {
    if (sttTimes.value.length === 0) return 0
    const sum = sttTimes.value.reduce((a, b) => a + b, 0)
    return Math.round(sum / sttTimes.value.length)
  })

  const avgLLM = computed(() => {
    if (llmTimes.value.length === 0) return 0
    const sum = llmTimes.value.reduce((a, b) => a + b, 0)
    return Math.round(sum / llmTimes.value.length)
  })

  const avgTTS = computed(() => {
    if (ttsTimes.value.length === 0) return 0
    const sum = ttsTimes.value.reduce((a, b) => a + b, 0)
    return Math.round(sum / ttsTimes.value.length)
  })

  function addSTTTime(ms: number) {
    sttTimes.value.push(ms)
    if (sttTimes.value.length > MAX_SAMPLES) {
      sttTimes.value.shift()
    }
  }

  function addLLMTime(ms: number) {
    llmTimes.value.push(ms)
    if (llmTimes.value.length > MAX_SAMPLES) {
      llmTimes.value.shift()
    }
  }

  function addTTSTime(ms: number) {
    ttsTimes.value.push(ms)
    if (ttsTimes.value.length > MAX_SAMPLES) {
      ttsTimes.value.shift()
    }
  }

  function reset() {
    sttTimes.value = []
    llmTimes.value = []
    ttsTimes.value = []
  }

  return {
    avgSTT,
    avgLLM,
    avgTTS,
    addSTTTime,
    addLLMTime,
    addTTSTime,
    reset
  }
}

// Singleton instance for shared state
let statsInstance: ReturnType<typeof useStats> | null = null

export function getStats() {
  if (!statsInstance) {
    statsInstance = useStats()
  }
  return statsInstance
}
