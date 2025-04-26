import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// The storage bucket where all game files will be stored
const STORAGE_BUCKET = "game-builds";

// Check if the storage bucket exists, if not create it
export async function ensureStorageBucket() {
  try {
    // Try to get bucket information to check if it exists
    const { data, error } = await supabase
      .storage
      .getBucket(STORAGE_BUCKET);
    
    // If bucket doesn't exist, create it
    if (error && error.message.includes("not found")) {
      const { error: createError } = await supabase
        .storage
        .createBucket(STORAGE_BUCKET, {
          public: true,
          fileSizeLimit: 50 * 1024 * 1024 // 50MB limit
        });
        
      if (createError) {
        toast.error(`Failed to create bucket: ${createError.message}`);
        return false;
      }
      
      toast.success(`Created storage bucket: ${STORAGE_BUCKET}`);
      return true;
    } else if (error) {
      toast.error(`Bucket check error: ${error.message}`);
      return false;
    }
    
    console.log(`Storage bucket exists: ${STORAGE_BUCKET}`);
    return true;
  } catch (error) {
    console.error("Error ensuring storage bucket:", error);
    toast.error(`Unexpected error with storage: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// Upload a file to the storage bucket
export async function uploadFile(path: string, file: File | Blob | ArrayBuffer) {
  try {
    await ensureStorageBucket();
    
    const { error } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .upload(path, file, {
        upsert: true,
      });
      
    if (error) {
      throw error;
    }
    
    return true;
  } catch (error: any) {
    toast.error(`Failed to upload file: ${error.message}`);
    return false;
  }
}

// Get a public URL for a file
export async function getFilePublicUrl(path: string) {
  const { data } = supabase
    .storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);
    
  return data.publicUrl;
}

// Download a file from storage
export async function downloadFile(path: string) {
  try {
    const { data, error } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .download(path);
      
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error: any) {
    toast.error(`Failed to download file: ${error.message}`);
    return null;
  }
}

// List files in a directory
export async function listFiles(prefix: string) {
  try {
    const { data, error } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .list(prefix);
      
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error: any) {
    toast.error(`Failed to list files: ${error.message}`);
    return [];
  }
}

// Delete a file from storage
export async function deleteFile(path: string) {
  try {
    const { error } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .remove([path]);
      
    if (error) {
      throw error;
    }
    
    return true;
  } catch (error: any) {
    toast.error(`Failed to delete file: ${error.message}`);
    return false;
  }
}
