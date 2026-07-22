## 1. Define the worker boundary

- [x] 1.1 Add shared TypeScript command and event unions for model loading, transcription, generation, cancellation, progress, backend status, completion, and errors.
- [x] 1.2 Add a Vite-compatible inference worker entry point and a client composable that owns its lifecycle, message routing, and cleanup.
- [x] 1.3 Add request ID tracking so the client can identify active, cancelled, and superseded inference requests.

## 2. Move Whisper inference into the worker

- [x] 2.1 Move Transformers.js Whisper pipeline initialization into the worker while preserving the current model, quantization, progress mapping, and transcription behavior.
- [x] 2.2 Route audio segments from the existing VAD integration through the worker and emit normalized transcription events.
- [x] 2.3 Add WebGPU pipeline selection for Whisper when `navigator.gpu` is usable, with initialization failure falling back to the existing WASM configuration.
- [x] 2.4 Report Whisper backend, loading progress, and normalized errors through the worker protocol.

## 3. Move LLM inference into the worker

- [x] 3.1 Move Wllama initialization and model loading into the worker without changing the current model, prompt format, sampling settings, or WASM asset configuration.
- [x] 3.2 Preserve streamed response and sentence-boundary behavior by emitting worker generation events.
- [x] 3.3 Ensure LLM loading progress, generation state, and failures are exposed through the client composable.

## 4. Integrate conversation control

- [x] 4.1 Update `useConversation` to initialize models and submit transcription/generation work through the worker client.
- [x] 4.2 Replace direct inference completion assumptions with request-aware event handling and prevent stale results from updating transcript, response, or TTS queues.
- [x] 4.3 Implement stop and interruption handling that sends cancellation, clears active request state, and returns Ava to a safe idle/listening state.
- [x] 4.4 Preserve existing public conversation state, progress values, error fields, streaming TTS behavior, and statistics reporting.

## 5. Surface compatibility and verify behavior

- [x] 5.1 Expose the active backend and worker readiness state to `App.vue` and show concise WebGPU/WASM diagnostics when useful.
- [x] 5.2 Normalize the fatal error path so conversation start is disabled only when both WebGPU and WASM initialization fail.
- [x] 5.3 Run `npm run build` and resolve worker, WASM, and TypeScript bundling issues.
- [ ] 5.4 Manually verify model loading, transcription, streaming response, stop behavior, and TTS behavior in a WebGPU-capable browser.
- [ ] 5.5 Manually verify automatic WASM fallback in a browser or environment without WebGPU and record backend and latency observations.
