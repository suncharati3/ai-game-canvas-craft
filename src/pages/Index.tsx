
import React, { useState } from "react";
import { PromptInput } from "@/components/ui/prompt-input";
import { DiagramPlan } from "@/components/diagrams/diagram-plan";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { generateGame } from "@/services/ai-service";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [diagram, setDiagram] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const navigate = useNavigate();

  const handlePromptSubmit = async (inputPrompt: string) => {
    setIsProcessing(true);
    setPrompt(inputPrompt);
    setError(null);
    
    try {
      // Use the AI service to generate the diagram and get a job ID
      const response = await generateGame(inputPrompt);
      setJobId(response.jobId);
      
      // For now, we'll create a formatted diagram based on the prompt
      // In a production app, this would come from the AI service response
      const generatedDiagram = `# Game Architecture Diagram for: "${inputPrompt}"

## Game Structure
- Main Scene
  - Player Controller
  - Camera System
  - World Environment
- Game Systems
  - Physics Engine
  - Input Controller
  - Audio Manager
  - UI Manager
- Assets
  - 3D Models
  - Textures
  - Audio Files
  - UI Elements

## Component Relationships
Player Controller <---> Physics Engine
Camera System <---> Player Controller
UI Manager <---> Game State
Audio Manager <---> Game Events

## Data Flow
1. Input Controller captures user input
2. Player Controller processes input
3. Physics Engine updates game state
4. World Environment responds to changes
5. UI Manager updates display
6. Audio Manager plays corresponding sounds

## Technical Implementation
- Use Three.js for 3D rendering
- Implement component-based architecture
- Use event system for decoupled communication
- Implement state management for game progression
- Utilize asset preloading for performance optimization`;
      
      setDiagram(generatedDiagram);
      toast.success("Game plan generated successfully!");
    } catch (error) {
      console.error("Error generating game:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      toast.error("Failed to generate game. See details below.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    handlePromptSubmit(prompt);
  };

  const handleApproveDiagram = async () => {
    setIsApproving(true);
    try {
      toast.success("Plan approved! Redirecting to editor...");
      
      // Pass the job ID to the editor
      setTimeout(() => {
        navigate(`/editor?jobId=${jobId}`);
      }, 1000);
    } catch (error) {
      toast.error("Failed to approve plan. Please try again.");
      console.error("Error approving plan:", error);
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Bar */}
      <NavigationBar />
      
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center p-8 py-16 text-center">
        <h1 className="text-5xl md:text-6xl font-bold game-gradient-text mb-6 animate-fade-in">
          AI Game Creator
        </h1>
        <p className="text-xl mb-12 max-w-2xl text-slate-300 animate-fade-in">
          Create interactive 3D and 2D games just by describing your idea.
          Our AI handles the code, assets, and logic.
        </p>
        
        {!diagram && (
          <div className="w-full max-w-2xl animate-fade-in">
            <PromptInput 
              onSubmit={handlePromptSubmit} 
              isProcessing={isProcessing}
              placeholder="Describe your game idea, e.g. 'A 3D platformer with jumping mechanics'"
            />
            
            {error && (
              <div className="mt-4">
                <Alert variant="destructive">
                  <AlertTitle>Error generating game</AlertTitle>
                  <AlertDescription className="text-left">
                    <p className="mb-2">{error}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleRetry}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Try Again
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Diagram Section */}
      {diagram && (
        <div className="flex-1 p-6 max-w-6xl mx-auto w-full animate-fade-in">
          <DiagramPlan 
            diagram={diagram} 
            onApprove={handleApproveDiagram}
            isApproving={isApproving}
          />
        </div>
      )}
      
      {/* Footer */}
      <footer className="p-6 text-center text-sm text-slate-500">
        <p>AI Game Creator - Powered by Three.js and GPT</p>
      </footer>
    </div>
  );
};

export default Index;
