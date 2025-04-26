
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useProject(projectId: string | null) {
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!projectId
  });

  const saveProject = useMutation({
    mutationFn: async (updates: { 
      title?: string;
      description?: string;
      game_code?: string;
      settings?: any;
    }) => {
      if (!projectId) throw new Error('No project ID provided');
      
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Project saved successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to save project: ${error.message}`);
    }
  });

  return {
    project,
    isLoading,
    saveProject: saveProject.mutate
  };
}
