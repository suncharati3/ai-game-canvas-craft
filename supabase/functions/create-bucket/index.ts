
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    // Get Supabase credentials from environment variables
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    // Initialize Supabase client with admin privileges
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Try to get the bucket first to check if it exists
    const { error: getBucketError } = await supabase.storage.getBucket('game-builds');
    
    if (getBucketError) {
      console.log('Bucket does not exist, creating it');
      
      // Create the bucket
      const { data, error } = await supabase.storage.createBucket('game-builds', {
        public: true,
        fileSizeLimit: 100 * 1024 * 1024, // 100MB limit
      });

      if (error) {
        throw error;
      }
      
      console.log('Bucket created successfully:', data);
    } else {
      console.log('Bucket already exists');
    }
    
    // Ensure bucket is public
    const { error: updateError } = await supabase.storage.updateBucket('game-builds', {
      public: true
    });
    
    if (updateError) {
      console.error('Error updating bucket to public:', updateError);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Storage bucket ready' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error creating bucket:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
