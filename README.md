# Ava

A private AI voice assistant that runs entirely in your browser. No servers, no data leaves your device.

## Features

- **Voice Input** - Local speech recognition using Whisper (WebAssembly)
- **Local LLM** - Runs Qwen 0.5B model in-browser via WebAssembly (Wllama)
- **Voice Output** - Text-to-speech responses using Web Speech Synthesis
- **Audio Visualizer** - Real-time waveform display during conversation
- **Fully Private** - All processing happens locally in your browser

## Tech Stack

- Vue 3 + TypeScript
- Vite
- Whisper (WebAssembly speech-to-text)
- Wllama (WebAssembly llama.cpp port)
- Web Speech Synthesis API

## Getting Started

```bash
npm install
npm run dev
```

## Browser Support

Requires Chrome or Edge with SharedArrayBuffer support (cross-origin isolation enabled).

## Developer

Muthukrishnan
