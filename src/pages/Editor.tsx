
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AIGeneration } from "@/components/editor/ai-generation";
import { EditorHeader } from "@/components/editor/editor-header";
import { EditorLayout } from "@/components/editor/editor-layout";
import { ChatInterface } from "@/components/editor/chat-interface";
import { generateGame, buildGame, improveGame, getGameLogs } from "@/services/ai-service";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

const initialMessages: Message[] = [
  {
    id: "1",
    content: "Welcome to the Game Editor! I'll help you build your game.",
    isUser: false,
    timestamp: new Date()
  },
  {
    id: "2",
    content: "I've generated a basic game with WASD movement controls. Try running it and then you can ask me to make changes.",
    isUser: false,
    timestamp: new Date()
  }
];

const Editor = () => {
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId');
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isRunning, setIsRunning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [gameCode, setGameCode] = useState<string>("");
  
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempts, setLoadAttempts] = useState(0);
  
  useEffect(() => {
    if (!jobId) {
      toast.error("No job ID found. Redirecting to home page...");
      navigate("/");
      return;
    }

    const initializeEditor = async () => {
      try {
        setBuildLogs(prev => [...prev, `Initializing editor with job ID: ${jobId}`]);
        
        // Try multiple methods to get the ZIP file
        let zipUrl = null;
        let method = '';
        
        // Method 1: Try to get a signed URL from Supabase
        try {
          const { data: signedData, error: signedError } = await supabase.storage
            .from('game-builds')
            .createSignedUrl(`${jobId}.zip`, 3600);
          
          if (signedData && !signedError) {
            setBuildLogs(prev => [...prev, `Method 1: Got signed URL for ${jobId}.zip`]);
            zipUrl = signedData.signedUrl;
            method = 'signed-url';
          } else {
            console.warn('Method 1 failed:', signedError);
          }
        } catch (err) {
          console.warn('Method 1 error:', err);
        }
        
        // Method 2: Try the Supabase function if Method 1 failed
        if (!zipUrl) {
          try {
            const { data: funcData, error: funcError } = await supabase.functions.invoke('generate-game/download', {
              body: { jobId }
            });
            
            if (funcData && funcData.download && !funcError) {
              setBuildLogs(prev => [...prev, `Method 2: Got download URL from function: ${funcData.download}`]);
              zipUrl = funcData.download;
              method = 'edge-function';
            } else {
              console.warn('Method 2 failed:', funcError);
            }
          } catch (err) {
            console.warn('Method 2 error:', err);
          }
        }
        
        // Method 3: Last resort, use direct download path
        if (!zipUrl) {
          const directUrl = `/download/${jobId}`;
          setBuildLogs(prev => [...prev, `Method 3: Using direct download URL: ${directUrl}`]);
          zipUrl = directUrl;
          method = 'direct-path';
        }
        
        setBuildLogs(prev => [...prev, `Using ${method} to download ZIP: ${zipUrl}`]);
        setZipUrl(zipUrl);
        
        const aiMessage: Message = {
          id: Date.now().toString(),
          content: `Your game project is ready! You can now explore the files and build your game.`,
          isUser: false,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, aiMessage]);
        
      } catch (error: any) {
        toast.error(`Failed to initialize editor: ${error.message}`);
      }
    };
    
    initializeEditor();
  }, [jobId, navigate, loadAttempts]);
  
  // If we encounter a ZIP loading error, retry with a different method
  useEffect(() => {
    if (error && error.includes("Invalid ZIP format") && loadAttempts < 3) {
      const timer = setTimeout(() => {
        setBuildLogs(prev => [...prev, `Retrying ZIP download (attempt ${loadAttempts + 1})...`]);
        setError(null);
        setZipUrl(null);
        setLoadAttempts(prev => prev + 1);
      }, 2000); // Wait 2 seconds before retrying
      
      return () => clearTimeout(timer);
    }
  }, [error, loadAttempts]);
  
  const handleToggleRunning = () => {
    setIsRunning(prevState => !prevState);
    if (!isRunning) {
      toast.success("Game preview started!");
    }
  };
  
  const handleSendMessage = async (message: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    try {
      if (jobId) {
        await improveGame(jobId, message);
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: "I'm working on improving your game with that request. You'll see updates in the logs below.",
          isUser: false,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, aiMessage]);
        
        pollLogs(jobId);
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: `I'll implement your request: "${message}". For now, this is a demo with pre-built responses.`,
          isUser: false,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      toast.error("Failed to process your request. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleRunBuild = async () => {
    if (!jobId) {
      toast.error("No job ID available.");
      return;
    }
    
    try {
      setIsBuilding(true);
      setBuildLogs(prev => [...prev, "Starting build process..."]);
      
      const response = await buildGame(jobId);
      
      pollLogs(jobId);
      
      if (response.preview) {
        setPreviewUrl(response.preview);
        toast.success("Build completed successfully!");
      }
    } catch (error: any) {
      toast.error(`Build failed: ${error.message}`);
      setBuildLogs(prev => [...prev, `Error: ${error.message}`]);
    } finally {
      setIsBuilding(false);
    }
  };
  
  const handleFixWithAI = async (errorMessage: string) => {
    if (!jobId) {
      toast.error("No job ID available.");
      return;
    }
    
    try {
      setIsProcessing(true);
      toast.info("AI is analyzing the error and fixing the code...");
      
      await improveGame(jobId, `Fix this error: ${errorMessage}`);
      
      pollLogs(jobId);
      
      const aiMessage: Message = {
        id: Date.now().toString(),
        content: "I'm working on fixing the error. You'll see updates in the logs below.",
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      toast.error(`Failed to fix error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const pollLogs = useCallback(async (jobId: string) => {
    let active = true;
    
    const checkLogs = async () => {
      if (!active) return;
      
      try {
        const response = await getGameLogs(jobId);
        if (response.logs) {
          setBuildLogs(response.logs);
        }
        
        setTimeout(checkLogs, 2000);
      } catch (error) {
        console.error("Error polling logs:", error);
        setTimeout(checkLogs, 5000);
      }
    };
    
    checkLogs();
    
    return () => {
      active = false;
    };
  }, []);
  
  const handleIframeError = (error: { message: string, filename: string, lineno: number }) => {
    const errorMessage = `${error.message} at ${error.filename}:${error.lineno}`;
    setError(errorMessage);
    setBuildLogs(prev => [...prev, `Error detected: ${errorMessage}`]);
    toast.error("Game error detected. You can use 'Fix with AI' to attempt a repair.");
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <EditorHeader
        onSave={() => toast.info("Saving is automatic in this editor")}
        onCodeView={() => setActiveTab("code")}
        onSettingsView={() => setActiveTab("settings")}
        onFilesView={() => setActiveTab("files")}
        isSaving={isSaving}
        activeTab={activeTab}
      />
      
      {!zipUrl ? (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 p-4">
          <div className="md:col-span-8 h-[calc(100vh-130px)]">
            <div className="flex flex-col h-full">
              <div className="flex-1 glass-panel p-6">
                <h1 className="text-2xl font-bold mb-6">Loading Your Game</h1>
                <p className="mb-8">
                  Please wait while we set up your game project...
                </p>
                
                <div className="flex items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="md:col-span-4 h-[calc(100vh-130px)]">
            <div className="flex flex-col h-full">
              <ChatInterface
                onSendMessage={handleSendMessage}
                isProcessing={isProcessing}
                messages={messages}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <EditorLayout
            jobId={jobId}
            zipUrl={zipUrl}
            previewUrl={previewUrl}
            error={error}
            onRunBuild={handleRunBuild}
            onFixWithAI={handleFixWithAI}
            isBuilding={isBuilding}
            buildLogs={buildLogs}
            onError={handleIframeError}
          />
        </div>
      )}
    </div>
  );
};

export default Editor;
