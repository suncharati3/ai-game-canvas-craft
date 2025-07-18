import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GenerationResponse {
  jobId: string;
  download?: string;
  error?: string;
}

interface BuildResponse {
  status: string;
  jobId: string;
  preview?: string;
  error?: string;
}

interface ImproveResponse {
  status: string;
  jobId: string;
  error?: string;
}

interface LogsResponse {
  logs: string[];
  error?: string;
}

// Helper function to retry API calls with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let retries = 0;
  let delay = initialDelay;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (retries >= maxRetries) {
        throw error;
      }
      
      console.log(`Retry ${retries + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      retries++;
      delay *= 2; // Exponential backoff
    }
  }
}

export async function generateGame(prompt: string): Promise<GenerationResponse> {
  try {
    console.log('Generating game with prompt:', prompt);
    
    const response = await retryWithBackoff(async () => {
      const { data, error } = await supabase.functions.invoke('generate-game/generate', {
        body: { prompt }
      });

      if (error) {
        console.error('Error from Supabase function:', error);
        throw new Error(`Failed to generate game: ${error.message}`);
      }
      
      if (!data) {
        throw new Error('No data returned from generate-game function');
      }
      
      return { data, error };
    });

    const { data, error } = response;
    
    if (error) {
      console.error('Error generating game:', error);
      throw new Error(`Failed to generate game: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('No data returned from generate-game function');
    }
    
    if (data.error) {
      throw new Error(`Game generation failed: ${data.error}`);
    }

    console.log('Game generation successful:', data);
    
    // The download URL should now be a complete URL, not a relative path
    if (data.download && !data.download.startsWith('http') && !data.download.startsWith('/download/')) {
      console.warn('Download URL format unexpected, adding /download/ prefix:', data.download);
      data.download = `/download/${data.jobId}`;
    }
    
    return data;
  } catch (error) {
    console.error('Error in generateGame:', error);
    throw error;
  }
}

export async function buildGame(jobId: string): Promise<BuildResponse> {
  try {
    console.log('Building game with jobId:', jobId);
    
    const response = await retryWithBackoff(async () => {
      const { data, error } = await supabase.functions.invoke('generate-game/build', {
        body: { jobId }
      });
      
      if (error) {
        console.error('Error from Supabase function:', error);
        throw new Error(`Failed to build game: ${error.message}`);
      }
      
      if (!data) {
        throw new Error('No data returned from build function');
      }
      
      return { data, error };
    });
    
    const { data, error } = response;
    
    if (error) {
      console.error('Error building game:', error);
      throw new Error(`Failed to build game: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('No data returned from build function');
    }
    
    if (data.error) {
      throw new Error(`Build failed: ${data.error}`);
    }

    console.log('Build successful:', data);
    return data;
  } catch (error) {
    console.error('Error in buildGame:', error);
    throw error;
  }
}

export async function improveGame(jobId: string, prompt: string): Promise<ImproveResponse> {
  try {
    console.log('Improving game with jobId:', jobId, 'prompt:', prompt);
    
    const response = await retryWithBackoff(async () => {
      const { data, error } = await supabase.functions.invoke('generate-game/improve', {
        body: { jobId, prompt }
      });
      
      if (error) {
        console.error('Error from Supabase function:', error);
        throw new Error(`Failed to improve game: ${error.message}`);
      }
      
      if (!data) {
        throw new Error('No data returned from improve function');
      }
      
      return { data, error };
    });
    
    const { data, error } = response;
    
    if (error) {
      console.error('Error improving game:', error);
      throw new Error(`Failed to improve game: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('No data returned from improve function');
    }
    
    if (data.error) {
      throw new Error(`Improvement failed: ${data.error}`);
    }

    console.log('Improvement successful:', data);
    return data;
  } catch (error) {
    console.error('Error in improveGame:', error);
    throw error;
  }
}

export async function getGameLogs(jobId: string): Promise<LogsResponse> {
  try {
    console.log('Getting logs for jobId:', jobId);
    
    const response = await retryWithBackoff(async () => {
      const { data, error } = await supabase.functions.invoke('generate-game/logs', {
        body: { jobId }
      });
      
      if (error) {
        console.error('Error from Supabase function:', error);
        throw new Error(`Failed to get game logs: ${error.message}`);
      }
      
      return { data, error };
    });
    
    const { data, error } = response;
    
    if (error) {
      console.error('Error getting game logs:', error);
      throw new Error(`Failed to get game logs: ${error.message}`);
    }
    
    if (!data) {
      return { logs: [] };
    }
    
    if (data.error) {
      console.warn('Warning in logs response:', data.error);
    }

    return data;
  } catch (error) {
    console.error('Error in getGameLogs:', error);
    return { logs: [`Error retrieving logs: ${error instanceof Error ? error.message : String(error)}`] };
  }
}
