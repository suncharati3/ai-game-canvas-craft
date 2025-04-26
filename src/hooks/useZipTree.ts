
import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { toast } from 'sonner';

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeNode[];
}

export function useZipTree(zipUrl: string | null) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [files, setFiles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!zipUrl) {
      setTree([]);
      setFiles({});
      return;
    }

    const loadZip = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(zipUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const blob = await response.blob();
        const zip = await JSZip.loadAsync(blob);
        
        // Build tree structure and load file contents
        const fileTreeObj: Record<string, TreeNode> = {};
        const fileContents: Record<string, string> = {};
        
        // Process each file in the ZIP
        const promises = Object.keys(zip.files).map(async (path) => {
          const zipObj = zip.files[path];
          
          // Skip directories themselves, we'll create them as needed
          if (zipObj.dir) return;
          
          // Store file content
          try {
            const content = await zipObj.async('string');
            fileContents[path] = content;
          } catch (e) {
            console.error(`Error extracting ${path}:`, e);
            fileContents[path] = `// Error loading file: ${e}`;
          }
          
          // Create path parts
          const parts = path.split('/');
          let currentPath = '';
          
          // Build tree nodes for each path segment
          parts.forEach((part, i) => {
            const isLast = i === parts.length - 1;
            const parentPath = currentPath;
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            
            if (!fileTreeObj[currentPath]) {
              fileTreeObj[currentPath] = {
                name: part,
                path: currentPath,
                isDirectory: !isLast,
                children: isLast ? undefined : []
              };
              
              // Add to parent if not root
              if (parentPath && fileTreeObj[parentPath]) {
                fileTreeObj[parentPath].children?.push(fileTreeObj[currentPath]);
              }
            }
          });
        });
        
        // Wait for all files to be processed
        await Promise.all(promises);
        
        // Extract root level nodes
        const rootNodes = Object.values(fileTreeObj).filter(node => {
          return !node.path.includes('/');
        });
        
        // Sort: directories first, then alphabetically
        const sortNodes = (nodes: TreeNode[] = []): TreeNode[] => {
          return [...nodes].sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
          }).map(node => {
            if (node.children) {
              return {
                ...node,
                children: sortNodes(node.children)
              };
            }
            return node;
          });
        };
        
        setTree(sortNodes(rootNodes));
        setFiles(fileContents);
        
      } catch (err) {
        console.error('Error loading ZIP:', err);
        toast.error(`Failed to load project files: ${err instanceof Error ? err.message : String(err)}`);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };

    loadZip();
  }, [zipUrl]);

  return { tree, files, loading, error };
}
