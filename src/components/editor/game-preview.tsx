
import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Square } from "lucide-react";

interface GamePreviewProps {
  isRunning: boolean;
  onToggleRunning: () => void;
  previewCode?: string;
  previewUrl?: string;
  onError?: (error: { message: string, filename: string, lineno: number }) => void;
}

export function GamePreview({ 
  isRunning, 
  onToggleRunning,
  previewCode,
  previewUrl,
  onError
}: GamePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  useEffect(() => {
    if (!isRunning || !iframeRef.current) return;

    // Setup error handling
    const iframe = iframeRef.current;
    const handleError = (event: ErrorEvent) => {
      console.log("Game error:", event);
      if (onError) {
        onError({
          message: event.message,
          filename: event.filename || 'unknown',
          lineno: event.lineno || 0
        });
      }
    };

    // Inject code if we have previewCode but no URL
    if (previewCode && !previewUrl) {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(previewCode);
        
        // Add error handler to iframe window
        if (iframe.contentWindow) {
          iframe.contentWindow.onerror = handleError;
          
          // Override console.error
          const originalConsoleError = iframe.contentWindow.console.error;
          iframe.contentWindow.console.error = (...args) => {
            originalConsoleError.apply(iframe.contentWindow?.console, args);
            
            // Format as error event for our handler
            const errorMsg = args.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            
            if (onError) {
              onError({
                message: `Console error: ${errorMsg}`,
                filename: 'console',
                lineno: 0
              });
            }
          };
        }
        
        iframeDoc.close();
      }
    }
    
    // Add error listener to the iframe if using URL
    if (iframe.contentWindow && previewUrl) {
      iframe.contentWindow.onerror = handleError;
    }

    return () => {
      // Clean up event listeners
      if (iframe.contentWindow) {
        iframe.contentWindow.onerror = null;
        if (iframe.contentWindow.console && iframe.contentWindow.console.error) {
          // Restore original console.error if possible
          delete iframe.contentWindow.console.error;
        }
      }
    };
  }, [isRunning, previewCode, previewUrl, onError]);
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 p-2">
        <h2 className="text-lg font-semibold">Game Preview</h2>
        <div className="flex gap-2">
          <Button 
            onClick={onToggleRunning} 
            variant={isRunning ? "outline" : "default"}
            className={isRunning ? "border-game-accent text-game-accent" : "game-gradient"}
            size="sm"
          >
            {isRunning ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Stop</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Run</span>
              </>
            )}
          </Button>
        </div>
      </div>
      
      <div className="flex-1 glass-panel p-0 overflow-hidden rounded-lg">
        {isRunning ? (
          <iframe
            ref={iframeRef}
            className="w-full h-full border-none"
            sandbox="allow-scripts"
            title="Game Preview"
            src={previewUrl}
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
