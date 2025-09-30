# Overview

This is a full-stack TypeScript application called "Chango AI" that provides advanced voice synthesis and accent emulation capabilities using its proprietary Chango Voice Engine (CVE). The application features a React frontend with a Node.js/Express backend, utilizing PostgreSQL for data persistence. The system allows users to synthesize speech with various accents, record and analyze voice samples to create custom voice profiles, and includes an interactive holographic interface with curiosity-driven AI responses. Chango speaks with natural, conversational responses using dynamic templates, emotional variations, and personality-driven interactions.

# Recent Changes (September 30, 2025)

## Fixed Issues
- ✅ **Curiosity Engine Fix**: Prevented Chango from talking randomly when in WAKE mode
  - Added Voice mode checking to CuriosityEngine component
  - Curiosity responses now only occur in ACTIVE mode, not WAKE/MUTED/KILLED
  - Console logs confirm fix working: "[CuriosityEngine] Skipping auto response - Voice mode is WAKE"
  - System properly respects wake word requirement - only responds to "Chango" trigger
  
## Previous Fixes
- ✅ **Self-Listening Loop Prevention**: Comprehensive voice system improvements
  - **Hard-gate STT during TTS**: Speech recognition disabled while Chango speaks with 450ms cooldown
  - **Echo cancellation**: Browser-level audio processing (echo cancellation, noise suppression, auto gain control)
  - **WAKE mode default**: System requires "Chango" wake word to activate 10-second listening window
  - **No random replies**: Voice input ignored unless explicitly activated
  - **Single recognizer instance**: Prevents duplicate listeners and HMR issues
  
- ✅ **Stack Overflow Fix**: Resolved Maximum call stack size exceeded error in voice control system
  - Implemented singleton VoiceController with ACTIVE/MUTED/KILLED/WAKE state management
  - Added execution guards to prevent concurrent prosody executions
  - Fixed circular dependencies between Voice controller and VoiceBus
  - Added HMR-safe initialization to prevent duplicate listeners
  - Implemented audit logging for debugging voice state changes
  - Added Kill/Revive functionality with passphrase protection for emergency control
  - Fixed mute toggle stack overflow with re-entrancy guard in cancelSpeak()
  - Implemented async event emission with queueMicrotask() to break synchronous loops
  - System now handles rapid control toggling without errors

## Completed Features (September 29, 2025)
- ✅ **Hands-Free Wake Word System**: Complete voice-activated interaction with "Chango..." trigger
  - Wake word detection with customizable trigger phrase (default: "chango")
  - Speech-to-text via Web Speech API for command processing
  - NLP reply endpoint for natural language responses
  - Cooldown period (2.5s) to prevent rapid triggers
  - Maximum utterance time (8s) for commands
  - UI controls for enabling/disabling and customizing wake word
  - Real-time status indicators (listening, processing, cooldown)
- ✅ **Voice Activity Detection (VAD)**: Advanced speech detection system to prevent random talking
  - Auto Listen checkbox enables VAD requirement
  - Visual indicators for speech detection and audio levels
  - Anti-loop guard prevents overlapping speech
  - Human speech detection within 30-second window
  - User-initiated actions (chat, buttons) always work regardless of VAD
- ✅ **Voice Intelligence System**: Advanced voice analysis and profile management
  - POST `/api/voice/intel/analyze` - Analyzes audio samples for pitch, rate, energy features
  - POST `/api/voice/intel/profile/save` - Saves voice profiles with custom features
  - GET `/api/voice/intel/profile/list` - Lists all saved voice profiles
  - GET `/api/voice/intel/profile/get/:id` - Retrieves specific voice profile
  - DELETE `/api/voice/intel/profile/delete/:id` - Deletes voice profiles
  - POST `/api/voice/intel/style` - Applies accent/gender style presets
  - Voice profiles stored in `data/voice/` as JSON files
  - UI for recording, analyzing, and managing voice profiles
- ✅ **Voice Analysis API**: Foundation endpoints for future voice features
  - POST `/api/voice/analyze` - Analyzes WAV audio for voice characteristics
  - POST `/api/voice/clone` - Saves voice profile from analysis
  - POST `/api/voice/mimic` - Generates speech using saved profile (stub)
  - POST `/api/voice/accent/fix` - Fixes accent in audio (stub)
- ✅ **MCP Server Integration**: Clean MCP server implementation for ChatGPT connector support
  - Working endpoints at `/mcp` and `/mcp/write_file` 
  - Token authentication via `MCP_TOKEN` environment variable
  - Successfully tested with public URL access
- ✅ **Quiet Mode Button**: Added toggle to stop Chango's random chatter
  - Located in Curiosity Engine card header
  - Clear visual indicators for Active/Quiet modes
  - Preserves normal chat functionality
- ✅ **Voice System Status**: CVE (Chango Voice Engine) fully operational
  - Advanced prosody control with emotion variations
  - Multiple accent profiles (British RP, Southern US, etc.)
  - Voice profile learning from recordings
  - Real-time voice visualizer
- ✅ **Diagnostics Dashboard v2**: Enhanced system monitoring with persistent metrics
  - Persistent time-series metrics collection every 5 seconds
  - JSONL storage format in `data/metrics/metrics-YYYYMMDD.jsonl` files
  - Real-time memory usage and CPU load charts (last ~180 data points)
  - Export functionality to download all metrics as ZIP archive
  - Collapsible route listing showing all API endpoints
  - Secured with token authentication (`DIAGNOSTICS_TOKEN`)

## MCP Endpoints Available
- Discovery: `https://[your-replit-domain]/mcp?token=mcp-connect-chatgpt`
- Write File: `https://[your-replit-domain]/mcp/write_file?token=mcp-connect-chatgpt`

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client-side is built with React 18 and TypeScript, using Vite as the build tool. The UI framework is based on shadcn/ui components with Radix UI primitives, styled using Tailwind CSS with custom theming support. State management is handled through TanStack Query for server state and local React hooks for component state.

Key design patterns include:
- **Component-based architecture**: Modular React components for each feature (voice controls, accent emulator, holographic interface)
- **Custom hooks pattern**: Reusable hooks for voice synthesis, audio recording, and hologram animations
- **Query-based data fetching**: TanStack Query for efficient server communication and caching
- **Theme system**: CSS variables with dual theme support (classic/hud modes)

## Backend Architecture
The server is built with Express.js and TypeScript, following a layered architecture pattern. The system uses a modular route structure with centralized error handling and request logging middleware.

Core architectural decisions:
- **Storage abstraction**: Interface-based storage layer supporting both in-memory and database implementations
- **Middleware pipeline**: Request logging, JSON parsing, and error handling middleware
- **File upload handling**: Multer integration for audio file processing
- **Development tooling**: Vite integration for hot reloading in development

## Data Layer
The application uses Drizzle ORM with PostgreSQL as the primary database, configured with Neon Database serverless driver. The schema includes three main entities:

- **Voice Profiles**: Store accent configurations, audio features, and synthesis parameters
- **System Settings**: User preferences, theme selection, and AI behavior settings  
- **Curiosity Logs**: Track AI interactions and learning patterns

Database design principles:
- **UUID primary keys**: For distributed system compatibility
- **JSONB columns**: For flexible audio feature storage and contextual data
- **Timestamp tracking**: Automatic creation timestamps for audit trails

## Voice Processing Engine
The voice synthesis system implements the proprietary Chango Voice Engine (CVE) with advanced prosody control:

- **Phrase-level synthesis**: CVE-2-Phrase engine processes text into natural conversational phrases
- **Preserved punctuation**: Maintains all punctuation for proper pauses and intonation
- **Dynamic prosody**: Emotional variations (15-40% pitch, 5-15% rate, 10-15% volume)
- **Natural speech features**: Rising intonation for questions, emphasis for exclamations, thoughtful pauses for ellipses
- **Accent engine**: Rule-based text processing for various accent profiles (British RP, Southern US, etc.)
- **Audio analysis**: Web Audio API for extracting voice characteristics from recordings
- **Profile generation**: Automated voice profile creation from audio samples

## Real-time Features
The application includes animated components for visual feedback:

- **Holographic interface**: Canvas-based particle system with dual modes (awakened/sentinel)
- **Voice visualizer**: Real-time audio feedback during speech synthesis
- **Curiosity engine**: Dynamic response generation based on user interactions

## Security and Error Handling
- **Input validation**: Zod schemas for request validation
- **File upload restrictions**: MIME type filtering and size limits for audio files
- **Error boundaries**: Centralized error handling with user-friendly messages
- **CORS configuration**: Proper cross-origin request handling

# External Dependencies

## Core Framework Dependencies
- **React ecosystem**: React 18, React Router (wouter), React Hook Form with resolvers
- **UI library**: Radix UI primitives with shadcn/ui component system
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Build tools**: Vite with TypeScript support and development plugins

## Backend Infrastructure
- **Express.js**: Web framework with TypeScript support
- **Drizzle ORM**: Type-safe database operations with PostgreSQL dialect
- **Neon Database**: Serverless PostgreSQL hosting (@neondatabase/serverless)
- **File processing**: Multer for multipart form data handling

## Database and Storage
- **PostgreSQL**: Primary database via Neon serverless
- **Session management**: connect-pg-simple for PostgreSQL-based sessions
- **Migration system**: Drizzle Kit for database schema management

## Development and Deployment
- **TypeScript**: Full-stack type safety with shared schema definitions
- **Replit integration**: Custom Vite plugins for development environment
- **Build system**: ESBuild for server bundling, Vite for client assets
- **Package management**: NPM with lockfile for reproducible builds

## Audio and Voice Processing
- **Web APIs**: Speech Synthesis API and Web Audio API for browser-based processing
- **Audio analysis**: Custom implementations using Web Audio API for feature extraction
- **File formats**: Support for various audio formats with MIME type validation

## UI and Animation
- **Lucide React**: Icon library for consistent iconography
- **Class Variance Authority**: Type-safe CSS class management
- **Date handling**: date-fns for timestamp formatting and manipulation
- **Animation**: CSS-based animations with Tailwind transitions and custom keyframes