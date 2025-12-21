<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { stateColors, type ConversationState } from '../composables/useConversation'

const props = defineProps<{
  frequencyData: Uint8Array
  currentState: ConversationState
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

function drawWaveform() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height
  const data = props.frequencyData
  const barCount = 64
  const barWidth = width / barCount - 2
  const colors = stateColors[props.currentState]

  ctx.clearRect(0, 0, width, height)

  // Create gradient
  const gradient = ctx.createLinearGradient(0, height, 0, 0)
  gradient.addColorStop(0, colors.primary)
  gradient.addColorStop(1, colors.secondary)

  // Draw bars
  for (let i = 0; i < barCount; i++) {
    const value = data[i] || 0
    const barHeight = (value / 255) * height * 0.8 + 4

    const x = i * (barWidth + 2) + 1
    const y = (height - barHeight) / 2

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

onMounted(() => {
  if (canvasRef.value) {
    canvasRef.value.width = 600
    canvasRef.value.height = 120
    drawWaveform()
  }
})
</script>

<template>
  <div class="visualizer-section">
    <div class="visualizer-container">
      <canvas ref="canvasRef" class="waveform-canvas"></canvas>
      <div class="visualizer-overlay"></div>
    </div>
  </div>
</template>
