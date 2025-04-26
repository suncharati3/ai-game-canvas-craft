
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// The storage bucket where all game files will be stored
const STORAGE_BUCKET = "game-builds";

// Check if file exists in storage
export async function checkFileExists(path: string) {
  try {
    const { data, error } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .list(path.split('/').slice(0, -1).join('/') || '', {
        limit: 1,
        search: path.split('/').pop() || ''
      });
      
    if (error) {
      throw error;
    }
    
    return data && data.length > 0;
  } catch (error) {
    console.error("Error checking if file exists:", error);
    return false;
  }
}

// Upload a file to the storage bucket
export async function uploadFile(path: string, file: File | Blob | ArrayBuffer) {
  try {
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

// Get a signed URL for a file
export async function getSignedUrl(path: string, expiresIn = 3600) {
  try {
    const { data, error } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, expiresIn);
      
    if (error) {
      throw error;
    }
    
    return data.signedUrl;
  } catch (error: any) {
    toast.error(`Failed to get signed URL: ${error.message}`);
    return null;
  }
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
