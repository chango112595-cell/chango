# 🎙️ Chango AI - Advanced Voice Assistant

An intelligent voice assistant with advanced speech synthesis, accent emulation, and natural conversation capabilities. Chango AI features a proprietary voice engine, holographic interface, and robust voice security system.

## ✨ Key Features

### 🗣️ **Chango Voice Engine (CVE)**
- **Advanced Speech Synthesis**: Phrase-level synthesis with dynamic prosody for natural-sounding speech
- **Accent Emulation**: Rule-based accent engine supporting multiple regional accents and styles
- **Voice Profiles**: Create custom voice profiles from audio recordings
- **Natural Speech Features**: Intelligent intonation, emphasis, and pause placement

### 🎯 **Voice Intelligence System**
- **Wake Word Activation**: Responds to "lolo" and variations ("hey lolo", "ok lolo", "hi lolo")
- **Continuous Listening**: Always-on speech recognition with automatic restart on errors
- **Duplicate Prevention**: Smart filtering prevents message loops with 3-second suppression window
- **Auto-Recovery**: Self-healing STT system with 12-second stuck detection

### 🔒 **Voice Security**
- **Voiceprint Authentication**: 13-MFCC mean vector extraction with cosine similarity matching
- **Voice Activity Detection (VAD)**: Real-time speech detection with energy and spectral flux analysis
- **Barge-in Support**: Automatic TTS interruption when user speaks
- **Permission Management**: Graceful handling of microphone permissions

### 💫 **Holographic Interface**
- **Dynamic Visualization**: Canvas-based particle system with "awakened" and "sentinel" modes
- **Real-time Voice Feedback**: Visual representation of voice activity
- **Mode Switching**: Toggle between compact header and immersive sphere modes

### 📊 **Diagnostics & Monitoring**
- **Debug Monitor**: Real-time visibility into STT/TTS/Gate/Permission status
- **Health Monitoring**: Automatic detection and recovery from stuck states
- **Performance Metrics**: Time-series data with memory/CPU charts
- **Event Logging**: Comprehensive logging with debug bus integration

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **shadcn/ui** components with Radix UI primitives
- **Tailwind CSS** for styling
- **TanStack Query** for server state management
- **Web Speech API** for speech recognition
- **Web Audio API** for advanced audio processing

### Backend
- **Node.js** with Express.js
- **PostgreSQL** via Neon Database (serverless)
- **Drizzle ORM** for database management
- **Zod** for schema validation
- **Express Session** for session management

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Modern browser with microphone support
- Microphone permissions enabled

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the application
4. Grant microphone permissions when prompted

## 🎤 How to Use

### Voice Commands
1. **Activate**: Say "lolo" to wake the assistant
2. **Ask Questions**: Follow the wake word with your question
   - "Lolo, what time is it?"
   - "Hey lolo, tell me about the weather"
   - "Ok lolo, help me with something"

### Features
- **Voice Profiles**: Create custom voice profiles in the Voice Intelligence section
- **Debug Monitor**: Toggle debug view to see real-time system status
- **Interface Modes**: Switch between Header and Sphere visualization modes

## 🔧 Configuration

### Environment Variables
- `OPENAI_API_KEY`: Required for AI-powered responses
- `DATABASE_URL`: PostgreSQL connection string (auto-configured in Replit)

### Voice Settings
- Adjust voice pitch, rate, and volume in settings
- Choose from 68+ available neural voices
- Configure accent and gender presets

## 📱 iOS/Safari Support

The application includes special handling for iOS Safari:
- **Audio Context Unlocking**: Automatic handling of iOS audio restrictions
- **Touch Gesture Detection**: Enables audio on first user interaction
- **Permission Flow**: Graceful handling of microphone permission requests
- **Recovery Mechanisms**: Automatic recovery from iOS-specific audio issues

## 🐛 Troubleshooting

### Common Issues

**Microphone Not Working**
- Ensure microphone permissions are granted in browser settings
- Check that no other application is using the microphone
- Refresh the page after granting permissions

**Wake Word Not Detected**
- Speak clearly and say "lolo" at the beginning of your sentence
- Check Debug Monitor to verify STT is active
- Ensure microphone volume is adequate

**Voice Not Playing**
- Click anywhere on the page to unlock audio (required on mobile)
- Check browser audio settings
- Verify TTS is enabled in settings

## 🏗️ Architecture

### System Components
1. **Voice Controller**: Manages voice state and execution flow
2. **Conversation Engine**: Handles routing and response generation
3. **Voice Orchestrator**: Coordinates TTS providers and speech synthesis
4. **Always Listen**: Singleton STT manager with continuous recognition
5. **Health Monitor**: Auto-healing system for stuck states
6. **Debug Bus**: Event-driven logging and monitoring system

### Data Flow
1. User speaks wake word "lolo"
2. STT captures and transcribes speech
3. Wake word detector validates input
4. Conversation engine processes request
5. Response generated with appropriate personality
6. TTS synthesizes response with selected voice
7. Audio played back to user

## 📈 Recent Updates

- **Global Debug Monitor**: Self-healing diagnostic system with automatic recovery
- **Streamlined Voice Security**: Optimized voiceprint and VAD implementation
- **iOS Compatibility**: Enhanced support for Safari and mobile browsers
- **Singleton Protection**: Bulletproof STT instance management
- **Permission Handling**: Graceful degradation when permissions denied

## 📝 License

Proprietary - Chango AI Voice Technology

## 🤝 Contributing

This is a proprietary project. For questions or support, please contact the development team.

---

**Built with ❤️ using modern web technologies**