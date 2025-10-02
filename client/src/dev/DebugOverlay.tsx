import { useState, useEffect } from "react";
import { voiceBus, VoiceEvent, VoiceEventType } from "@/voice/voiceBus";

interface DebugEvent {
  event: VoiceEvent;
  timestamp: string;
  id: string;
}

// All event types to listen to
const EVENT_TYPES: VoiceEventType[] = [
  'speak',
  'userSpeechRecognized',
  'userTextSubmitted',
  'changoResponse',
  'cancel',
  'muteChange',
  'powerChange',
  'speakingChange',
  'stateChange'
];

export function DebugOverlay() {
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    // Expose voiceBus to window for console debugging
    if (typeof window !== 'undefined') {
      (window as any).voiceBus = voiceBus;
      console.log('[DebugOverlay] 🔧 voiceBus exposed to window.voiceBus');
    }
    
    // Subscribe to all event types
    const unsubscribers: (() => void)[] = [];
    
    EVENT_TYPES.forEach(eventType => {
      const unsubscribe = voiceBus.on(eventType, (event: VoiceEvent) => {
        const timestamp = new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3
        });
        
        const debugEvent: DebugEvent = {
          event,
          timestamp,
          id: `${Date.now()}-${Math.random()}`
        };
        
        // Keep only the last 12 events
        setEvents(prev => {
          const newEvents = [debugEvent, ...prev].slice(0, 12);
          return newEvents;
        });
        
        // Also log to console for debugging
        console.log(`[DebugOverlay] ${timestamp} - ${event.type}`, event);
      });
      
      unsubscribers.push(unsubscribe);
    });
    
    // Cleanup on unmount
    return () => {
      unsubscribers.forEach(unsub => unsub());
      console.log('[DebugOverlay] 🔧 Cleaned up event listeners');
    };
  }, []);
  
  // Format event text for display
  const formatEventText = (event: VoiceEvent): string => {
    if (event.text) {
      // Truncate text to 80 characters
      const truncated = event.text.length > 80 
        ? event.text.substring(0, 80) + '...' 
        : event.text;
      return truncated;
    }
    
    // For non-text events, show relevant data
    if (event.type === 'muteChange') return `muted: ${event.muted}`;
    if (event.type === 'powerChange') return `powered: ${event.powered}`;
    if (event.type === 'speakingChange') return `speaking: ${event.speaking}`;
    if (event.type === 'stateChange' && event.state) {
      return `mute:${event.state.mute} speak:${event.state.speaking} power:${event.state.power}`;
    }
    
    return '';
  };
  
  // Get event color based on type
  const getEventColor = (type: VoiceEventType): string => {
    switch(type) {
      case 'speak':
      case 'changoResponse':
        return '#00ffff'; // cyan
      case 'userSpeechRecognized':
      case 'userTextSubmitted':
        return '#00ff88'; // green-cyan
      case 'cancel':
        return '#ff8800'; // orange
      case 'muteChange':
      case 'powerChange':
      case 'speakingChange':
      case 'stateChange':
        return '#8888ff'; // light blue
      default:
        return '#ffffff'; // white
    }
  };
  
  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 left-4 z-[9999] bg-black/80 text-cyan-400 px-2 py-1 rounded text-xs font-mono hover:bg-black/90 transition-colors"
        style={{ fontFamily: 'monospace' }}
      >
        Show Debug
      </button>
    );
  }
  
  return (
    <div 
      className="fixed bottom-4 left-4 z-[9999] w-96 max-h-96 overflow-hidden rounded-lg"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        border: '1px solid rgba(0, 255, 255, 0.3)',
        fontFamily: 'monospace',
        fontSize: '11px',
        boxShadow: '0 0 20px rgba(0, 255, 255, 0.2)'
      }}
    >
      {/* Header */}
      <div 
        className="flex justify-between items-center px-3 py-2 border-b"
        style={{ 
          borderColor: 'rgba(0, 255, 255, 0.3)',
          backgroundColor: 'rgba(0, 255, 255, 0.05)'
        }}
      >
        <span style={{ color: '#00ffff', fontWeight: 'bold' }}>
          🔧 VoiceBus Debug Monitor
        </span>
        <button
          onClick={() => setIsVisible(false)}
          className="text-cyan-400 hover:text-cyan-300 transition-colors"
          style={{ fontSize: '14px' }}
        >
          ×
        </button>
      </div>
      
      {/* Events list */}
      <div className="overflow-y-auto max-h-80">
        {events.length === 0 ? (
          <div className="px-3 py-4 text-center" style={{ color: '#666' }}>
            Waiting for events...
          </div>
        ) : (
          <div className="divide-y divide-cyan-900/30">
            {events.map((debugEvent) => (
              <div
                key={debugEvent.id}
                className="px-3 py-2 hover:bg-cyan-900/10 transition-colors"
              >
                {/* Timestamp and event type */}
                <div className="flex items-start gap-2 mb-1">
                  <span style={{ color: '#888', fontSize: '10px' }}>
                    {debugEvent.timestamp}
                  </span>
                  <span 
                    className="font-bold"
                    style={{ color: getEventColor(debugEvent.event.type) }}
                  >
                    {debugEvent.event.type}
                  </span>
                  {debugEvent.event.source && (
                    <span style={{ color: '#aaa', fontSize: '10px' }}>
                      [{debugEvent.event.source}]
                    </span>
                  )}
                </div>
                
                {/* Event content */}
                {formatEventText(debugEvent.event) && (
                  <div 
                    className="ml-14 break-words"
                    style={{ color: '#ccc', fontSize: '10px' }}
                  >
                    {formatEventText(debugEvent.event)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer with stats */}
      <div 
        className="px-3 py-1 border-t text-xs"
        style={{ 
          borderColor: 'rgba(0, 255, 255, 0.3)',
          color: '#666'
        }}
      >
        {events.length} / 12 events • window.voiceBus available
      </div>
    </div>
  );
}