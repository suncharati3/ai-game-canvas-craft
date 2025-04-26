import { useState, useEffect } from 'react';
import JSZip from 'jszip';

interface FileTreeNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children: FileTreeNode[];
}

export function useZipTree(zipUrl: string | null) {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [loadAttempts, setLoadAttempts] = useState(0);

  useEffect(() => {
    if (!zipUrl) {
      setTree([]);
      setFiles({});
      setError(null);
      return;
    }

    const loadZip = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Loading ZIP from URL:', zipUrl);

        // Handle different URL formats
        let fetchUrl = zipUrl;
        let jobId = '';
        
        if (zipUrl.includes('/download/')) {
          jobId = zipUrl.split('/download/')[1];
          console.log('Fetching download using job ID:', jobId);
        }

        // Fetch the zip file
        const response = await fetch(fetchUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch ZIP file: ${response.status} ${response.statusText}`);
        }
        
        // Get the blob
        const blob = await response.blob();
        console.log('ZIP blob size from direct download:', blob.size);
        
        // Check if it's actually a ZIP file (ZIP files start with PK)
        const fileHeader = await blob.slice(0, 2).text();
        if (fileHeader !== 'PK') {
          const errorContent = await blob.text().then(text => text.substring(0, 100));
          console.error('Not a ZIP file. Content:', errorContent);
          throw new Error('Invalid ZIP format: file does not start with ZIP signature');
        }

        // Load the ZIP file
        const jszip = new JSZip();
        const zip = await jszip.loadAsync(blob);
        
        // Process the files in the zip
        const newTree: FileTreeNode[] = [];
        const newFiles: Record<string, string> = {};
        
        const promises = [];
        
        // Process each file in the zip
        zip.forEach((relativePath, file) => {
          if (!file.dir) {
            const promise = file.async('text').then(content => {
              newFiles[relativePath] = content;
              
              // Add file to tree
              const pathParts = relativePath.split('/');
              let currentLevel = newTree;
              
              // Create the directory structure
              for (let i = 0; i < pathParts.length - 1; i++) {
                const part = pathParts[i];
                let nextDir = currentLevel.find(
                  node => node.name === part && node.type === 'directory'
                );
                
                if (!nextDir) {
                  nextDir = {
                    name: part,
                    type: 'directory',
                    path: pathParts.slice(0, i + 1).join('/'),
                    children: []
                  };
                  currentLevel.push(nextDir);
                }
                
                currentLevel = nextDir.children;
              }
              
              // Add the file
              const fileName = pathParts[pathParts.length - 1];
              currentLevel.push({
                name: fileName,
                type: 'file',
                path: relativePath,
                children: []
              });
            });
            
            promises.push(promise);
          }
        });
        
        // Wait for all files to be processed
        await Promise.all(promises);
        
        // Sort the tree
        const sortTree = (nodes: FileTreeNode[]) => {
          nodes.sort((a, b) => {
            if (a.type === b.type) {
              return a.name.localeCompare(b.name);
            }
            return a.type === 'directory' ? -1 : 1;
          });
          
          nodes.forEach(node => {
            if (node.type === 'directory') {
              sortTree(node.children);
            }
          });
        };
        
        sortTree(newTree);
        
        setTree(newTree);
        setFiles(newFiles);
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Error loading ZIP:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
        
        // Increment load attempts for retry logic elsewhere
        setLoadAttempts(prev => prev + 1);
      }
    };
    
    loadZip();
    
  }, [zipUrl]);
  
  return { tree, files, loading, error, loadAttempts };
}
