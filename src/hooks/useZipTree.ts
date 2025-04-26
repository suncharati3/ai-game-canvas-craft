import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
        
        if (zipUrl.includes('game-builds')) {
          const { data, error } = await supabase.storage
            .from('game-builds')
            .download(zipUrl.split('game-builds/')[1]);
          
          if (error) {
            throw error;
          }

          if (!data) {
            toast.error('No data found in the ZIP file');
            return;
          }

          const zip = await JSZip.loadAsync(data);
          
          const fileTreeObj: Record<string, TreeNode> = {};
          const fileContents: Record<string, string> = {};
          
          const promises = Object.keys(zip.files).map(async (path) => {
            const zipObj = zip.files[path];
            
            if (zipObj.dir) return;
            
            try {
              const content = await zipObj.async('string');
              fileContents[path] = content;
            } catch (e) {
              console.error(`Error extracting ${path}:`, e);
              fileContents[path] = `// Error loading file: ${e}`;
            }
            
            const parts = path.split('/');
            let currentPath = '';
            
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
                
                if (parentPath && fileTreeObj[parentPath]) {
                  fileTreeObj[parentPath].children?.push(fileTreeObj[currentPath]);
                }
              }
            });
          });
          
          await Promise.all(promises);
          
          const rootNodes = Object.values(fileTreeObj).filter(node => {
            return !node.path.includes('/');
          });
          
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
        } else {
          const response = await fetch(zipUrl);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const blob = await response.blob();
          const zip = await JSZip.loadAsync(blob);
          
          const fileTreeObj: Record<string, TreeNode> = {};
          const fileContents: Record<string, string> = {};
          
          const promises = Object.keys(zip.files).map(async (path) => {
            const zipObj = zip.files[path];
            
            if (zipObj.dir) return;
            
            try {
              const content = await zipObj.async('string');
              fileContents[path] = content;
            } catch (e) {
              console.error(`Error extracting ${path}:`, e);
              fileContents[path] = `// Error loading file: ${e}`;
            }
            
            const parts = path.split('/');
            let currentPath = '';
            
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
                
                if (parentPath && fileTreeObj[parentPath]) {
                  fileTreeObj[parentPath].children?.push(fileTreeObj[currentPath]);
                }
              }
            });
          });
          
          await Promise.all(promises);
          
          const rootNodes = Object.values(fileTreeObj).filter(node => {
            return !node.path.includes('/');
          });
          
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
        }
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
