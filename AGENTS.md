# Repository Guidelines

## Project Structure & Module Organization

Ava is a privacy-first browser voice assistant built with Vue 3, TypeScript, and Vite. Application code lives in `src/`:

- `src/App.vue` is the main shell.
- `src/components/` contains reusable UI components.
- `src/composables/` contains speech recognition, LLM, TTS, visualization, and conversation orchestration logic.
- `src/styles/main.css` contains global styling.

Static assets, model files, WebAssembly support files, and deployment metadata belong in `public/`. Architecture documentation and diagrams are in `docs/`; project planning artifacts are in `openspec/`. Keep new feature logic in a focused composable or component rather than expanding `App.vue` unnecessarily.

## Build, Test, and Development Commands

Run these commands from the repository root:

```bash
npm install       # Install dependencies
npm run dev       # Start the Vite development server
npm run build     # Type-check and create a production build
npm run preview   # Serve the production build locally
```

The app requires cross-origin isolation headers and a browser with microphone support; verify voice features in a supported Chrome or Edge environment. There is currently no automated test or lint command configured.

## Coding Style & Naming Conventions

Use TypeScript with two-space indentation and semicolons, matching the existing code. Use PascalCase for Vue component filenames (`WaveformVisualizer.vue`), camelCase for composables prefixed with `use` (`useConversation.ts`), and descriptive camelCase for functions and variables. Prefer Vue Composition API patterns and keep browser/model lifecycle cleanup explicit. Run `npm run build` before submitting changes to catch TypeScript and bundling errors.

## Testing Guidelines

No test framework or coverage threshold is currently defined. For changes affecting audio, VAD, Whisper, model inference, or speech synthesis, manually test microphone permissions, interruption/stop behavior, streaming responses, and a fresh model download in the browser. Include the browser used and any relevant console errors in the PR description.

## Commit & Pull Request Guidelines

Use short, imperative commit subjects, optionally with a conventional prefix (for example, `fix: Handle interrupted speech`). Keep commits focused. Pull requests should explain the user-visible behavior, identify affected composables/components, link any related issue or change proposal, and include screenshots or a short recording for UI or interaction changes. Confirm `npm run build` passes.
