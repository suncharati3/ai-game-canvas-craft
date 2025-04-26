
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
        console.log('Loading ZIP from URL:', zipUrl);
        
        let blob: Blob | null = null;
        
        if (zipUrl.startsWith('http')) {
          // This is a full URL, likely from Render or Supabase
          const response = await fetch(zipUrl);
          
          if (!response.ok) {
            console.error('URL fetch failed:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('Error details:', errorText.substring(0, 200));
            throw new Error(`HTTP error from URL: ${response.status}`);
          }
          
          blob = await response.blob();
          console.log('ZIP blob size from URL:', blob.size);
          
          if (blob.size === 0) {
            throw new Error('Empty ZIP file received from URL');
          }
        }
        else if (zipUrl.includes('/download/')) {
          // Handle relative URL that needs to be fetched from our Render service
          // We need to use the full RENDER_URL here, but we don't have it in the frontend
          // Let's use the Supabase function as a proxy
          const jobId = zipUrl.split('/download/')[1];
          
          if (!jobId) {
            throw new Error('Invalid download URL format');
          }
          
          console.log('Fetching download using job ID:', jobId);
          
          const { data, error: functionError } = await supabase.functions.invoke('generate-game/download', {
            body: { jobId }
          });
          
          if (functionError || !data || !data.download) {
            console.error('Function error:', functionError || 'No data returned');
            throw new Error('Failed to get download URL from Supabase function');
          }
          
          // Now fetch the actual ZIP from the returned URL
          const downloadUrl = data.download;
          console.log('Got download URL:', downloadUrl);
          
          const response = await fetch(downloadUrl);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          blob = await response.blob();
          console.log('ZIP blob size:', blob.size);
        }
        else if (zipUrl.includes('sign/game-builds')) {
          // This is a signed Supabase URL
          const response = await fetch(zipUrl);
          
          if (!response.ok) {
            console.error('Signed URL fetch failed:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('Error details:', errorText.substring(0, 200));
            throw new Error(`HTTP error from signed URL: ${response.status}`);
          }
          
          blob = await response.blob();
          console.log('ZIP blob size from signed URL:', blob.size);
          
          if (blob.size === 0) {
            throw new Error('Empty ZIP file received from signed URL');
          }
        }
        else {
          // Try to load from Supabase using path
          const path = zipUrl.includes('game-builds/') 
            ? zipUrl.split('game-builds/')[1] 
            : zipUrl;
            
          if (!path) {
            throw new Error('Invalid storage path');
          }
          
          console.log('Downloading from Supabase path:', path);
          const { data, error: downloadError } = await supabase.storage
            .from('game-builds')
            .download(path);
          
          if (downloadError || !data) {
            console.error('Supabase download error:', downloadError);
            throw downloadError || new Error('No data returned from Supabase');
          }
          
          blob = data;
          console.log('ZIP data received from Supabase:', data instanceof Blob ? data.size : 'Not a blob');
        }
        
        if (!blob) {
          throw new Error('Failed to obtain ZIP blob from any source');
        }
        
        // Verify it's a ZIP file by checking the first bytes
        const bytes = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
        if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) { // ZIP magic number "PK"
          const text = await blob.text();
          console.error('Not a ZIP file. Content:', text.substring(0, 200) + '...');
          throw new Error('Invalid ZIP format: file does not start with ZIP signature');
        }
        
        try {
          const zip = await JSZip.loadAsync(blob);
          await processZipContents(zip);
        } catch (zipError) {
          console.error('JSZip error:', zipError);
          console.error('ZIP blob size:', blob.size);
          
          // Try to read the first few bytes to verify the format
          const arrayBuffer = await blob.slice(0, Math.min(blob.size, 1000)).arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const isPK = bytes[0] === 0x50 && bytes[1] === 0x4B;
          
          if (!isPK) {
            // Try to get text content to see if it's an error message
            try {
              const text = await blob.text();
              console.error('Content (not a ZIP):', text.substring(0, 300) + '...');
              throw new Error(`Invalid ZIP format: ${zipError.message}. Content appears to be: ${text.substring(0, 100)}...`);
            } catch (textError) {
              throw new Error(`Invalid ZIP format: ${zipError.message}. Unable to read content.`);
            }
          } else {
            throw new Error(`ZIP parsing error: ${zipError.message}`);
          }
        }
      } catch (err) {
        console.error('Error loading ZIP:', err);
        toast.error(`Failed to load project files: ${err instanceof Error ? err.message : String(err)}`);
        setError(err instanceof Error ? err : new Error(String(err)));
        setTree([]);
        setFiles({});
      } finally {
        setLoading(false);
      }
    };
    
    const processZipContents = async (zip: JSZip) => {
      const fileTreeObj: Record<string, TreeNode> = {};
      const fileContents: Record<string, string> = {};
      
      const zipFiles = Object.keys(zip.files);
      console.log(`Processing ${zipFiles.length} files in ZIP`);
      
      if (zipFiles.length === 0) {
        console.warn('ZIP file contains no files');
        setTree([]);
        setFiles({});
        return;
      }
      
      const promises = zipFiles.map(async (path) => {
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
      
      console.log(`Created ${rootNodes.length} root nodes in file tree`);
      
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
    };

    loadZip();
  }, [zipUrl]);

  return { tree, files, loading, error };
}
