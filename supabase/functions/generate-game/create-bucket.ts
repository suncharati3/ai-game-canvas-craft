
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Initialize Supabase client with the service key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create the game-builds bucket if it doesn't exist
    const { data, error } = await supabase
      .storage
      .createBucket('game-builds', {
        public: true,
        fileSizeLimit: 52428800, // 50MB
      });

    if (error && error.message !== "Bucket already exists") {
      throw error;
    }

    // Configure bucket policy to allow public access
    await supabase
      .storage
      .from('game-builds')
      .updateBucket({
        public: true,
        fileSizeLimit: 52428800,
      });

    return new Response(
      JSON.stringify({ success: true, message: "Storage bucket configured" }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in create-bucket function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
