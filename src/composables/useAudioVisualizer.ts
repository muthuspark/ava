import { ref, onUnmounted } from 'vue'

export function useAudioVisualizer() {
  const isActive = ref(false)
  const frequencyData = ref<Uint8Array>(new Uint8Array(64))

  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let microphone: MediaStreamAudioSourceNode | null = null
  let stream: MediaStream | null = null
  let animationId: number | null = null

  async function start() {
    if (isActive.value) return

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioContext = new AudioContext()
      analyser = audioContext.createAnalyser()

      analyser.fftSize = 128
      analyser.smoothingTimeConstant = 0.8

      microphone = audioContext.createMediaStreamSource(stream)
      microphone.connect(analyser)

      isActive.value = true
      animate()
    } catch {
      // Silently fail - visualizer is non-essential
    }
  }

  function animate() {
    if (!analyser || !isActive.value) return

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(dataArray)
    frequencyData.value = dataArray

    animationId = requestAnimationFrame(animate)
  }

  function stop() {
    isActive.value = false

    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }

    if (microphone) {
      microphone.disconnect()
      microphone = null
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      stream = null
    }

    if (audioContext) {
      audioContext.close()
      audioContext = null
    }

    analyser = null
    frequencyData.value = new Uint8Array(64)
  }

  // Generate synthetic waveform for TTS (since we can't capture system audio easily)
  function simulateSpeaking() {
    if (animationId) {
      cancelAnimationFrame(animationId)
    }

    const simulateFrame = () => {
      const data = new Uint8Array(64)
      for (let i = 0; i < 64; i++) {
        // Create a smooth wave pattern with some randomness
        const base = Math.sin(Date.now() / 100 + i * 0.3) * 50 + 80
        const noise = Math.random() * 40
        data[i] = Math.min(255, Math.max(0, base + noise))
      }
      frequencyData.value = data
      animationId = requestAnimationFrame(simulateFrame)
    }

    simulateFrame()
  }

  function stopSimulation() {
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
    frequencyData.value = new Uint8Array(64)
  }

  onUnmounted(() => {
    stop()
  })

  return {
    isActive,
    frequencyData,
    start,
    stop,
    simulateSpeaking,
    stopSimulation
  }
}
