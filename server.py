
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
import asyncio
import os
import requests
import shutil
import subprocess
import traceback
import uuid
import zipfile
import tempfile
import json
from typing import Dict, List, Optional
from supabase import create_client, Client
import base64

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get environment variables
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Initialize Supabase client if environment variables are set
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def run(cmd, cwd=None, env=None):
    print(f"Running: {' '.join(cmd)} in {cwd}")
    result = subprocess.run(
        cmd,
        cwd=cwd,
        env=env,
        check=True,
        capture_output=True,
        text=True
    )
    print(f"Output: {result.stdout}")
    return result

def pull_edits(job_id, project_dir):
    """Pull edits from Supabase storage into the project directory"""
    if not supabase:
        print("WARNING: Supabase client not initialized - cannot pull edits")
        return
    
    try:
        # Create edits directory if it doesn't exist
        edits_dir = os.path.join(project_dir, "edits")
        os.makedirs(edits_dir, exist_ok=True)
        
        # List all edits for the job
        edit_files = supabase.storage.from_('game-builds').list(f"edits/{job_id}")
        
        for edit_file in edit_files:
            file_path = edit_file['name']
            
            # Download the edit file
            response = supabase.storage.from_('game-builds').download(f"edits/{job_id}/{file_path}")
            
            # Ensure the directory exists
            os.makedirs(os.path.dirname(os.path.join(project_dir, file_path)), exist_ok=True)
            
            # Write the file
            with open(os.path.join(project_dir, file_path), 'wb') as f:
                f.write(response)
                
        print(f"Successfully pulled {len(edit_files)} edits for job {job_id}")
    except Exception as e:
        print(f"Error pulling edits: {e}")
        traceback.print_exc()

def upload_to_supabase(file_path, storage_path, content_type="application/zip"):
    """Upload a file to Supabase storage and return a signed URL"""
    if not supabase:
        print("WARNING: Supabase client not initialized - cannot upload file")
        return None
    
    try:
        print(f"Uploading {file_path} to Supabase at {storage_path}")
        # Check if file exists and is readable
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            return None
            
        # Upload the file
        with open(file_path, 'rb') as f:
            file_data = f.read()
            
            # Upload to storage
            result = supabase.storage.from_('game-builds').upload(
                path=storage_path,
                file=file_data,
                file_options={"content-type": content_type, "upsert": "true"}
            )
            
            print(f"Upload result: {result}")
            
        # Create a signed URL
        signed_url_result = supabase.storage.from_('game-builds').create_signed_url(
            path=storage_path,
            expires_in=3600  # 1 hour expiry
        )
        
        print(f"Signed URL result: {signed_url_result}")
        
        if "signedURL" in signed_url_result:
            return signed_url_result["signedURL"]
        else:
            print("Failed to create signed URL")
            return None
            
    except Exception as e:
        print(f"Error uploading or signing file: {e}")
        traceback.print_exc()
        return None

def upload_and_sign(file_path, storage_path):
    """Upload a file to Supabase storage using a different method"""
    try:
        # Make sure the bucket exists first
        ensure_bucket_exists()
        
        return upload_to_supabase(file_path, storage_path)
    except Exception as e:
        print(f"Error in upload_and_sign: {e}")
        traceback.print_exc()
        return None
        
def ensure_bucket_exists():
    """Make sure the game-builds bucket exists in Supabase storage"""
    if not supabase:
        print("WARNING: Supabase client not initialized - cannot create bucket")
        return False
        
    try:
        try:
            # Try to list the bucket to see if it exists
            supabase.storage.get_bucket('game-builds')
            print("Bucket 'game-builds' already exists")
            return True
        except Exception as e:
            print(f"Bucket 'game-builds' does not exist or error: {e}")
            
            # Create the bucket
            supabase.storage.create_bucket('game-builds', {'public': True})
            print("Created bucket 'game-builds'")
            return True
    except Exception as e:
        print(f"Error creating bucket: {e}")
        traceback.print_exc()
        return False

@app.post("/run")
async def run_gpt_engineer(request: Request):
    try:
        data = await request.json()
        prompt = data.get("prompt")
        
        if not prompt:
            raise HTTPException(status_code=400, detail="Prompt is required")
            
        job_id = str(uuid.uuid4())
        proj = f"/tmp/projects/{job_id}"
        
        os.makedirs(proj, exist_ok=True)
        
        print(f"Created project directory: {proj}")
        
        # Generate a simple game based on the prompt
        with open(f"{proj}/main.js", "w") as f:
            f.write(f"""// Generated game based on prompt: {prompt}
console.log("Game starting...");
document.body.innerHTML = '<h1>Generated Game</h1><div id="game"></div>';
const gameDiv = document.getElementById("game");
gameDiv.innerHTML = '<p>This is a simple game based on your prompt: {prompt}</p>';
""")
            
        with open(f"{proj}/index.html", "w") as f:
            f.write(f"""<!DOCTYPE html>
<html>
<head>
    <title>Generated Game</title>
    <style>
        body {{ font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }}
        #game {{ border: 1px solid #ccc; padding: 20px; margin-top: 20px; }}
    </style>
</head>
<body>
    <h1>Game</h1>
    <div id="game"></div>
    <script src="main.js"></script>
</body>
</html>
""")
            
        # Create a zip file
        zip_file = shutil.make_archive(f"/tmp/{job_id}", 'zip', proj)
        print(f"Created zip file: {zip_file}")
        
        # Make sure we also save the entire project to Supabase storage
        proj_storage_path = f"projects/{job_id}"
        print(f"Saving project files to Supabase storage: {proj_storage_path}")
        
        # Upload individual project files to storage for later editing
        for root, _, files in os.walk(proj):
            for file in files:
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, proj)
                storage_path = f"{proj_storage_path}/{rel_path}"
                
                # Determine content type based on file extension
                content_type = "text/plain"
                if file.endswith(".html"):
                    content_type = "text/html"
                elif file.endswith(".js"):
                    content_type = "application/javascript"
                elif file.endswith(".css"):
                    content_type = "text/css"
                elif file.endswith(".json"):
                    content_type = "application/json"
                    
                try:
                    with open(file_path, 'rb') as f:
                        file_data = f.read()
                        if supabase:
                            result = supabase.storage.from_('game-builds').upload(
                                path=storage_path,
                                file=file_data,
                                file_options={"content-type": content_type, "upsert": "true"}
                            )
                            print(f"Uploaded {storage_path} to storage: {result}")
                except Exception as e:
                    print(f"Error uploading {storage_path}: {e}")
        
        # Store in Supabase if available
        zip_storage_path = f"{job_id}.zip"
        download_url = f"/download/{job_id}"
        
        if supabase:
            try:
                # Upload to Supabase storage
                signed_url = upload_and_sign(zip_file, zip_storage_path)
                if signed_url:
                    download_url = signed_url
                    print(f"Uploaded to Supabase with signed URL: {download_url}")
                else:
                    print("Failed to upload to Supabase, using local file fallback")
            except Exception as e:
                print(f"Error uploading to Supabase: {e}")
                # Continue with local file if Supabase upload fails
        
        return {
            "jobId": job_id,
            "download": download_url
        }
    except Exception as e:
        print(f"Error in /run: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/build")
async def build_game(request: Request):
    try:
        data = await request.json()
        job_id = data.get("jobId")
        
        if not job_id:
            raise HTTPException(status_code=400, detail="Job ID is required")
            
        proj = f"/tmp/projects/{job_id}"
        
        # Check if project directory exists, if not create it
        if not os.path.exists(proj):
            os.makedirs(proj, exist_ok=True)
            
            # Download the original zip if it doesn't exist
            if supabase:
                try:
                    # First, check if the zip file exists in storage
                    try:
                        response = supabase.storage.from_('game-builds').download(f"{job_id}.zip")
                        
                        # Save zip file
                        zip_path = f"/tmp/{job_id}.zip"
                        with open(zip_path, 'wb') as f:
                            f.write(response)
                            
                        # Extract zip
                        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                            zip_ref.extractall(proj)
                            
                        print(f"Downloaded and extracted from Supabase storage for job {job_id}")
                    except Exception as zip_e:
                        print(f"Could not download zip from Supabase: {zip_e}")
                        
                        # If zip doesn't exist, try to download individual files from projects folder
                        try:
                            project_files = supabase.storage.from_('game-builds').list(f"projects/{job_id}")
                            
                            for file_obj in project_files:
                                file_path = file_obj['name']
                                response = supabase.storage.from_('game-builds').download(f"projects/{job_id}/{file_path}")
                                
                                # Ensure the directory exists
                                os.makedirs(os.path.dirname(os.path.join(proj, file_path)), exist_ok=True)
                                
                                # Write the file
                                with open(os.path.join(proj, file_path), 'wb') as f:
                                    f.write(response)
                                    
                            print(f"Downloaded individual project files from Supabase storage for job {job_id}")
                        except Exception as proj_e:
                            print(f"Could not download project files from Supabase: {proj_e}")
                            
                except Exception as e:
                    print(f"Could not download from Supabase: {e}")
        
        # Pull any edits from storage
        pull_edits(job_id, proj)
        
        # Simple build process (for a real game this would do more)
        if os.path.exists(f"{proj}/package.json"):
            # If there's a package.json, run npm install and build
            run(["npm", "install"], cwd=proj)
            run(["npm", "run", "build"], cwd=proj)
            dist_dir = f"{proj}/dist"
        else:
            # Otherwise just use the root as the "dist"
            dist_dir = proj
            
        # Create a zip file of the dist
        dist_zip = shutil.make_archive(f"/tmp/{job_id}-dist", 'zip', dist_dir)
        print(f"Created dist zip: {dist_zip}")
        
        # Store in Supabase if available
        preview_url = f"/preview/{job_id}"
        dist_storage_path = f"{job_id}/dist.zip"
        
        if supabase:
            try:
                signed_url = upload_and_sign(dist_zip, dist_storage_path)
                if signed_url:
                    preview_url = signed_url.replace(".zip", "")  # Remove .zip extension for preview URL
                    print(f"Uploaded to Supabase with signed URL: {signed_url}")
                else:
                    print("Failed to upload dist to Supabase, using local file fallback")
            except Exception as e:
                print(f"Error uploading to Supabase: {e}")
        
        return {
            "status": "success",
            "jobId": job_id,
            "preview": preview_url
        }
    except Exception as e:
        print(f"Error in /build: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ... keep existing code (improve, logs, download, preview, file endpoints)
