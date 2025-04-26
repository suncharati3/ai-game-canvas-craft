
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RENDER_URL = Deno.env.get("RENDER_URL")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = url.pathname.split('/').pop()

  try {
    if (!RENDER_URL) {
      throw new Error('RENDER_URL environment variable not set');
    }

    console.log('Path:', path);
    
    if (path === 'generate') {
      const { prompt } = await req.json()

      if (!prompt) {
        return new Response(
          JSON.stringify({ error: 'Prompt is required' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Log the Render URL to help with debugging
      console.log('Calling Render URL:', `${RENDER_URL}/run`);

      try {
        // Call Render service
        const response = await fetch(`${RENDER_URL}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        })

        // Add more detailed error logging
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Render service error:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          throw new Error(`AI service error: ${response.status} - ${errorText}`)
        }

        const data = await response.json()
        console.log('Generated game data:', data);
        
        if (data.error) {
          console.error('Game generation failed:', data.error);
        }
        
        // Make sure we return the full signed URL from the Render service
        // instead of a relative path
        if (data.download && data.download.startsWith('/tmp')) {
          // This is a path in the server, we need to modify the response
          // to include a proper download link
          data.download = `${RENDER_URL}/download/${data.jobId}`;
        }
        
        return new Response(
          JSON.stringify(data),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      } catch (error) {
        console.error('Error calling Render service:', error);
        throw new Error(`Failed to connect to AI service: ${error.message}`);
      }
    } 
    else if (path === 'build') {
      const { jobId } = await req.json()

      if (!jobId) {
        return new Response(
          JSON.stringify({ error: 'Job ID is required' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Call Render service
      const response = await fetch(`${RENDER_URL}/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      })

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Build service error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Build service error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      
      return new Response(
        JSON.stringify(data),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    else if (path === 'improve') {
      const { jobId, prompt } = await req.json()

      if (!jobId || !prompt) {
        return new Response(
          JSON.stringify({ error: 'Job ID and prompt are required' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Call Render service
      const response = await fetch(`${RENDER_URL}/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, prompt })
      })

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Improve service error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Improve service error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      
      return new Response(
        JSON.stringify(data),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    else if (path === 'logs') {
      const { jobId } = await req.json()

      if (!jobId) {
        return new Response(
          JSON.stringify({ error: 'Job ID is required' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Call Render service
      const response = await fetch(`${RENDER_URL}/logs/${jobId}`)

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Logs service error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Logs service error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      
      return new Response(
        JSON.stringify(data),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }
    else {
      return new Response(
        JSON.stringify({ error: 'Unknown endpoint' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
  } catch (error) {
    console.error('Unexpected error in generate-game function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
