
import React from "react";
import { Button } from "@/components/ui/button";
import { 
  Save, 
  Code, 
  Settings,
  FileText,
  LayoutGrid
} from "lucide-react";

interface ControlPanelProps {
  onSave: () => void;
  onCodeView: () => void;
  onSettingsView: () => void;
  onFilesView: () => void;
  onDashboardView: () => void;
  isSaving?: boolean;
  activeTab?: string;
}

export function ControlPanel({
  onSave,
  onCodeView,
  onSettingsView,
  onFilesView,
  onDashboardView,
  isSaving = false,
  activeTab = "dashboard"
}: ControlPanelProps) {
  return (
    <div className="glass-panel p-4">
      <div className="flex flex-col gap-3">
        <Button
          onClick={onDashboardView}
          variant={activeTab === "dashboard" ? "default" : "outline"}
          className={activeTab === "dashboard" ? "game-gradient" : ""}
          size="sm"
        >
          <LayoutGrid className="h-4 w-4 mr-2" />
          Dashboard
        </Button>
        
        <Button
          onClick={onFilesView}
          variant={activeTab === "files" ? "default" : "outline"}
          className={activeTab === "files" ? "game-gradient" : ""}
          size="sm"
        >
          <FileText className="h-4 w-4 mr-2" />
          Files
        </Button>
        
        <Button
          onClick={onCodeView}
          variant={activeTab === "code" ? "default" : "outline"}
          className={activeTab === "code" ? "game-gradient" : ""}
          size="sm"
        >
          <Code className="h-4 w-4 mr-2" />
          Code
        </Button>
        
        <Button
          onClick={onSettingsView}
          variant={activeTab === "settings" ? "default" : "outline"}
          className={activeTab === "settings" ? "game-gradient" : ""}
          size="sm"
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
        
        <div className="mt-auto pt-4 border-t border-slate-800">
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="w-full game-gradient"
            size="sm"
          >
            {isSaving ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                <span>Saving</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                <span>Save Project</span>
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
