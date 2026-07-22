## Context

Ava currently coordinates VAD, Whisper transcription, Wllama generation, and speech synthesis from Vue composables. `useConversation` reacts to transcript changes and invokes inference directly, while the UI consumes loading, generation, and error state from those composables. Transformers.js can use WebGPU for Whisper, but browser support is variable; the existing quantized WASM paths must remain usable.

The change introduces a worker boundary for inference without changing Ava's user-facing conversation flow or replacing the current LLM runtime. The worker owns model instances and communicates with the Vue thread using typed commands and events.

## Goals / Non-Goals

**Goals:**

- Keep model loading and inference work off the Vue main thread.
- Select WebGPU when it is available and initialization succeeds.
- Fall back automatically to the current WASM execution path when WebGPU is unavailable or fails.
- Preserve streaming generation and progress reporting.
- Expose backend and worker lifecycle status to the UI.
- Prevent stale inference results from updating the active conversation after a stop or restart.

**Non-Goals:**

- Persistent model caching, service-worker offline support, or PWA installation.
- Replacing Wllama with WebLLM or another LLM runtime.
- Redesigning the UI or changing speech synthesis behavior.
- Moving microphone capture or VAD into an AudioWorklet.
- Guaranteeing true preemptive cancellation inside every inference runtime.

## Decisions

### Dedicated inference worker

Add an inference worker that owns the Whisper transcriber and Wllama instance. The main thread will use a small client composable to send commands such as `load`, `transcribe`, `generate`, and `cancel`, and to consume progress, transcript, token/sentence, completion, and error events.

This isolates CPU/GPU-heavy work and creates one stable boundary for future model runtimes.

Alternative considered: keep inference in composables and only add WebGPU options. This has less code movement but leaves model work competing with rendering and makes cancellation and runtime replacement harder.

### Backend selection inside the worker

The worker will attempt WebGPU for Transformers.js Whisper when the runtime exposes a usable GPU device. If capability detection, pipeline creation, or the first inference initialization fails, it will report the failure and initialize the existing WASM configuration instead. Backend selection is per worker session and is reported as `webgpu` or `wasm`.

For the LLM, the existing Wllama WASM implementation remains the compatibility path. The worker boundary must not require a Wllama WebGPU port in this change; the architecture leaves room for a future GPU-capable LLM runtime.

Alternative considered: make WebGPU mandatory. This would improve performance for supported devices but violates Ava's existing browser compatibility expectations.

### Typed message protocol

Define shared TypeScript unions for worker commands and events. Every inference request carries a monotonically increasing `requestId`. Events include that ID so the client can ignore results belonging to cancelled or superseded work.

Generation output will continue to be streamed as token or sentence events. The worker will not expose model objects or runtime-specific callbacks to Vue components.

### Cancellation semantics

The client sends a cancel command and marks the request inactive immediately. The worker will use runtime cancellation APIs where available. If a runtime cannot interrupt an active operation, the worker will suppress subsequent events for that request and clean up or restart the runtime only when necessary.

This provides deterministic UI behavior even when underlying WASM inference cannot be preempted.

### Compatibility and deployment

The worker will use Vite-compatible worker construction and existing model asset configuration. Existing cross-origin isolation requirements remain documented. The UI will display a clear compatibility error only when both WebGPU and WASM initialization fail.

## Risks / Trade-offs

- **[WebGPU availability and driver differences]** → Treat WebGPU as an optimization, catch initialization/inference failures, and retry with WASM.
- **[Worker bundling or WASM asset path issues]** → Keep runtime and WASM versions aligned with package dependencies and verify production build output.
- **[WASM inference still blocks the worker]** → The UI remains responsive, but response latency is unchanged; record backend and timing metrics for follow-up optimization.
- **[Cancellation cannot interrupt native runtime work]** → Apply request IDs and discard stale events; restart the worker only as a recovery path.
- **[Duplicate model instances during migration]** → Move ownership fully into the worker before removing direct composable initialization.
- **[Changed error timing]** → Normalize worker errors into stable user-facing error states in the client composable.

## Migration Plan

1. Add the shared protocol and worker client while preserving the existing composable-facing API.
2. Move Whisper model loading and transcription into the worker with WASM behavior first.
3. Add WebGPU selection and backend status for Whisper.
4. Move Wllama loading and streaming generation into the same worker.
5. Update `useConversation` to use the worker client and request cancellation semantics.
6. Update UI diagnostics and run the production build.
7. Manually compare WebGPU and WASM behavior in supported and unsupported browsers.

Rollback is to revert the composable wiring to the current direct implementations. No persisted data or server migrations are introduced.

## Open Questions

- Should WebGPU be attempted for LLM inference in this change if the current Wllama runtime cannot provide it, or should WebGPU initially be limited to Whisper?
- Which exact browsers and devices form the minimum manual verification matrix?
- Should backend and latency metrics remain visible in the UI, or be limited to development diagnostics?
