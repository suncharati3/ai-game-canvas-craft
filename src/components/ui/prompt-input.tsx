
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight } from "lucide-react";

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isProcessing?: boolean;
  placeholder?: string;
}

export function PromptInput({ onSubmit, isProcessing = false, placeholder = "Describe your game idea..." }: PromptInputProps) {
  const [prompt, setPrompt] = useState("");
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isProcessing) {
      onSubmit(prompt.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-2">
      <div className="relative w-full">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder}
          disabled={isProcessing}
          className="pr-24 bg-secondary text-lg py-6 border-slate-700"
        />
        <Button 
          type="submit"
          disabled={!prompt.trim() || isProcessing}
          className="absolute right-1 top-1 bottom-1"
          variant="default"
        >
          {isProcessing ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              <span className="text-sm">Processing</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm">Create</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          )}
        </Button>
      </div>
    </form>
  );
}
