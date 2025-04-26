
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RENDER_URL = Deno.env.get("RENDER_URL")!;

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
    if (!RENDER_URL) {
      throw new Error('RENDER_URL environment variable not set');
    }

    let jobId = '';
    
    // Handle both GET and POST methods
    if (req.method === 'POST') {
      const body = await req.json();
      jobId = body.jobId;
    } else if (req.method === 'GET') {
      const url = new URL(req.url);
      jobId = url.pathname.split('/').pop() || '';
    }

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Job ID is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create a proper logs URL using the Render URL
    const logsUrl = `${RENDER_URL}/logs/${jobId}`;
    console.log('Fetching logs from URL:', logsUrl);

    // Fetch logs from the Render service
    const response = await fetch(logsUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Logs service error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Logs service error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Logs data:', data);

    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in logs function:', error);
    return new Response(
      JSON.stringify({ error: error.message, logs: [] }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
