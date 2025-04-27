
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function ensureStorageBucketExists(): Promise<boolean> {
  try {
    console.log("Checking storage bucket access...");
    
    // First try to access the bucket directly
    const { data: bucketData, error: bucketError } = await supabase.storage
      .getBucket('game-builds');
    
    if (!bucketError && bucketData) {
      console.log("Storage bucket 'game-builds' is accessible");
      return true;
    }
    
    console.error("Error accessing storage bucket:", bucketError);
    
    // If bucket doesn't exist or isn't accessible, call the create-bucket edge function
    console.log("Attempting to create storage bucket via Edge Function...");
    
    try {
      const { data, error } = await supabase.functions.invoke('create-bucket', {
        method: 'POST'
      });
      
      if (error) {
        console.error("Error creating bucket via Edge Function:", error);
        toast.error("Failed to initialize storage");
        return false;
      }
      
      console.log("Bucket creation response:", data);
      
      if (data?.success) {
        toast.success("Storage initialized successfully");
        return true;
      } else {
        toast.error("Storage initialization failed");
        return false;
      }
    } catch (edgeError) {
      console.error("Edge function error:", edgeError);
      toast.error("Failed to initialize storage");
      return false;
    }
  } catch (error) {
    console.error("Error checking storage bucket:", error);
    return false;
  }
}

export async function uploadGameZip(jobId: string, zipFile: File): Promise<string | null> {
  try {
    // Check bucket exists before upload
    const bucketExists = await ensureStorageBucketExists();
    if (!bucketExists) {
      toast.error("Storage is not properly configured");
      return null;
    }
    
    // Upload the zip file
    const { data, error } = await supabase.storage
      .from('game-builds')
      .upload(`${jobId}.zip`, zipFile, {
        contentType: 'application/zip',
        upsert: true
      });
    
    if (error) {
      console.error("Error uploading zip file:", error);
      toast.error("Failed to upload game files");
      return null;
    }
    
    // Get signed URL
    const { data: urlData, error: urlError } = await supabase.storage
      .from('game-builds')
      .createSignedUrl(`${jobId}.zip`, 3600);
    
    if (urlError) {
      console.error("Error creating signed URL:", urlError);
      toast.error("Failed to generate download link");
      return null;
    }
    
    return urlData.signedUrl;
  } catch (error) {
    console.error("Error in uploadGameZip:", error);
    toast.error("Failed to upload game files");
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
    
    console.error("Error getting download URL:", urlError);
    toast.error("Failed to generate download link");
    return null;
  } catch (error) {
    console.error("Error in downloadGameZip:", error);
    toast.error("Failed to download game files");
    return null;
  }
}
