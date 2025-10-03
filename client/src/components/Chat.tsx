import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User } from "lucide-react";
import { voiceBus } from "@/voice/voiceBus";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSpeechCoordination } from "@/lib/speechCoordination";
import { useConversation } from "@/lib/conversationContext";

export default function Chat() {
  const { messages, addUserMessage, addLoloMessage } = useConversation();
  // Removed inputValue - input is now handled by the global AskBar
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  // Removed inputRef - no longer needed
  
  // Initialize speech coordination
  const speechCoordination = useSpeechCoordination();
  
  // Listen for user text submissions from the AskBar
  useEffect(() => {
    const unsubscribeUser = voiceBus.on('userTextSubmitted', (event) => {
      if (event.text) {
        console.log('[Chat] Received user text from AskBar:', event.text);
        addUserMessage(event.text);
        setIsTyping(true);
        
        // Mark chat as active
        speechCoordination.setChatActive(true);
        speechCoordination.setLastChatActivity(Date.now());
      }
    });
    
    return () => {
      unsubscribeUser();
    };
  }, [addUserMessage, speechCoordination]);
  
  // Listen for Lolo responses from the conversation engine
  useEffect(() => {
    const unsubscribe = voiceBus.on('loloResponse', (event) => {
      if (event.text) {
        console.log('[Chat] Received Lolo response:', event.text);
        addLoloMessage(event.text);
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
  }, [addLoloMessage]);

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
    mutationFn: async (data: { userMessage: string; loloResponse: string }) => {
      return apiRequest("POST", "/api/curiosity/log", {
        trigger: "chat_conversation",
        response: data.loloResponse,
        context: {
          userMessage: data.userMessage,
          timestamp: new Date().toISOString(),
        },
      });
    },
  });
  
  // Removed handleSendMessage and handleKeyPress - input is now handled by the global AskBar

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
          Chat with Lolo
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
        
        {/* Input has been moved to the global AskBar at the bottom of the screen */}
        {/* Only show speaking status indicator when Lolo is speaking */}
        {isSpeaking && (
          <div className="border-t border-border px-6 py-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Lolo is speaking...</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}