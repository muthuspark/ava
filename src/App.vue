<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useConversation, stateColors, stateLabels } from './composables/useConversation'
import WaveformVisualizer from './components/WaveformVisualizer.vue'
import AboutPopup from './components/AboutPopup.vue'
import './styles/main.css'

const showAbout = ref(false)

const {
  isSupported,
  isModelLoading,
  isConversationActive,
  currentState,
  isWhisperLoading,
  whisperLoadProgress,
  isListening,
  transcript,
  speechError,
  isLLMLoading,
  llmLoadProgress,
  isGenerating,
  response,
  llmError,
  isSpeaking,
  ttsError,
  frequencyData,
  avgSTT,
  avgLLM,
  avgTTS,
  toggleConversation,
  initialize
} = useConversation()

onMounted(() => {
  initialize()
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
      <div v-if="speechError || llmError || ttsError" class="error-banner">
        {{ speechError || llmError || ttsError }}
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
        <div class="loading-label">CORTEX (Gemma 270M)</div>
        <div class="loading-bar">
          <div class="loading-fill" :style="{ width: llmLoadProgress + '%' }"></div>
        </div>
        <span class="loading-text">{{ llmLoadProgress }}%</span>
      </div>

      <!-- Transcript Panel -->
      <div class="panel transcript-panel">
        <div class="panel-content">
          <span v-if="transcript" class="text-primary">{{ transcript }}</span>
          <span v-else class="text-placeholder">
            {{ isListening ? '◐ Listening...' : '○ Microphone inactive' }}
          </span>
        </div>
      </div>

      <!-- Waveform Visualizer -->
      <WaveformVisualizer :frequency-data="frequencyData" :current-state="currentState" />

      <!-- Response Panel -->
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
        @click="toggleConversation"
      >
        <span class="button-glow"></span>
        <span class="button-icon">
          <span v-if="isModelLoading" class="spinner"></span>
          <span v-else-if="isConversationActive">■</span>
          <span v-else>&#9654;</span>
        </span>
      </button>
    </div>

    <!-- About Button -->
    <button class="about-button" @click="showAbout = true">About</button>

    <!-- Stats Display -->
    <div v-if="avgSTT > 0 || avgLLM > 0 || avgTTS > 0" class="stats-display">
      <span v-if="avgSTT > 0" class="stat-item">STT: {{ avgSTT }}ms</span>
      <span v-if="avgLLM > 0" class="stat-item">LLM: {{ avgLLM }}ms</span>
      <span v-if="avgTTS > 0" class="stat-item">TTS: {{ avgTTS }}ms</span>
    </div>

    <!-- About Popup -->
    <AboutPopup :visible="showAbout" @close="showAbout = false" />
  </div>
</template>
