# Ava

A private AI voice assistant that runs entirely in your browser. No servers, no data leaves your device.

## Features

- **Voice Input** - Real-time speech recognition using Web Speech API
- **Local LLM** - Runs Qwen 0.5B model in-browser via WebAssembly (Wllama)
- **Voice Output** - Text-to-speech responses using Web Speech Synthesis
- **Audio Visualizer** - Real-time waveform display during conversation
- **Fully Private** - All processing happens locally in your browser

## Tech Stack

- Vue 3 + TypeScript
- Vite
- Wllama (WebAssembly llama.cpp port)
- Web Speech API

## Getting Started

```bash
npm install
npm run dev
```

## Browser Support

Requires a modern browser with Web Speech API support (Chrome or Edge recommended).

## Developer

Muthukrishnan
