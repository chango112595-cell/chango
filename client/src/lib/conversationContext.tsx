import { createContext, useContext, useState, ReactNode } from "react";

export interface Message {
  id: string;
  text: string;
  sender: "user" | "lolo";
  timestamp: Date;
}

interface ConversationContextType {
  messages: Message[];
  addMessage: (message: Message) => void;
  addUserMessage: (text: string) => Message;
  addLoloMessage: (text: string) => Message;
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Hey there! I'm Lolo, your AI companion. What would you like to explore today?",
      sender: "lolo",
      timestamp: new Date(),
    },
  ]);

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

  const addLoloMessage = (text: string): Message => {
    const message: Message = {
      id: `lolo-${Date.now()}`,
      text,
      sender: "lolo",
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
        addLoloMessage,
        clearMessages,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}