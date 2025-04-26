
import { supabase } from "@/integrations/supabase/client";

interface GenerationResponse {
  jobId: string;
  download?: string;
}

export async function generateGame(prompt: string): Promise<GenerationResponse> {
  const { data, error } = await supabase.functions.invoke('generate-game', {
    body: { prompt }
  });

  if (error) throw new Error(`Failed to generate game: ${error.message}`);
  return data;
}
