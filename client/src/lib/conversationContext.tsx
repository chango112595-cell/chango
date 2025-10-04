import { createContext, useContext, useState, ReactNode } from "react";

export interface Message {
  id: string;
  text: string;
  sender: "user" | "chango";
  timestamp: Date;
}

interface ConversationContextType {
  messages: Message[];
  addMessage: (message: Message) => void;
  addUserMessage: (text: string) => Message;
  addChangoMessage: (text: string) => Message;
  clearMessages: () => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export function useConversation() {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error("useConversation must be used within ConversationProvider");
  }
  return context;
}

export function ConversationProvider({ children }: { children: ReactNode }) {
  // Always start with a fresh welcome message on mount to prevent accumulation
  const [messages, setMessages] = useState<Message[]>(() => {
    // Create fresh welcome message with unique timestamp
    return [
      {
        id: `welcome-${Date.now()}`,
        text: "Hey there! I'm Chango, your AI companion. What would you like to explore today?",
        sender: "chango",
        timestamp: new Date(),
      },
    ];
  });

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const addUserMessage = (text: string): Message => {
    const message: Message = {
      id: `user-${Date.now()}`,
      text,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, message]);
    return message;
  };

  const addChangoMessage = (text: string): Message => {
    const message: Message = {
      id: `chango-${Date.now()}`,
      text,
      sender: "chango",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, message]);
    return message;
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <ConversationContext.Provider
      value={{
        messages,
        addMessage,
        addUserMessage,
        addChangoMessage,
        clearMessages,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}