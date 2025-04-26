
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";

interface AIGenerationProps {
  onGenerate: (prompt: string) => Promise<void>;
}

export function AIGeneration({ onGenerate }: AIGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState("");

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a game description");
      return;
    }

    setIsGenerating(true);
    try {
      await onGenerate(prompt);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">AI Game Generation</h3>
      <div className="flex gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your game idea..."
          disabled={isGenerating}
        />
        <Button 
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
        >
          {isGenerating ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
