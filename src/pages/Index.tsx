
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AIGeneration } from "@/components/editor/ai-generation";
import { ensureStorageBucketExists } from "@/services/storage-service";
import { generateGame, getGameLogs } from "@/services/ai-service";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

const Index = () => {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);
  const [storageBucketReady, setStorageBucketReady] = useState<boolean>(false);
  
  // Initialize storage bucket when the app starts
  useEffect(() => {
    const initializeStorage = async () => {
      try {
        // Try multiple times in case of network issues
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const result = await ensureStorageBucketExists();
            if (result) {
              console.log("Storage bucket initialized successfully");
              setStorageBucketReady(true);
              break;
            } else {
              console.warn(`Failed to initialize storage bucket (attempt ${attempt + 1})`);
              if (attempt < 2) {
                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
              }
            }
          } catch (retryErr) {
            console.error(`Error initializing storage (attempt ${attempt + 1}):`, retryErr);
            if (attempt < 2) {
              // Wait a bit before retrying
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
          }
        }
      } catch (err) {
        console.error("Error initializing storage:", err);
        toast.error("Could not initialize storage. Some features may not work correctly.");
      }
    };
    
    initializeStorage();
  }, []);
  
  const handleGenerateGame = async (prompt: string) => {
    setIsGenerating(true);
    setGenerationLogs([`Starting generation with prompt: "${prompt}"...`]);
    
    try {
      const response = await generateGame(prompt);
      
      // Poll for logs to show progress
      if (response.jobId) {
        pollLogs(response.jobId);
      }
      
      // Navigate to the editor with the job ID
      setTimeout(() => {
        navigate(`/editor?jobId=${response.jobId}`);
      }, 1000);
      
    } catch (error: any) {
      toast.error(error.message || "Failed to generate game");
      setGenerationLogs(prev => [...prev, `Error: ${error.message}`]);
      setIsGenerating(false);
    }
  };
  
  const pollLogs = async (jobId: string) => {
    let active = true;
    let attempts = 0;
    
    const checkLogs = async () => {
      if (!active) return;
      
      try {
        const response = await getGameLogs(jobId);
        if (response.logs) {
          setGenerationLogs(response.logs);
        }
        
        attempts++;
        
        if (attempts < 30) {  // Poll for up to 30*2s = 1 minute
          setTimeout(checkLogs, 2000);
        } else {
          setIsGenerating(false);
        }
      } catch (error) {
        console.error("Error polling logs:", error);
        
        // Add error to logs but continue polling
        setGenerationLogs(prev => [...prev, `Error retrieving logs: ${error instanceof Error ? error.message : String(error)}`]);
        
        if (attempts < 30) {
          setTimeout(checkLogs, 5000); // Longer delay on error
        } else {
          setIsGenerating(false);
        }
      }
    };
    
    checkLogs();
    
    return () => {
      active = false;
    };
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 container max-w-screen-xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="md:w-1/2">
            <h1 className="text-4xl font-bold mb-4">AI Game Creator</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Create your own games using AI. Just describe what you want, and our AI will generate a playable game for you.
            </p>
            
            <div className="glass-panel p-6 mb-8">
              {!storageBucketReady && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-yellow-800">Initializing storage... Some features may be limited until this completes.</p>
                </div>
              )}
              
              <AIGeneration onGenerate={handleGenerateGame} />
              
              {isGenerating && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">Generation Progress</h3>
                  <div className="bg-secondary/50 rounded-md p-4 h-64 overflow-y-auto font-mono text-sm">
                    {generationLogs.map((log, index) => (
                      <div key={index} className="mb-1">
                        {log}
                      </div>
                    ))}
                    {isGenerating && (
                      <div className="flex items-center mt-2">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-primary mr-2"></div>
                        <span>Processing...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-4">
              <Button 
                onClick={() => navigate("/projects")}
                variant="outline" 
                size="lg"
              >
                Browse Your Projects
              </Button>
            </div>
          </div>
          
          <div className="md:w-1/2">
            <div className="glass-panel p-6 h-full">
              <h2 className="text-2xl font-bold mb-4">How It Works</h2>
              <ol className="list-decimal pl-4 space-y-4">
                <li className="text-lg">
                  <span className="font-semibold">Describe your game idea</span>
                  <p className="text-muted-foreground mt-1">Tell our AI what type of game you want to create. Be as descriptive as possible.</p>
                </li>
                <li className="text-lg">
                  <span className="font-semibold">AI generates your game</span>
                  <p className="text-muted-foreground mt-1">Our advanced AI will create a playable game based on your description.</p>
                </li>
                <li className="text-lg">
                  <span className="font-semibold">Customize and edit</span>
                  <p className="text-muted-foreground mt-1">Use our editor to make changes and further customize your game.</p>
                </li>
                <li className="text-lg">
                  <span className="font-semibold">Play and share</span>
                  <p className="text-muted-foreground mt-1">Play your game directly in the browser and share it with others.</p>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
