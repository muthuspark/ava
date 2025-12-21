<script setup lang="ts">
defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <div v-if="visible" class="about-overlay" @click="emit('close')">
    <div class="about-popup" @click.stop>
      <button class="about-close" @click="emit('close')">×</button>
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
</template>
