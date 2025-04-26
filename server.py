
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

def upload_and_sign(file_path, storage_path):
    """Upload a file to Supabase storage and return a signed URL"""
    if not supabase:
        print("WARNING: Supabase client not initialized - cannot upload file")
        return None
    
    try:
        # Upload the file
        with open(file_path, 'rb') as f:
            supabase.storage.from_('game-builds').upload(
                storage_path,
                f.read(),
                {"content-type": "application/zip", "upsert": "true"}
            )
            
        # Create a signed URL
        signed_url = supabase.storage.from_('game-builds').create_signed_url(
            storage_path,
            3600  # 1 hour expiry
        )
        
        return signed_url['signedURL']
    except Exception as e:
        print(f"Error uploading or signing file: {e}")
        traceback.print_exc()
        return None

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
        
        # Store in Supabase if available
        download_url = f"/download/{job_id}"
        if supabase:
            try:
                # Upload to Supabase storage
                signed_url = upload_and_sign(zip_file, f"{job_id}.zip")
                if signed_url:
                    download_url = signed_url
                    print(f"Uploaded to Supabase with signed URL: {download_url}")
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
                    response = supabase.storage.from_('game-builds').download(f"{job_id}.zip")
                    
                    # Save zip file
                    zip_path = f"/tmp/{job_id}.zip"
                    with open(zip_path, 'wb') as f:
                        f.write(response)
                        
                    # Extract zip
                    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                        zip_ref.extractall(proj)
                        
                    print(f"Downloaded and extracted from Supabase storage for job {job_id}")
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
        if supabase:
            try:
                signed_url = upload_and_sign(dist_zip, f"{job_id}/dist.zip")
                if signed_url:
                    preview_url = signed_url.replace(".zip", "")  # Remove .zip extension for preview URL
                    print(f"Uploaded to Supabase with signed URL: {signed_url}")
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

@app.post("/improve")
async def improve_game(request: Request):
    try:
        data = await request.json()
        job_id = data.get("jobId")
        prompt = data.get("prompt")
        
        if not job_id or not prompt:
            raise HTTPException(status_code=400, detail="Job ID and prompt are required")
            
        # This would normally call GPT-Engineer, but for the demo we'll just log
        print(f"Improving job {job_id} with prompt: {prompt}")
        
        return {
            "status": "success",
            "jobId": job_id
        }
    except Exception as e:
        print(f"Error in /improve: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/logs/{job_id}")
async def get_logs(job_id: str):
    try:
        # For demo purposes, just return some fake logs
        logs = [
            f"Processing job: {job_id}",
            "Analyzing current code...",
            "Making improvements based on prompt...",
            "Updating files...",
            "Build completed successfully!"
        ]
        
        return {
            "logs": logs
        }
    except Exception as e:
        print(f"Error in /logs: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download/{job_id}")
async def download_game(job_id: str):
    try:
        # First try to get from Supabase
        zip_path = None
        
        if supabase:
            try:
                response = supabase.storage.from_('game-builds').download(f"{job_id}.zip")
                
                # Save to a temporary file
                temp_fd, zip_path = tempfile.mkstemp(suffix='.zip')
                with os.fdopen(temp_fd, 'wb') as f:
                    f.write(response)
                    
                print(f"Downloaded {job_id}.zip from Supabase")
            except Exception as e:
                print(f"Could not download from Supabase: {e}")
        
        # If not found in Supabase, check if we have a local copy
        if not zip_path:
            local_path = f"/tmp/{job_id}.zip"
            if os.path.exists(local_path):
                zip_path = local_path
            else:
                # If we don't have the file, create a simple zip
                print(f"Creating empty project for {job_id}")
                proj = f"/tmp/projects/{job_id}"
                os.makedirs(proj, exist_ok=True)
                
                with open(f"{proj}/index.html", "w") as f:
                    f.write("""<!DOCTYPE html>
<html>
<head>
    <title>Empty Project</title>
</head>
<body>
    <h1>Empty Project</h1>
    <p>This is a placeholder for a project that hasn't been created yet.</p>
</body>
</html>
""")
                
                zip_path = shutil.make_archive(f"/tmp/{job_id}", 'zip', proj)
        
        # Validate that it's a valid ZIP file
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # Just testing that we can open it
                pass
        except zipfile.BadZipFile:
            print(f"Bad zip file: {zip_path}")
            raise HTTPException(status_code=500, detail="Invalid ZIP file")
        
        # Return the file
        return FileResponse(
            zip_path, 
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={job_id}.zip"}
        )
    except Exception as e:
        print(f"Error in /download: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/preview/{job_id}")
async def preview_game(job_id: str, path: str = "index.html"):
    try:
        # Check if we have a dist.zip in Supabase
        if supabase:
            try:
                response = supabase.storage.from_('game-builds').download(f"{job_id}/dist.zip")
                
                # Save to a temporary file
                temp_fd, zip_path = tempfile.mkstemp(suffix='.zip')
                with os.fdopen(temp_fd, 'wb') as f:
                    f.write(response)
                    
                # Extract to a temporary directory
                temp_dir = tempfile.mkdtemp()
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)
                    
                # Return the requested file
                file_path = os.path.join(temp_dir, path)
                if os.path.exists(file_path):
                    return FileResponse(file_path)
                else:
                    raise HTTPException(status_code=404, detail=f"File {path} not found")
            except Exception as e:
                print(f"Could not download dist.zip from Supabase: {e}")
        
        # If not found in Supabase, check local directory
        proj_dist = f"/tmp/projects/{job_id}/dist"
        if os.path.exists(proj_dist):
            file_path = os.path.join(proj_dist, path)
            if os.path.exists(file_path):
                return FileResponse(file_path)
        
        # If no dist directory, try the project root
        proj_root = f"/tmp/projects/{job_id}"
        if os.path.exists(proj_root):
            file_path = os.path.join(proj_root, path)
            if os.path.exists(file_path):
                return FileResponse(file_path)
        
        raise HTTPException(status_code=404, detail=f"File {path} not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in /preview: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/file/{job_id}/{path:path}")
async def get_file(job_id: str, path: str):
    try:
        # First check for edited file in Supabase
        if supabase:
            try:
                edit_path = f"edits/{job_id}/{path}"
                response = supabase.storage.from_('game-builds').download(edit_path)
                
                # Determine content type
                content_type = "text/plain"
                if path.endswith(".js"):
                    content_type = "application/javascript"
                elif path.endswith(".html"):
                    content_type = "text/html"
                elif path.endswith(".css"):
                    content_type = "text/css"
                elif path.endswith(".json"):
                    content_type = "application/json"
                    
                return Response(
                    content=response,
                    media_type=content_type
                )
            except Exception as e:
                print(f"Could not find edited file in Supabase: {e}")
        
        # If not found in edits, check project files in Supabase
        if supabase:
            try:
                project_path = f"projects/{job_id}/{path}"
                response = supabase.storage.from_('game-builds').download(project_path)
                
                # Determine content type
                content_type = "text/plain"
                if path.endswith(".js"):
                    content_type = "application/javascript"
                elif path.endswith(".html"):
                    content_type = "text/html"
                elif path.endswith(".css"):
                    content_type = "text/css"
                elif path.endswith(".json"):
                    content_type = "application/json"
                    
                return Response(
                    content=response,
                    media_type=content_type
                )
            except Exception as e:
                print(f"Could not find project file in Supabase: {e}")
        
        # If not found in Supabase, check local directory
        file_path = os.path.join("/tmp/projects", job_id, path)
        if os.path.exists(file_path):
            return FileResponse(file_path)
        
        raise HTTPException(status_code=404, detail=f"File {path} not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in /file: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
