/**
 * AskBar Component
 * Text input interface that emits userTextSubmitted events via VoiceBus
 */

import { useState, useRef, KeyboardEvent } from 'react';
import { voiceBus } from '../voice/voiceBus';
import { Send, MessageCircle, Loader2 } from 'lucide-react';

interface AskBarProps {
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
  showIcon?: boolean;
  onSubmit?: (text: string) => void; // Optional callback for parent components
  submitOnEnter?: boolean;
  showSubmitButton?: boolean;
  autoFocus?: boolean;
  clearAfterSubmit?: boolean;
}

export function AskBar({
  placeholder = "Ask anything...",
  maxLength = 500,
  disabled = false,
  className = "",
  showIcon = true,
  onSubmit,
  submitOnEnter = true,
  showSubmitButton = true,
  autoFocus = false,
  clearAfterSubmit = true,
}: AskBarProps) {
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle text submission
  const handleSubmit = async () => {
    // Validate input
    const text = inputText.trim();
    if (!text || text.length === 0 || isSubmitting || disabled) {
      return;
    }

    console.log('[AskBar] Submitting text:', text);
    
    // Set submitting state
    setIsSubmitting(true);

    try {
      // Emit userTextSubmitted event via VoiceBus
      voiceBus.emitUserText(text);
      
      // Call optional parent callback
      if (onSubmit) {
        onSubmit(text);
      }

      // Clear input if configured
      if (clearAfterSubmit) {
        setInputText('');
      }

      // Refocus input for continuous interaction
      if (inputRef.current && autoFocus) {
        inputRef.current.focus();
      }
    } catch (error) {
      console.error('[AskBar] Error submitting text:', error);
    } finally {
      // Reset submitting state
      setIsSubmitting(false);
    }
  };

  // Handle Enter key press
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (submitOnEnter && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Enforce max length
    if (maxLength && value.length > maxLength) {
      return;
    }
    
    setInputText(value);
  };

  return (
    <div className={`flex items-center gap-2 p-2 bg-background border rounded-lg shadow-sm ${className}`}>
      {/* Icon */}
      {showIcon && (
        <MessageCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      )}
      
      {/* Input field */}
      <input
        ref={inputRef}
        type="text"
        value={inputText}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isSubmitting}
        autoFocus={autoFocus}
        className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground px-2 py-1"
        aria-label="Ask input"
        data-testid="input-ask-text"
      />
      
      {/* Character count */}
      {maxLength && inputText.length > 0 && (
        <span className="text-xs text-muted-foreground">
          {inputText.length}/{maxLength}
        </span>
      )}
      
      {/* Submit button */}
      {showSubmitButton && (
        <button
          onClick={handleSubmit}
          disabled={disabled || isSubmitting || !inputText.trim()}
          className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Submit question"
          data-testid="button-ask-submit"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
}

// Minimal version for embedding in other components
export function AskBarMinimal({
  onSubmit,
  placeholder = "Type a message...",
  className = "",
}: {
  onSubmit?: (text: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    const trimmedText = text.trim();
    if (trimmedText) {
      voiceBus.emitUserText(trimmedText);
      if (onSubmit) {
        onSubmit(trimmedText);
      }
      setText('');
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder={placeholder}
        className="flex-1 px-3 py-1.5 bg-muted/50 rounded-md text-sm outline-none focus:ring-1 focus:ring-primary"
        data-testid="input-ask-minimal"
      />
      <button
        onClick={handleSubmit}
        disabled={!text.trim()}
        className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="button-ask-minimal-submit"
      >
        Ask
      </button>
    </div>
  );
}

// Floating version with glassmorphism effect
export function AskBarFloating({
  onSubmit,
  position = 'bottom',
  className = "",
}: {
  onSubmit?: (text: string) => void;
  position?: 'top' | 'bottom';
  className?: string;
}) {
  return (
    <div
      className={`
        fixed ${position === 'top' ? 'top-4' : 'bottom-4'}
        left-1/2 -translate-x-1/2
        w-full max-w-2xl px-4
        ${className}
      `}
      style={{ zIndex: 50 }}
    >
      <div className="backdrop-blur-md bg-background/80 rounded-lg shadow-lg border">
        <AskBar
          onSubmit={onSubmit}
          className="border-none shadow-none"
          showIcon={true}
          autoFocus={true}
          clearAfterSubmit={true}
        />
      </div>
    </div>
  );
}