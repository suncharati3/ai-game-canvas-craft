
import React, { useState, useEffect, useMemo } from "react";
import { FileTree } from "./file-tree";
import { CodeEditor } from "./code-editor";
import { GamePreview } from "./game-preview";
import { ChatInterface } from "./chat-interface";
import { Terminal } from "./terminal";
import { Button } from "../ui/button";
import { Hammer, Wrench } from "lucide-react";
import { useZipTree } from "@/hooks/useZipTree";
import { useFile } from "@/hooks/useFile";

interface EditorLayoutProps {
  jobId: string | null;
  zipUrl: string | null;
  previewUrl: string | null;
  error: string | null;
  onRunBuild: () => Promise<void>;
  onFixWithAI: (error: string) => Promise<void>;
  isBuilding: boolean;
  buildLogs: string[];
  onError?: (error: { message: string, filename: string, lineno: number }) => void;
}

// Define the TreeNode interface to match what FileTree component expects
interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeNode[];
}

export function EditorLayout({
  jobId,
  zipUrl,
  previewUrl,
  error,
  onRunBuild,
  onFixWithAI,
  isBuilding,
  buildLogs,
  onError
}: EditorLayoutProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const { tree: fileTree, files, loading, error: zipError } = useZipTree(zipUrl);
  const { code, save, saving } = useFile(jobId, selectedPath);
  const [isRunning, setIsRunning] = useState(false);
  
  // Convert FileTreeNode[] to TreeNode[] format
  const tree = useMemo(() => {
    const convertToTreeNode = (fileNode: any): TreeNode => {
      return {
        name: fileNode.name,
        path: fileNode.path,
        isDirectory: fileNode.type === 'directory',
        children: fileNode.children ? 
          fileNode.children.map((child: any) => convertToTreeNode(child)) : 
          undefined
      };
    };
    
    return fileTree.map(node => convertToTreeNode(node));
  }, [fileTree]);
  
  const handleFileSelect = (path: string) => {
    setSelectedPath(path);
  };
  
  const handleCodeChange = (newCode: string | undefined) => {
    if (newCode !== undefined) {
      save(newCode);
    }
  };
  
  const handleToggleRunning = () => {
    setIsRunning(prev => !prev);
  };

  return (
    <div className="grid grid-cols-[20%_55%_25%] grid-rows-[1fr_250px] gap-4 h-[calc(100vh-130px)]">
      {/* File Tree */}
      <div className="row-span-1">
        {loading ? (
          <div className="flex items-center justify-center h-full border rounded-md bg-secondary">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading files...</p>
            </div>
          </div>
        ) : zipError ? (
          <div className="flex items-center justify-center h-full border rounded-md bg-secondary p-4">
            <div className="flex flex-col items-center text-center">
              <p className="text-red-500 mb-2">Error loading files</p>
              <p className="text-xs text-muted-foreground">{zipError.message}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4" 
                onClick={() => onRunBuild()}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <FileTree 
            files={tree} 
            onSelect={handleFileSelect} 
            selectedPath={selectedPath}
          />
        )}
      </div>
      
      {/* Code Editor */}
      <div className="row-span-1">
        {loading ? (
          <div className="flex items-center justify-center h-full border rounded-md bg-secondary">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading code...</p>
            </div>
          </div>
        ) : selectedPath ? (
          <CodeEditor
            value={code}
            onChange={handleCodeChange}
            path={selectedPath}
          />
        ) : (
          <div className="flex items-center justify-center h-full border rounded-md bg-secondary">
            <p className="text-muted-foreground">Select a file to edit</p>
          </div>
        )}
      </div>
      
      {/* Game Preview */}
      <div className="row-span-1">
        <GamePreview 
          isRunning={isRunning} 
          onToggleRunning={handleToggleRunning}
          previewCode={previewUrl ? undefined : code}
          previewUrl={isRunning ? previewUrl : undefined}
          onError={onError}
        />
        
        <div className="mt-4 flex gap-2">
          <Button 
            onClick={onRunBuild} 
            disabled={isBuilding}
            className="flex items-center gap-2"
          >
            <Hammer className="h-4 w-4" />
            {isBuilding ? 'Building...' : 'Build & Run'}
          </Button>
          
          {error && (
            <Button 
              onClick={() => onFixWithAI(error)}
              variant="outline" 
              className="flex items-center gap-2"
            >
              <Wrench className="h-4 w-4" />
              Fix with AI
            </Button>
          )}
        </div>
      </div>
      
      {/* Terminal / Build Logs */}
      <div className="col-span-2">
        <Terminal logs={buildLogs} />
      </div>
      
      {/* Chat & "Fix with AI" */}
      <div>
        <ChatInterface
          onSendMessage={async (message) => {
            // Will implement this with the improve endpoint
            console.log("Chat message:", message);
          }}
          isProcessing={false}
          messages={[]}
        />
      </div>
    </div>
  );
}
