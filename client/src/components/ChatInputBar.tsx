/**
 * Chat Input Bar Component
 * Sticky bottom input with safe-area support for mobile
 */

import { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { voiceGate } from '../core/gate';
import { orchestrator } from '../core/orchestrator';
import { responder } from '../services/responder';
import { debugBus } from '../dev/debugBus';

interface ChatInputBarProps {
  className?: string;
  placeholder?: string;
  onSubmit?: (text: string) => void;
  initializeWithGesture?: (() => Promise<boolean>) | null;
}

export function ChatInputBar({ 
  className = '',
  placeholder = 'Type a message or tap mic to speak...',
  onSubmit,
  initializeWithGesture
}: ChatInputBarProps) {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Monitor gate status
  useEffect(() => {
    const updateGateStatus = () => {
      const status = voiceGate.getStatus();
      setGateOpen(status.isOpen);
    };
    
    updateGateStatus();
    
    const unsubscribe = voiceGate.onStateChange(() => {
      updateGateStatus();
    });
    
    return unsubscribe;
  }, []);
  
  // Handle text submission
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    const text = inputText.trim();
    if (!text || isProcessing) return;
    
    setIsProcessing(true);
    debugBus.info('ChatInputBar', 'text_submit', { textLength: text.length });
    
    try {
      // Clear input immediately for better UX
      setInputText('');
      
      // Route through orchestrator
      const decision = await orchestrator.routeMessage({
        text,
        source: 'text'
      });
      
      if (decision.shouldProcess) {
        // Process the message
        await orchestrator.processMessage({
          text,
          source: 'text'
        }, decision);
        
        // Get response from responder (only if response type is not 'none')
        if (decision.responseType !== 'none') {
          await responder.respond(text, {
            source: 'text',
            responseType: decision.responseType as 'voice' | 'text' | 'both'
          });
        }
      }
      
      // Call custom onSubmit if provided
      onSubmit?.(text);
    } catch (error) {
      debugBus.error('ChatInputBar', 'submit_error', { error: String(error) });
    } finally {
      setIsProcessing(false);
      
      // Refocus input for continuous typing
      inputRef.current?.focus();
    }
  };
  
  // Handle mic button click
  const handleMicClick = async () => {
    debugBus.info('ChatInputBar', 'mic_clicked', { gateOpen });
    
    if (!gateOpen) {
      // For iOS: Use initializeWithGesture if available, otherwise tryOpenGate
      let opened = false;
      
      if (initializeWithGesture) {
        // iOS Safari needs this for first-time mic permission
        opened = await initializeWithGesture();
        debugBus.info('ChatInputBar', 'initialized_with_gesture', { success: opened });
      }
      
      // If initialization didn't work or wasn't available, try opening gate directly
      if (!opened) {
        opened = await orchestrator.tryOpenGate();
      }
      
      if (opened) {
        setIsListening(true);
        debugBus.info('ChatInputBar', 'gate_opened', {});
      } else {
        debugBus.warn('ChatInputBar', 'gate_open_failed', {});
      }
    } else {
      // Toggle listening state
      if (isListening) {
        voiceGate.close('user_toggle');
        setIsListening(false);
      } else {
        setIsListening(true);
      }
    }
  };
  
  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter to submit (without shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    
    // Escape to clear
    if (e.key === 'Escape') {
      setInputText('');
      inputRef.current?.blur();
    }
  };
  
  return (
    <div className={`chat-input-bar ${className}`} data-testid="chat-input-bar">
      <form 
        ref={formRef}
        onSubmit={handleSubmit}
        className="chat-input-form"
      >
        <div className="input-wrapper">
          {/* Mic Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleMicClick}
            disabled={isProcessing}
            className={`mic-button ${isListening ? 'listening' : ''}`}
            data-testid="button-mic"
          >
            {isListening ? (
              <Mic className="w-5 h-5 text-red-500 animate-pulse" />
            ) : (
              <MicOff className="w-5 h-5 text-gray-500" />
            )}
          </Button>
          
          {/* Text Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isProcessing}
            className="chat-input"
            data-testid="input-chat"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          
          {/* Submit Button */}
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            disabled={!inputText.trim() || isProcessing}
            className="submit-button"
            data-testid="button-submit"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </form>
      
      {/* Safe area padding for mobile */}
      <div className="safe-area-padding" />
    </div>
  );
}