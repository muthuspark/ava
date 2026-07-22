## ADDED Requirements

### Requirement: Worker-owned inference
The system SHALL initialize and use speech-to-text and language-model inference from a dedicated worker rather than executing model operations on the Vue main thread.

#### Scenario: Worker initializes successfully
- **WHEN** the application initializes the assistant
- **THEN** the inference worker loads the configured models and reports readiness without blocking the Vue main thread

#### Scenario: Worker initialization fails
- **WHEN** the inference worker cannot load a required model
- **THEN** it emits a normalized error event and the application exposes the assistant as unavailable

### Requirement: WebGPU selection with WASM fallback
The system SHALL attempt to use WebGPU for supported inference and SHALL fall back to the existing WASM execution path when WebGPU is unavailable or initialization fails.

#### Scenario: WebGPU is available
- **WHEN** the worker detects a usable WebGPU runtime and successfully initializes it
- **THEN** it uses WebGPU for the supported inference pipeline and reports backend `webgpu`

#### Scenario: WebGPU is unavailable
- **WHEN** the browser does not expose a usable WebGPU runtime
- **THEN** the worker initializes the existing WASM inference path and reports backend `wasm`

#### Scenario: WebGPU initialization fails
- **WHEN** WebGPU capability detection succeeds but model or runtime initialization fails
- **THEN** the worker attempts WASM initialization before reporting a fatal inference error

### Requirement: Streaming worker events
The system SHALL stream model loading progress, transcription results, generated output, completion, and errors from the worker to the application using typed events.

#### Scenario: Transcription completes
- **WHEN** the worker receives an audio segment for transcription
- **THEN** it emits a transcription event containing the recognized text and request ID

#### Scenario: Generation streams output
- **WHEN** the worker generates a response
- **THEN** it emits incremental output events and a final completion event for the same request ID

#### Scenario: Model loading reports progress
- **WHEN** a configured model is downloading or initializing
- **THEN** the worker emits progress events that allow the application to update its loading indicator

### Requirement: Request identity and cancellation
The system SHALL associate every transcription and generation request with a request ID and SHALL prevent cancelled or superseded requests from updating active conversation state.

#### Scenario: User stops an active conversation
- **WHEN** the user stops Ava while inference is active
- **THEN** the client sends cancellation, marks the request inactive, and ignores subsequent events for that request

#### Scenario: New request supersedes an old request
- **WHEN** a newer request begins before an older request has finished
- **THEN** output from the older request SHALL NOT be displayed or queued for speech

#### Scenario: Runtime cannot preempt inference
- **WHEN** the underlying runtime cannot interrupt an active operation immediately
- **THEN** the worker suppresses stale output and eventually returns to an available state without corrupting the next request

### Requirement: Backend diagnostics
The system SHALL expose the active inference backend and normalized initialization errors to the UI.

#### Scenario: Backend is selected
- **WHEN** the worker completes backend initialization
- **THEN** the application can display whether Ava is using WebGPU or WASM

#### Scenario: Both backends fail
- **WHEN** WebGPU and WASM initialization both fail
- **THEN** the application displays an actionable error and prevents conversation start
