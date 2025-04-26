
import React, { useState } from "react";
import { PromptInput } from "@/components/ui/prompt-input";
import { DiagramPlan } from "@/components/diagrams/diagram-plan";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { supabase } from "@/integrations/supabase/client";

// Mock diagram generation
const generateDiagram = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`# Game Architecture Diagram for: "${prompt}"

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
- Utilize asset preloading for performance`);
    }, 2000);
  });
};

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [diagram, setDiagram] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const navigate = useNavigate();

  const handlePromptSubmit = async (inputPrompt: string) => {
    setIsProcessing(true);
    setPrompt(inputPrompt);
    
    try {
      // In a real app, this would call an API to generate the diagram
      const generatedDiagram = await generateDiagram(inputPrompt);
      setDiagram(generatedDiagram);
      toast.success("Diagram generated successfully!");
    } catch (error) {
      toast.error("Failed to generate diagram. Please try again.");
      console.error("Error generating diagram:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveDiagram = async () => {
    setIsApproving(true);
    try {
      // In a real app, this would start the code generation process
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success("Plan approved! Redirecting to editor...");
      
      // Store the prompt and diagram in session storage for the editor
      sessionStorage.setItem("gamePrompt", prompt);
      sessionStorage.setItem("gameDiagram", diagram || "");
      
      // Navigate to the editor page
      setTimeout(() => {
        navigate("/editor");
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
