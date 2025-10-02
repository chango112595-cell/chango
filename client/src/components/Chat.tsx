import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User } from "lucide-react";
import { voiceBus } from "@/voice/voiceBus";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSpeechCoordination } from "@/lib/speechCoordination";
import { useConversation } from "@/lib/conversationContext";

export default function Chat() {
  const { messages, addUserMessage, addChangoMessage } = useConversation();
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Initialize speech coordination
  const speechCoordination = useSpeechCoordination();
  
  // Listen for Chango responses from the conversation engine
  useEffect(() => {
    const unsubscribe = voiceBus.on('changoResponse', (event) => {
      if (event.text) {
        console.log('[Chat] Received Chango response:', event.text);
        addChangoMessage(event.text);
        setIsTyping(false);
        
        // Track speaking state
        setIsSpeaking(true);
        setTimeout(() => {
          setIsSpeaking(false);
        }, 3000);
        
        // Clear chat active after a delay
        setTimeout(() => {
          speechCoordination.setChatActive(false);
        }, 5000);
      }
    });
    
    // Welcome message on mount
    speechCoordination.setChatActive(true);
    speechCoordination.setLastChatActivity(Date.now());
    
    // Clean up listener on unmount
    return () => {
      unsubscribe();
    };
  }, [addChangoMessage]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Log conversation to curiosity engine
  const logChatMutation = useMutation({
    mutationFn: async (data: { userMessage: string; changoResponse: string }) => {
      return apiRequest("POST", "/api/curiosity/log", {
        trigger: "chat_conversation",
        response: data.changoResponse,
        context: {
          userMessage: data.userMessage,
          timestamp: new Date().toISOString(),
        },
      });
    },
  });

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    const userMessage = inputValue.trim();
    
    // Add user message to UI
    addUserMessage(userMessage);
    setInputValue("");
    setIsTyping(true);
    
    // Mark chat as active
    speechCoordination.setChatActive(true);
    speechCoordination.setLastChatActivity(Date.now());
    
    console.log('[Chat] Emitting userTextSubmitted event:', userMessage);
    
    // Emit the message through voiceBus to be processed by the conversation engine
    voiceBus.emitUserText(userMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-accent" />
          Chat with Chango
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea ref={scrollAreaRef} className="flex-1 px-6 py-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`flex gap-2 max-w-[80%] ${
                    message.sender === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      message.sender === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent text-accent-foreground"
                    }`}
                  >
                    {message.sender === "user" ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div
                      className={`rounded-lg px-4 py-2 ${
                        message.sender === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                      data-testid={`message-${message.sender}-${message.id}`}
                    >
                      <p className="text-sm">{message.text}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 px-1">
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex gap-2 max-w-[80%]">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-accent text-accent-foreground">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                      <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                      <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="border-t border-border px-6 py-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                // Mark chat activity when user is typing
                if (e.target.value.trim()) {
                  speechCoordination.setLastChatActivity(Date.now());
                }
              }}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isTyping}
              className="flex-1"
              data-testid="input-chat-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              size="icon"
              data-testid="button-send-message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          {isSpeaking && (
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Chango is speaking...</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}