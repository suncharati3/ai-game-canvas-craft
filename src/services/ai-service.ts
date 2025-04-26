
import { supabase } from "@/integrations/supabase/client";

interface GenerationResponse {
  jobId: string;
  download?: string;
}

interface BuildResponse {
  status: string;
  jobId: string;
  preview?: string;
}

interface ImproveResponse {
  status: string;
  jobId: string;
}

interface LogsResponse {
  logs: string[];
}

export async function generateGame(prompt: string): Promise<GenerationResponse> {
  const { data, error } = await supabase.functions.invoke('generate-game/generate', {
    body: { prompt }
  });

  if (error) throw new Error(`Failed to generate game: ${error.message}`);
  return data;
}

export async function buildGame(jobId: string): Promise<BuildResponse> {
  const { data, error } = await supabase.functions.invoke('generate-game/build', {
    body: { jobId }
  });

  if (error) throw new Error(`Failed to build game: ${error.message}`);
  return data;
}

export async function improveGame(jobId: string, prompt: string): Promise<ImproveResponse> {
  const { data, error } = await supabase.functions.invoke('generate-game/improve', {
    body: { jobId, prompt }
  });

  if (error) throw new Error(`Failed to improve game: ${error.message}`);
  return data;
}

export async function getGameLogs(jobId: string): Promise<LogsResponse> {
  const { data, error } = await supabase.functions.invoke('generate-game/logs', {
    body: { jobId }
  });

  if (error) throw new Error(`Failed to get game logs: ${error.message}`);
  return data;
}
