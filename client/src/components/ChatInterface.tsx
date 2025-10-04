import { useState, useRef, useEffect } from 'react';
import { Send, Mic } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'chango';
}

interface ChatInterfaceProps {
  messages: Message[];
  onSubmit: (text: string) => void;
}

export function ChatInterface({ messages, onSubmit }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    
    // Always prepend "lolo" if not present to ensure wake word
    const finalText = text.toLowerCase().startsWith('lolo') ? text : `lolo ${text}`;
    onSubmit(finalText);
    setInput('');
  };

  const toggleListening = () => {
    setIsListening(!isListening);
    // Voice activation would be handled here if microphone is available
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-96 bg-black/60 backdrop-blur-lg border-t border-white/20">
      <div className="h-full flex flex-col max-w-4xl mx-auto">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-white/60 mt-8">
              <p className="text-lg mb-2">Welcome to Chango AI</p>
              <p className="text-sm">Start by saying or typing "lolo" followed by your message</p>
            </div>
          )}
          
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] p-3 rounded-lg ${
                  msg.sender === 'user'
                    ? 'bg-blue-600/80 text-white'
                    : 'bg-purple-600/80 text-white'
                }`}
              >
                <div className="text-xs opacity-70 mb-1">
                  {msg.sender === 'user' ? 'You' : 'Chango'}
                </div>
                <div>{msg.text}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-white/10">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-lg transition-colors ${
                isListening
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              aria-label={isListening ? 'Stop listening' : 'Start listening'}
            >
              <Mic className={`w-5 h-5 text-white ${isListening ? 'animate-pulse' : ''}`} />
            </button>
            
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Say "lolo" followed by your message...'
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:border-blue-400 transition-colors"
            />
            
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors"
              aria-label="Send message"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
          
          <div className="mt-2 text-xs text-white/50 text-center">
            Wake word "lolo" is automatically added if not present
          </div>
        </form>
      </div>
    </div>
  );
}