
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useFile(jobId: string | null, path: string | null) {
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Load file content
  useEffect(() => {
    if (!jobId || !path) {
      setCode('');
      return;
    }

    const loadFile = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // First check if there's an edited version in storage
        const editPath = `edits/${jobId}/${path}`;
        const { data: editData, error: editError } = await supabase
          .storage
          .from('game-builds')
          .download(editPath);
          
        if (editData && !editError) {
          const text = await editData.text();
          setCode(text);
          setLoading(false);
          return;
        }
        
        // If no edited version, check original project files
        const originalPath = `projects/${jobId}/${path}`;
        const { data: originalData, error: originalError } = await supabase
          .storage
          .from('game-builds')
          .download(originalPath);
          
        if (originalData && !originalError) {
          const text = await originalData.text();
          setCode(text);
        } else {
          // Handle case where file doesn't exist
          toast.error(`File not found: ${path}`);
          setError(new Error(`File not found: ${path}`));
          setCode('');
        }
      } catch (err) {
        console.error(`Error loading file ${path}:`, err);
        toast.error(`Failed to load file: ${err instanceof Error ? err.message : String(err)}`);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };
    
    loadFile();
  }, [jobId, path]);

  // Save file content
  const save = async (newCode: string) => {
    if (!jobId || !path) return;
    
    try {
      setSaving(true);
      
      const editPath = `edits/${jobId}/${path}`;
      const { error } = await supabase
        .storage
        .from('game-builds')
        .upload(editPath, newCode, {
          contentType: 'text/plain',
          upsert: true
        });
        
      if (error) {
        throw error;
      }
      
      toast.success('File saved successfully');
      setCode(newCode);
    } catch (err) {
      console.error(`Error saving file ${path}:`, err);
      toast.error(`Failed to save file: ${err instanceof Error ? err.message : String(err)}`);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setSaving(false);
    }
  };

  return { code, loading, error, saving, save };
}
