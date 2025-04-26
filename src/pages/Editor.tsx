import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AIGeneration } from "@/components/editor/ai-generation";
import { EditorHeader } from "@/components/editor/editor-header";
import { EditorLayout } from "@/components/editor/editor-layout";
import { useProject } from "@/hooks/useProject";
import { generateGame, buildGame, improveGame, getGameLogs } from "@/services/ai-service";

// Add JSZip dependency


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
  const projectId = searchParams.get('project');
  const navigate = useNavigate();
  const { project, isLoading, saveProject } = useProject(projectId);
  
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isRunning, setIsRunning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [gameCode, setGameCode] = useState<string>("");
  
  // New state for the editor features
  const [jobId, setJobId] = useState<string | null>(null);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!projectId) {
      toast.error("No project selected. Redirecting to projects page...");
      navigate("/projects");
      return;
    }
  }, [projectId, navigate]);
  
  useEffect(() => {
    if (project?.game_code) {
      setGameCode(project.game_code);
    }
  }, [project]);
  
  const handleToggleRunning = () => {
    setIsRunning(prevState => !prevState);
    if (!isRunning) {
      toast.success("Game preview started!");
    }
  };
  
  const handleSaveProject = async () => {
    try {
      setIsSaving(true);
      await saveProject({
        game_code: gameCode
      });
      setIsSaving(false);
    } catch (error: any) {
      setIsSaving(false);
      toast.error(`Failed to save project: ${error.message}`);
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
      // If we have a jobId, treat this as an improve request
      if (jobId) {
        await improveGame(jobId, message);
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: "I'm working on improving your game with that request. You'll see updates in the logs below.",
          isUser: false,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, aiMessage]);
        
        // Start polling for logs
        pollLogs(jobId);
      } else {
        // Treat as a normal message
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
      toast.error("No game has been generated yet.");
      return;
    }
    
    try {
      setIsBuilding(true);
      setBuildLogs(prev => [...prev, "Starting build process..."]);
      
      const response = await buildGame(jobId);
      
      // Start polling for logs
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
      toast.error("No game has been generated yet.");
      return;
    }
    
    try {
      setIsProcessing(true);
      toast.info("AI is analyzing the error and fixing the code...");
      
      await improveGame(jobId, `Fix this error: ${errorMessage}`);
      
      // Start polling for logs
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
  
  // Function to poll for logs
  const pollLogs = useCallback(async (jobId: string) => {
    let active = true;
    
    const checkLogs = async () => {
      if (!active) return;
      
      try {
        const response = await getGameLogs(jobId);
        if (response.logs) {
          setBuildLogs(response.logs);
        }
        
        // Poll again after a short delay
        setTimeout(checkLogs, 2000);
      } catch (error) {
        console.error("Error polling logs:", error);
        // Still retry after error
        setTimeout(checkLogs, 5000);
      }
    };
    
    checkLogs();
    
    // Return cleanup function
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
  
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading project...</div>;
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <EditorHeader
        onSave={handleSaveProject}
        onCodeView={() => setActiveTab("code")}
        onSettingsView={() => setActiveTab("settings")}
        onFilesView={() => setActiveTab("files")}
        isSaving={isSaving}
        activeTab={activeTab}
      />
      
      {/* If we don't have a jobId yet, show the generation UI */}
      {!jobId ? (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 p-4">
          <div className="md:col-span-8 h-[calc(100vh-130px)]">
            <div className="flex flex-col h-full">
              <div className="flex-1 glass-panel p-6">
                <h1 className="text-2xl font-bold mb-6">Create Your Game</h1>
                <p className="mb-8">
                  Enter a description of the game you want to create. Our AI will generate a playable game based on your description.
                </p>
                
                <AIGeneration onGenerate={async (prompt) => {
                  try {
                    const response = await generateGame(prompt);
                    setJobId(response.jobId);
                    if (response.download) {
                      setZipUrl(response.download);
                    }
                    toast.success("Game generated successfully!");
                    
                    // Add AI message
                    const aiMessage: Message = {
                      id: Date.now().toString(),
                      content: "I've generated your game! You can now explore the files, make edits, and run the game to see it in action.",
                      isUser: false,
                      timestamp: new Date()
                    };
                    
                    setMessages(prev => [...prev, aiMessage]);
                  } catch (error: any) {
                    toast.error(error.message);
                  }
                }} />
              </div>
            </div>
          </div>
          
          <div className="md:col-span-4 h-[calc(100vh-130px)]">
            {/* Chat interface for initial prompting */}
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
        // Show editor layout if we have a jobId
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
          />
        </div>
      )}
    </div>
  );
};

export default Editor;
