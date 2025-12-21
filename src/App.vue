<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useWhisper } from './composables/useWhisper'
import { useSpeechSynthesis } from './composables/useSpeechSynthesis'
import { useWllama } from './composables/useWllama'
import { useAudioVisualizer } from './composables/useAudioVisualizer'

const isProcessing = ref(false)
const isConversationActive = ref(false)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const showAbout = ref(false)

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

const {
  isSupported: isTTSSupported,
  isSpeaking,
  speak,
  queueSentence,
  waitForQueue,
  stop: stopSpeaking
} = useSpeechSynthesis()

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

// Loading state (both Whisper and LLM)
const isModelLoading = computed(() => isWhisperLoading.value || isLLMLoading.value)
const isModelLoaded = computed(() => isWhisperLoaded.value && isLLMLoaded.value)

const {
  frequencyData,
  start: startVisualizer,
  stop: stopVisualizer,
  simulateSpeaking,
  stopSimulation
} = useAudioVisualizer()

// Current state for UI
const currentState = computed(() => {
  if (isWhisperLoading.value || isLLMLoading.value) return 'loading'
  if (isSpeaking.value) return 'speaking'
  if (isGenerating.value) return 'thinking'
  if (isProcessing.value) return 'processing'
  if (isListening.value) return 'listening'
  if (isConversationActive.value) return 'ready'
  return 'idle'
})

const stateColors: Record<string, { primary: string; secondary: string; glow: string }> = {
  'idle': { primary: '#6366f1', secondary: '#818cf8', glow: 'rgba(99, 102, 241, 0.3)' },
  'ready': { primary: '#22d3ee', secondary: '#67e8f9', glow: 'rgba(34, 211, 238, 0.3)' },
  'listening': { primary: '#22c55e', secondary: '#4ade80', glow: 'rgba(34, 197, 94, 0.4)' },
  'processing': { primary: '#f59e0b', secondary: '#fbbf24', glow: 'rgba(245, 158, 11, 0.3)' },
  'thinking': { primary: '#a855f7', secondary: '#c084fc', glow: 'rgba(168, 85, 247, 0.4)' },
  'speaking': { primary: '#ec4899', secondary: '#f472b6', glow: 'rgba(236, 72, 153, 0.4)' },
  'loading': { primary: '#6366f1', secondary: '#818cf8', glow: 'rgba(99, 102, 241, 0.3)' }
}

const stateLabels: Record<string, string> = {
  'idle': 'Standby',
  'ready': 'Awaiting Signal',
  'listening': 'Echo Active',
  'processing': 'Processing',
  'thinking': 'Cortex Active',
  'speaking': 'Ava Active',
  'loading': 'Initializing'
}

// Draw waveform visualization
function drawWaveform() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height
  const data = frequencyData.value
  const barCount = 64
  const barWidth = width / barCount - 2
  const colors = stateColors[currentState.value]

  ctx.clearRect(0, 0, width, height)

  // Create gradient
  const gradient = ctx.createLinearGradient(0, height, 0, 0)
  gradient.addColorStop(0, colors.primary)
  gradient.addColorStop(1, colors.secondary)

  // Draw bars (mirrored for symmetry)
  for (let i = 0; i < barCount; i++) {
    const value = data[i] || 0
    const barHeight = (value / 255) * height * 0.8 + 4

    const x = i * (barWidth + 2) + 1
    const y = (height - barHeight) / 2

    // Glow effect
    ctx.shadowColor = colors.primary
    ctx.shadowBlur = 10

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.roundRect(x, y, barWidth, barHeight, 2)
    ctx.fill()
  }

  ctx.shadowBlur = 0

  requestAnimationFrame(drawWaveform)
}

// Watch for speaking state to simulate audio
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

async function handleToggleConversation() {
  if (isConversationActive.value) {
    isConversationActive.value = false
    stopListening()
    stopSpeaking()
    stopVisualizer()
    stopSimulation()
  } else {
    // Models already loaded on page load
    isConversationActive.value = true
    clearTranscript()
    startListening()
    startVisualizer()
  }
}

onMounted(async () => {
  if (canvasRef.value) {
    // Set canvas size
    canvasRef.value.width = 600
    canvasRef.value.height = 120
    drawWaveform()
  }

  // Auto-load both models in parallel
  await Promise.all([loadWhisperModel(), loadLLMModel()])

  if (isTTSSupported.value) {
    await speak("Hi, I'm Ava, your AI assistant. Press the button below to start talking to me.")
  }
})
</script>

<template>
  <div class="app">
    <!-- Background effects -->
    <div class="bg-grid"></div>
    <div class="bg-glow" :style="{ background: `radial-gradient(ellipse at center, ${stateColors[currentState].glow} 0%, transparent 70%)` }"></div>

    <main class="container">
      <!-- Header -->
      <header class="header">
        <div class="status-indicator" :class="currentState">
          <span class="status-dot"></span>
          <span class="status-text">{{ stateLabels[currentState] }}</span>
        </div>
      </header>

      <!-- Errors -->
      <div v-if="speechError || llmError" class="error-banner">
        {{ speechError || llmError }}
      </div>

      <!-- Loading Progress -->
      <div v-if="isWhisperLoading" class="loading-container">
        <div class="loading-label">ECHO (Whisper)</div>
        <div class="loading-bar">
          <div class="loading-fill" :style="{ width: whisperLoadProgress + '%' }"></div>
        </div>
        <span class="loading-text">{{ whisperLoadProgress }}%</span>
      </div>
      <div v-if="isLLMLoading" class="loading-container">
        <div class="loading-label">CORTEX (Qwen 0.5B)</div>
        <div class="loading-bar">
          <div class="loading-fill" :style="{ width: llmLoadProgress + '%' }"></div>
        </div>
        <span class="loading-text">{{ llmLoadProgress }}%</span>
      </div>

      <!-- Transcript Panel (ECHO) -->
      <div class="panel transcript-panel">
        <div class="panel-content">
          <span v-if="transcript" class="text-primary">{{ transcript }}</span>
          <span v-else class="text-placeholder">
            {{ isListening ? '◐ Listening...' : '○ Microphone inactive' }}
          </span>
        </div>
      </div>

      <!-- Waveform Visualizer (SPECTRA) - Center -->
      <div class="visualizer-section">
        <div class="visualizer-container">
          <canvas ref="canvasRef" class="waveform-canvas"></canvas>
          <div class="visualizer-overlay"></div>
        </div>
      </div>

      <!-- Response Panel (CORTEX) -->
      <div class="panel response-panel" :class="{ active: isSpeaking }">
        <div class="panel-header">
          <span v-if="isGenerating" class="thinking-indicator">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          </span>
        </div>
        <div class="panel-content">
          <span v-if="response">{{ response }}</span>
          <span v-else-if="isGenerating" class="text-thinking">Synapses firing...</span>
          <span v-else class="text-placeholder">○ Awaiting input...</span>
        </div>
      </div>

      <!-- Browser Support Warning -->
      <p v-if="!isSupported" class="warning">
        ⚠ Whisper requires SharedArrayBuffer. Use Chrome or Edge with cross-origin isolation.
      </p>
    </main>

    <!-- Fixed Bottom Controls -->
    <div class="bottom-controls">
      <button
        class="main-button"
        :class="{ active: isConversationActive, loading: isModelLoading }"
        :disabled="!isSupported || isModelLoading"
        @click="handleToggleConversation"
      >
        <span class="button-glow"></span>
        <span class="button-icon">
          <span v-if="isModelLoading" class="spinner"></span>
          <span v-else-if="isConversationActive">■</span>
          <span v-else>▶</span>
        </span>
      </button>

    </div>

    <!-- About Button -->
    <button class="about-button" @click="showAbout = true">?</button>

    <!-- About Popup -->
    <div v-if="showAbout" class="about-overlay" @click="showAbout = false">
      <div class="about-popup" @click.stop>
        <button class="about-close" @click="showAbout = false">×</button>
        <h3>Ava</h3>
        <p class="about-version">v1.0.0</p>
        <p class="about-desc">Meet Ava, your private AI assistant running entirely in your browser. No servers, no data leaves your device.</p>
        <div class="about-tech">
          <span>Whisper</span>
          <span>Qwen 0.5B</span>
          <span>WebAssembly</span>
        </div>
        <div class="about-developer">
          <p>Developed by</p>
          <p class="developer-name">Muthukrishnan</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary: #6366f1;
  --secondary: #22d3ee;
  --accent: #ec4899;
  --bg-dark: #0a0a0f;
  --bg-card: rgba(15, 15, 25, 0.8);
  --border: rgba(99, 102, 241, 0.2);
  --text: #e2e8f0;
  --text-dim: #64748b;
}

body {
  font-family: 'JetBrains Mono', monospace;
  background: var(--bg-dark);
  color: var(--text);
  min-height: 100vh;
  overflow-x: hidden;
}

.app {
  min-height: 100vh;
  position: relative;
}

/* Background Effects */
.bg-grid {
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(99, 102, 241, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
  background-size: 50px 50px;
  pointer-events: none;
}

.bg-glow {
  position: fixed;
  inset: 0;
  transition: background 0.5s ease;
  pointer-events: none;
}

/* Container */
.container {
  max-width: 700px;
  margin: 0 auto;
  padding: 2rem;
  padding-bottom: 120px; /* Space for fixed bottom controls */
  position: relative;
  z-index: 1;
}

/* Fixed Bottom Controls */
.bottom-controls {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 1rem;
  justify-content: center;
  align-items: center;
  padding: 1.5rem 2rem;
  background: linear-gradient(to top, var(--bg-dark) 0%, var(--bg-dark) 60%, transparent 100%);
  z-index: 100;
}

/* Header */
.header {
  text-align: center;
  margin-bottom: 2rem;
}

.title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 2.5rem;
  font-weight: 900;
  letter-spacing: 0.2em;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, var(--text) 0%, var(--secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.title .accent {
  background: linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%);
  -webkit-background-clip: text;
  background-clip: text;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary);
  animation: pulse-dot 2s ease-in-out infinite;
}

.status-indicator.listening .status-dot { background: #22c55e; }
.status-indicator.speaking .status-dot { background: #ec4899; }
.status-indicator.thinking .status-dot { background: #a855f7; }
.status-indicator.processing .status-dot { background: #f59e0b; }

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

/* Visualizer */
.visualizer-section {
  margin: 2rem 0;
}

.visualizer-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  color: var(--text-dim);
  margin-bottom: 0.5rem;
  text-align: center;
}

.visualizer-container {
  position: relative;
  padding: 1rem;
  overflow: hidden;
}

.waveform-canvas {
  width: 100%;
  height: 120px;
  display: block;
}

.visualizer-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* Panels */
.panel {
  margin-bottom: 1rem;
  overflow: hidden;
  transition: border-color 0.3s, box-shadow 0.3s;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.panel-icon {
  color: var(--secondary);
}

.panel-content {
  padding: 1rem;
  min-height: 80px;
  font-size: 1.1rem;
  line-height: 1.6;
  text-align: center;
}

.text-primary { color: var(--text); }
.text-interim { color: var(--text-dim); font-style: italic; }
.text-placeholder { color: var(--text-dim); }
.text-thinking { color: var(--primary); }

.thinking-indicator {
  display: inline-flex;
  gap: 4px;
}

.thinking-indicator .dot {
  width: 6px;
  height: 6px;
  background: var(--primary);
  border-radius: 50%;
  animation: thinking 1.4s ease-in-out infinite;
}

.thinking-indicator .dot:nth-child(2) { animation-delay: 0.2s; }
.thinking-indicator .dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes thinking {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1); }
}

.main-button {
  position: relative;
  width: 72px;
  height: 72px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.5rem;
  color: var(--text);
  background: linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.main-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 40px rgba(99, 102, 241, 0.4);
}

.main-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.main-button.active {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
}

.main-button.active:hover:not(:disabled) {
  box-shadow: 0 10px 40px rgba(220, 38, 38, 0.4);
}

.button-glow {
  position: absolute;
  inset: -2px;
  background: linear-gradient(135deg, var(--secondary), var(--accent));
  border-radius: 50%;
  opacity: 0;
  z-index: -1;
  transition: opacity 0.3s;
}

.main-button:hover .button-glow {
  opacity: 0.5;
  animation: glow-pulse 2s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

.button-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Loading */
.loading-container {
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.loading-label {
  font-size: 0.75rem;
  color: var(--text-dim);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
  min-width: 140px;
}

.loading-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-card);
  border-radius: 3px;
  overflow: hidden;
}

.loading-bar.tts .loading-fill {
  background: linear-gradient(90deg, #14b8a6, #2dd4bf);
}

.loading-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--secondary));
  transition: width 0.3s ease;
}

.loading-text {
  font-size: 0.8rem;
  color: var(--text-dim);
  letter-spacing: 0.05em;
  min-width: 40px;
  text-align: right;
}

.gpu-indicator {
  text-align: center;
  font-size: 0.75rem;
  padding: 0.5rem 1rem;
  margin-bottom: 1rem;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.gpu-indicator.webgpu {
  background: rgba(34, 197, 94, 0.1);
  color: #4ade80;
  border-color: rgba(34, 197, 94, 0.2);
}

/* Error & Warning */
.error-banner {
  padding: 1rem;
  margin-bottom: 1rem;
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 0.9rem;
}

.warning {
  text-align: center;
  padding: 1rem;
  color: #fbbf24;
  font-size: 0.9rem;
}

/* Responsive */
@media (max-width: 640px) {
  .container {
    padding: 1rem;
    padding-bottom: 140px;
  }

  .title {
    font-size: 1.8rem;
  }

  .bottom-controls {
    padding: 1rem;
  }
}

/* About Button */
.about-button {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-family: 'JetBrains Mono', monospace;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 50;
}

.about-button:hover {
  color: var(--text);
  border-color: var(--primary);
}

/* About Popup */
.about-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  backdrop-filter: blur(4px);
}

.about-popup {
  background: var(--bg-dark);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 2rem;
  max-width: 320px;
  text-align: center;
  position: relative;
}

.about-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-dim);
  font-size: 1.25rem;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s;
}

.about-close:hover {
  color: var(--text);
  background: var(--bg-card);
}

.about-popup h3 {
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  margin-bottom: 0.25rem;
  background: linear-gradient(135deg, var(--text) 0%, var(--secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.about-version {
  font-size: 0.75rem;
  color: var(--text-dim);
  margin-bottom: 1rem;
}

.about-desc {
  font-size: 0.85rem;
  color: var(--text-dim);
  line-height: 1.5;
  margin-bottom: 1rem;
}

.about-tech {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.about-tech span {
  font-size: 0.7rem;
  padding: 0.25rem 0.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-dim);
}

.about-developer {
  border-top: 1px solid var(--border);
  padding-top: 1rem;
}

.about-developer p {
  font-size: 0.75rem;
  color: var(--text-dim);
}

.developer-name {
  font-size: 1rem !important;
  font-weight: 600;
  color: var(--primary) !important;
  margin-top: 0.25rem;
}
</style>
