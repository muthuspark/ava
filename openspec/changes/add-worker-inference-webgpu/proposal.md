## Why

Ava currently performs speech transcription and local language-model inference through the application lifecycle, which can make the interface compete with inference work and limits the ability to use faster browser GPU execution. A worker-based inference boundary with WebGPU selection and a WASM fallback will improve responsiveness and reduce latency while preserving support for browsers that cannot use WebGPU.

## What Changes

- Add a dedicated inference worker boundary for speech-to-text and language-model operations.
- Detect WebGPU capability and select it when initialization succeeds.
- Preserve the existing WASM inference path as an automatic fallback.
- Stream worker progress, transcripts, generated text, and errors back to the Vue application.
- Expose the active inference backend so the UI can communicate whether Ava is using WebGPU or WASM.
- Keep the first implementation focused on inference routing; persistent model caching, PWA/offline installation, and replacing the current LLM runtime are out of scope.

## Capabilities

### New Capabilities

- `worker-inference`: Run Ava's speech and language inference behind a worker boundary with backend selection, streaming events, and fallback behavior.

### Modified Capabilities

None.

## Impact

- Affected composables: `useWhisper.ts`, `useWllama.ts`, and `useConversation.ts`.
- New worker and shared message types will be added under `src/workers/` and `src/types/`.
- `App.vue` will consume backend status and worker errors for user-visible diagnostics.
- `@huggingface/transformers` configuration will gain WebGPU selection where supported; the current Wllama WASM path remains available.
- Browser support will continue to require secure contexts and the existing cross-origin isolation setup for threaded WASM where applicable.
