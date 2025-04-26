
import React from "react";
import { FolderIcon, FileIcon, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeNode[];
}

interface FileTreeProps {
  files: TreeNode[];
  onSelect: (path: string) => void;
  selectedPath?: string | null;
}

export function FileTree({ files, onSelect, selectedPath }: FileTreeProps) {
  return (
    <div className="w-full overflow-auto p-2 bg-background border rounded-md">
      <h3 className="font-semibold mb-2 px-2">Files</h3>
      <TreeView 
        files={files} 
        onSelect={onSelect} 
        selectedPath={selectedPath} 
      />
    </div>
  );
}

interface TreeViewProps {
  files: TreeNode[];
  onSelect: (path: string) => void;
  selectedPath?: string | null;
  level?: number;
}

export function TreeView({ 
  files, 
  onSelect, 
  selectedPath = null, 
  level = 0 
}: TreeViewProps) {
  return (
    <ul className={cn("pl-2", level === 0 ? "" : "border-l border-slate-700")}>
      {files.map((file) => (
        <TreeItem 
          key={file.path} 
          file={file} 
          onSelect={onSelect}
          isSelected={selectedPath === file.path}
          level={level}
          selectedPath={selectedPath}
        />
      ))}
    </ul>
  );
}

interface TreeItemProps {
  file: TreeNode;
  onSelect: (path: string) => void;
  isSelected: boolean;
  level: number;
  selectedPath?: string | null;
}

function TreeItem({ 
  file, 
  onSelect, 
  isSelected, 
  level, 
  selectedPath 
}: TreeItemProps) {
  const [isOpen, setIsOpen] = React.useState(level < 1);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <li className="py-1">
      <div 
        className={cn(
          "flex items-center gap-1 hover:bg-secondary rounded px-2 py-1 cursor-pointer",
          isSelected && "bg-secondary-foreground/20"
        )}
        onClick={() => file.isDirectory ? setIsOpen(!isOpen) : onSelect(file.path)}
      >
        {file.isDirectory ? (
          <span className="p-0.5" onClick={toggleOpen}>
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        ) : (
          <span className="w-4" />
        )}
        {file.isDirectory ? (
          <FolderIcon className="h-4 w-4 mr-1 text-yellow-500" />
        ) : (
          <FileIcon className="h-4 w-4 mr-1 text-blue-500" />
        )}
        <span className="truncate">{file.name}</span>
      </div>
      {file.isDirectory && isOpen && file.children && (
        <TreeView 
          files={file.children} 
          onSelect={onSelect}
          selectedPath={selectedPath}
          level={level + 1}
        />
      )}
    </li>
  );
}
