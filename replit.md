# Overview

Chango AI is a full-stack TypeScript application featuring a React frontend and Node.js/Express backend with PostgreSQL. It provides advanced voice synthesis and accent emulation capabilities using its proprietary Chango Voice Engine (CVE). Key functionalities include speech synthesis with various accents, custom voice profile creation from recordings, and an interactive holographic interface that delivers curiosity-driven, natural, and personality-driven AI responses. The system also incorporates robust voice security features like voiceprint authentication and advanced voice activity detection (VAD).

# Recent Updates (October 6, 2025)

## CLI WAV Exporter and Enhanced Voice Features
Added CLI tool and advanced voice system enhancements:
- **CLI WAV Exporter**: Pure Node.js TTS-to-WAV renderer (no third-party deps)
  - Command: `npm run tts:wav` or `node server/cli/tts_render.mjs`
  - Renders Chango's formant synthesis to 16-bit PCM WAV files offline
- **Dev Overlay Hotkey**: Alt+Shift+D toggles phoneme timeline visualization
- **Device Auto-Adapt**: Detects environment (mobile/car/desktop) and optimizes settings
- **Speech State Machine**: Prevents STT/TTS loops and transcript duplication  
- **Permission Validator**: Auto-recovers from mic permission changes
- **Diagnostic Monitor**: Centralized error/warning tracking with priority filtering

## Jest Testing Infrastructure and Dev Overlay
Added comprehensive testing infrastructure and development tools:
- **Jest + jsdom**: Test harness for unit testing voice modules
- **Test Coverage**: Tests for EventBus, Prosody, Accent, MFCC, and G2P/Timeline modules
- **Phoneme Timeline Dev Overlay**: Hidden visualization tool for TTS timeline
  - Activated via `?changoDev=1` URL parameter or `localStorage.setItem('changoDev','1')`
  - Toggle with Alt+Shift+D hotkey
  - Shows real-time phoneme generation and timeline events
- **Module Updates**: Refined implementations for all core voice modules

# Recent Updates (October 4, 2025)

## Global Debug Monitor with Self-Healing
Implemented comprehensive diagnostic system with automatic recovery:
- **Health Check Registry**: Modular health checks run every 800ms across all subsystems
- **Auto-Healing**: Automatic fixes for STT idle, TTS stuck, mic permissions, memory pressure
- **Smart Notifications**: Critical/error events spoken via TTS, warnings shown as toasts
- **Rate Limiting**: 4-second cooldown per event type to prevent notification spam
- **Isolated Architecture**: Clean separation under `/diag` folder for easy management

## Streamlined Voice Security Implementation
Applied optimized voiceprint and VAD implementation with the following improvements:
- **Lightweight MFCC Voiceprint**: 13-dimensional mean vectors with cosine similarity matching (threshold 0.70-0.95, default 0.82)
- **Energy + Spectral Flux VAD**: Real-time speech detection with hysteresis and auto-calibrating thresholds
- **Barge-in Support**: Automatic TTS interruption when user speaks, with STT resume after barge-in
- **Auto-idle**: System idles after 1 second of silence to conserve resources
- **Simplified UI**: Clean enrollment button, match requirement toggle, and threshold slider
- **Debug Integration**: Full event emissions for monitoring voiceprint enrollment, verification, and VAD states
- **Local-only Processing**: All voice processing happens on-device with localStorage persistence

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Decisions
The frontend is built with React 18, TypeScript, and Vite. It leverages shadcn/ui components with Radix UI primitives, styled using Tailwind CSS for custom theming. The UI supports dynamic interface switching between a compact Header mode and a holographic Sphere mode, with preferences persisting in local storage. Visual feedback for voice status (idle, listening, speaking, error) is integrated.

## Technical Implementations
The application employs a component-based architecture with custom React hooks for modularity and reusability. State management utilizes TanStack Query for server state and local React hooks for component state. The backend is an Express.js server with TypeScript, following a layered architecture with modular routes, centralized error handling, and request logging. It includes features like a hands-free wake word system, advanced voice activity detection (VAD), and a curiosity engine for dynamic AI responses. Voice security includes local voiceprint authentication, VAD, and barge-in capabilities.

## Feature Specifications
- **Chango Voice Engine (CVE)**: Proprietary engine for phrase-level synthesis, preserving punctuation, dynamic prosody (pitch, rate, volume variations for emotion), natural speech features (intonation, emphasis, pauses), and a rule-based accent engine. It also supports audio analysis and automated voice profile generation.
- **Voice Intelligence System**: API endpoints for analyzing audio samples, saving, listing, retrieving, and deleting voice profiles, and applying accent/gender style presets. Voice profiles are stored as JSON files.
- **Wake Word System**: Centralized configuration for "Chango" and its variations, enabling voice-activated interaction with a cooldown period and maximum utterance time.
- **Voice Security**: Voiceprint authentication using 13-MFCC mean vector extraction, cosine similarity matching, VAD with energy/spectral flux detection, and barge-in functionality.
- **Holographic Interface**: Canvas-based particle system with "awakened" and "sentinel" modes, providing real-time voice visualization.
- **Diagnostics Dashboard**: Enhanced monitoring with persistent time-series metrics storage, real-time memory/CPU charts, export functionality, and secured API endpoint listing.

## System Design Choices
- **Data Layer**: Drizzle ORM with PostgreSQL (via Neon Database serverless driver) for data persistence. Schema includes Voice Profiles, System Settings, and Curiosity Logs, using UUID primary keys, JSONB columns for flexible data, and timestamp tracking.
- **Security & Error Handling**: Input validation with Zod schemas, file upload restrictions (MIME type, size), centralized error boundaries, and CORS configuration.
- **Real-time Features**: Animated components for visual feedback, including a holographic interface and voice visualizer.
- **Voice Control System**: Singleton VoiceController with ACTIVE/MUTED/KILLED/WAKE state management, execution guards, HMR-safe initialization, kill/revive functionality, and async event emission to prevent self-listening loops and stack overflows.

# External Dependencies

## Core Framework Dependencies
- **Frontend**: React 18, React Router (wouter), React Hook Form
- **UI**: Radix UI primitives, shadcn/ui
- **Styling**: Tailwind CSS
- **Build Tools**: Vite, TypeScript

## Backend Infrastructure
- **Web Framework**: Express.js
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL (via @neondatabase/serverless)
- **File Handling**: Multer

## Database and Storage
- **Session Management**: connect-pg-simple
- **Schema Management**: Drizzle Kit

## Audio and Voice Processing
- **Browser APIs**: Web Speech API (Speech Synthesis API), Web Audio API

## UI and Animation
- **Icons**: Lucide React
- **CSS Utility**: Class Variance Authority
- **Date Handling**: date-fns