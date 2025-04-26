
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatInterfaceProps {
  onSendMessage: (message: string) => void;
  isProcessing?: boolean;
  messages: Message[];
}

export function ChatInterface({
  onSendMessage,
  isProcessing = false,
  messages = []
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSendMessage(input.trim());
      setInput("");
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="p-2">
        <h2 className="text-lg font-semibold">Chat</h2>
      </div>
      
      <div className="flex-1 glass-panel overflow-y-auto p-4 mb-4">
        <div className="flex flex-col gap-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded-lg max-w-[80%] ${
                msg.isUser
                  ? "ml-auto bg-game-primary/20 border border-game-primary/30"
                  : "mr-auto bg-secondary border border-slate-700"
              }`}
            >
              <p>{msg.content}</p>
              <span className="text-xs text-muted-foreground mt-1 block">
                {msg.timestamp.toLocaleTimeString()}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="relative">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your instructions here..."
          disabled={isProcessing}
          className="pr-14 bg-secondary border-slate-700"
        />
        <Button
          type="submit"
          disabled={!input.trim() || isProcessing}
          className="absolute right-1 top-1 bottom-1 px-3"
          variant="ghost"
        >
          {isProcessing ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-game-primary border-t-transparent"></div>
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
