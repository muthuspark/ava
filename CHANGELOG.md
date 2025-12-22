# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-12-22

### Added

- Performance stats display at bottom-left showing average STT, LLM, and TTS processing times in milliseconds
- New `useStats` composable for tracking timing metrics with rolling averages

### Changed

- Switched LLM from Qwen 2.5 0.5B (~350MB) to Gemma 3 270M (~180MB) for faster inference and smaller download
- Updated chat template to use Gemma's `<start_of_turn>/<end_of_turn>` format
- Total model download reduced from ~380MB to ~210MB

## [1.0.0] - 2024-12-22

### Added

- Google Analytics tracking for usage insights
- Cross-platform voice fallback options for TTS (prioritizes Google US English, then en-GB/en-US female voices, with Australian English as fallback)
- Permissions section in README with platform-specific setup instructions (macOS, Windows, Linux)
- Auto-trigger permissions on initialization for smoother onboarding

### Changed

- TTS intro now plays after microphone permission is granted on first button click (requires user interaction for browser compatibility)
- Default TTS voice preference changed to Australian English
- Shorter intro message for quicker start experience

### Fixed

- TTS race conditions causing audio playback issues
- Stale TTS error messages persisting in UI after audio starts working
- Voice validation to ensure selected voice exists before assignment
- Pending count tracking in speech synthesis for accurate state management
