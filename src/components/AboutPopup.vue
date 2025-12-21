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
      <div class="author-footer">
        <img src="/avatar.jpeg" alt="Muthukrishnan">
        <span>Developed by Muthukrishnan</span>
        <a href="https://www.linkedin.com/in/krimuthu/" target="_blank" rel="noopener noreferrer" class="linkedin-link">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          Follow on LinkedIn
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.author-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.author-footer img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--border);
}

.author-footer span {
  font-size: 0.85rem;
  color: var(--text-dim);
}

.linkedin-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #0a66c2;
  color: white;
  text-decoration: none;
  border-radius: 999px;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  transition: background 0.2s;
}

.linkedin-link:hover {
  background: #004182;
}

.linkedin-link svg {
  flex-shrink: 0;
}
</style>
