
// This is a placeholder hook for backward compatibility
// In our new architecture, we're using jobId instead of projectId
import { useState } from 'react';

export function useProject(projectId: string | null) {
  const [project] = useState(null);
  const [isLoading] = useState(false);
  
  // Empty function that does nothing - for backward compatibility
  const saveProject = async () => {
    return true;
  };
  
  return { project, isLoading, saveProject };
}
