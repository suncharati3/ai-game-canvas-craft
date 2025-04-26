
import React from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface DiagramPlanProps {
  diagram: string;
  onApprove: () => void;
  isApproving?: boolean;
}

export function DiagramPlan({ 
  diagram, 
  onApprove,
  isApproving = false
}: DiagramPlanProps) {
  return (
    <div className="w-full flex flex-col gap-4 p-2">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold">Project Architecture Diagram</h2>
        <Button 
          onClick={onApprove} 
          disabled={isApproving}
          className="game-gradient"
        >
          {isApproving ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              <span>Processing</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span>Approve Plan</span>
            </div>
          )}
        </Button>
      </div>
      
      <div className="glass-panel p-6 overflow-auto max-h-[70vh]">
        <pre className="code-font text-sm whitespace-pre-wrap overflow-x-auto">
          {diagram}
        </pre>
      </div>
    </div>
  );
}
