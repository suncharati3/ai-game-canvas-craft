
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RENDER_URL = "https://ai-game-canvas-craft.onrender.com"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = url.pathname.split('/').pop()

  try {
    if (path === 'generate') {
      // Generate new game
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

      // Call Render service
      const response = await fetch(`${RENDER_URL}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })

      if (!response.ok) {
        throw new Error(`AI service error: ${response.status}`)
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
    else if (path === 'build') {
      // Build game
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
        throw new Error(`Build service error: ${response.status}`)
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
      // Improve game
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
        throw new Error(`Improve service error: ${response.status}`)
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
      // Get logs
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
        throw new Error(`Logs service error: ${response.status}`)
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
      // Default endpoint (generate)
      return new Response(
        JSON.stringify({ error: 'Unknown endpoint' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
