
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function ensureStorageBucketExists(): Promise<boolean> {
  try {
    console.log("Ensuring storage bucket exists...");
    
    // First check if the bucket exists
    try {
      const { data: bucketData, error: bucketError } = await supabase.storage.getBucket('game-builds');
      
      if (!bucketError && bucketData) {
        console.log("Storage bucket 'game-builds' already exists");
        return true;
      }
    } catch (err) {
      console.log("Error checking if bucket exists, will try to create it");
    }
    
    // If we get here, try to create the bucket using our edge function
    const { data, error } = await supabase.functions.invoke('generate-game/create-bucket');
    
    if (error) {
      console.error("Error ensuring storage bucket exists:", error);
      return false;
    }
    
    console.log("Storage bucket creation response:", data);
    return true;
  } catch (error) {
    console.error("Error ensuring storage bucket exists:", error);
    return false;
  }
}

export async function uploadGameZip(jobId: string, zipFile: File): Promise<string | null> {
  try {
    // Ensure bucket exists
    await ensureStorageBucketExists();
    
    // Upload the zip file
    const { data, error } = await supabase.storage
      .from('game-builds')
      .upload(`${jobId}.zip`, zipFile, {
        contentType: 'application/zip',
        upsert: true
      });
    
    if (error) {
      console.error("Error uploading zip file:", error);
      return null;
    }
    
    // Get signed URL
    const { data: urlData, error: urlError } = await supabase.storage
      .from('game-builds')
      .createSignedUrl(`${jobId}.zip`, 3600);
    
    if (urlError) {
      console.error("Error creating signed URL:", urlError);
      return null;
    }
    
    return urlData.signedUrl;
  } catch (error) {
    console.error("Error in uploadGameZip:", error);
    return null;
  }
}

export async function downloadGameZip(jobId: string): Promise<string | null> {
  try {
    // Try direct signed URL first
    const { data: urlData, error: urlError } = await supabase.storage
      .from('game-builds')
      .createSignedUrl(`${jobId}.zip`, 3600);
    
    if (!urlError && urlData?.signedUrl) {
      return urlData.signedUrl;
    }
    
    // If that fails, try the edge function
    const { data, error } = await supabase.functions.invoke('generate-game/download', {
      body: { jobId }
    });
    
    if (error) {
      console.error("Error getting download URL from edge function:", error);
      
      // Last resort: try direct URL from the Render service
      // Use environment configuration or a fallback URL instead of Deno.env
      const renderUrl = process.env.RENDER_URL || "https://ai-game-canvas-craft.onrender.com";
      return `${renderUrl}/download/${jobId}`;
    }
    
    return data?.download || null;
  } catch (error) {
    console.error("Error in downloadGameZip:", error);
    return null;
  }
}
