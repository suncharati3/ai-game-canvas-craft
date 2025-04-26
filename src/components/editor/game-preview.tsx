
import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Square } from "lucide-react";

interface GamePreviewProps {
  isRunning: boolean;
  onToggleRunning: () => void;
  previewCode: string;
}

export function GamePreview({ 
  isRunning, 
  onToggleRunning,
  previewCode
}: GamePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  useEffect(() => {
    if (isRunning && iframeRef.current) {
      // In a real implementation, we would securely inject the code into the iframe
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(previewCode);
        iframeDoc.close();
      }
    }
  }, [isRunning, previewCode]);
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 p-2">
        <h2 className="text-lg font-semibold">Game Preview</h2>
        <Button 
          onClick={onToggleRunning} 
          variant={isRunning ? "outline" : "default"}
          className={isRunning ? "border-game-accent text-game-accent" : "game-gradient"}
        >
          {isRunning ? (
            <div className="flex items-center gap-2">
              <Square className="h-4 w-4" />
              <span>Stop</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              <span>Run</span>
            </div>
          )}
        </Button>
      </div>
      
      <div className="flex-1 glass-panel p-0 overflow-hidden">
        {isRunning ? (
          <iframe
            ref={iframeRef}
            className="w-full h-full border-none"
            sandbox="allow-scripts"
            title="Game Preview"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Press Run to start the game preview</p>
          </div>
        )}
      </div>
    </div>
  );
}
