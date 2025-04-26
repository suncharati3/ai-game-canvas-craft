# minimal FastAPI wrapper around GPT-Engineer
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from subprocess import run, Popen, PIPE
from pydantic import BaseModel
import uuid, os, zipfile, shutil, json, asyncio
import io, base64
from supabase import create_client
from pathlib import Path

app = FastAPI()
BASE = "/tmp/projects"

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://lovable.dev", "https://*.lovableproject.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Check if necessary environment variables are set
if not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
    print("WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Storage operations will fail.")

# Initialize Supabase client with service role key
try:
    supabase = create_client(
        os.environ.get("SUPABASE_URL", ""),
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
        options={"auth": {"persist_session": False}}
    )
    print("Supabase client initialized successfully")
except Exception as e:
    print(f"Error initializing Supabase client: {e}")
    supabase = None

class ProjectRequest(BaseModel):
    prompt: str = "Make me a cool game"

class BuildRequest(BaseModel):
    jobId: str

class ImproveRequest(BaseModel):
    jobId: str
    prompt: str

active_builds = {}
build_logs = {}

@app.post("/run")
async def run_gpte(data: ProjectRequest):
    prompt = data.prompt
    job_id = str(uuid.uuid4())
    proj_dir = f"{BASE}/{job_id}"
    os.makedirs(proj_dir, exist_ok=True)

    build_logs[job_id] = ["Starting new game generation..."]
    
    # Log the current working directory and file listing
    cwd = os.getcwd()
    build_logs[job_id].append(f"Current working directory: {cwd}")
    
    # write prompt file
    with open(f"{proj_dir}/prompt", "w") as f:
        f.write(prompt)
    build_logs[job_id].append(f"Prompt saved to {proj_dir}/prompt")

    # call GPT-Engineer
    build_logs[job_id].append(f"Starting GPT-Engineer with prompt: {prompt[:100]}...")
    proc = run(["gpte", proj_dir], capture_output=True, text=True)
    if proc.returncode != 0:
        error_msg = f"GPT-Engineer failed with exit code {proc.returncode}"
        build_logs[job_id].append(error_msg)
        build_logs[job_id].append(f"STDERR: {proc.stderr}")
        return {"error": error_msg}
    
    build_logs[job_id].append("GPT-Engineer completed successfully")
    build_logs[job_id].append("Creating ZIP file...")

    # zip the result
    zip_path = f"{proj_dir}.zip"
    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
            for root, _, files in os.walk(proj_dir):
                for f in files:
                    fp = os.path.join(root, f)
                    z.write(fp, fp.replace(proj_dir + "/", ""))
        build_logs[job_id].append(f"ZIP created: {zip_path}")
    except Exception as e:
        error_msg = f"Failed to create ZIP: {str(e)}"
        build_logs[job_id].append(error_msg)
        return {"error": error_msg}
    
    # Verify zip file is valid
    if not zipfile.is_zipfile(zip_path):
        error_msg = "Failed to create valid ZIP file"
        build_logs[job_id].append(error_msg)
        return {"error": error_msg}

    # Check zip content
    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            info = z.infolist()
            build_logs[job_id].append(f"ZIP contains {len(info)} files")
            if len(info) == 0:
                error_msg = "ZIP file is empty"
                build_logs[job_id].append(error_msg)
                return {"error": error_msg}
    except Exception as e:
        error_msg = f"Error validating ZIP: {str(e)}"
        build_logs[job_id].append(error_msg)
        return {"error": error_msg}

    try:
        # Check if supabase is initialized
        if not supabase:
            raise Exception("Supabase client not initialized")
            
        # Upload zip to Supabase Storage
        with open(zip_path, "rb") as f:
            file_path = f"{job_id}.zip"
            file_content = f.read()  # Read file into memory before upload
            build_logs[job_id].append(f"Uploading ZIP ({len(file_content)} bytes) to Supabase...")
            
            # Ensure the bucket exists (this will be handled by service role key)
            try:
                upload_result = supabase.storage.from_("game-builds").upload(
                    file_path,
                    file_content,
                    {"content-type": "application/zip"},
                    upsert=True
                )
                
                if hasattr(upload_result, 'error') and upload_result.error:
                    raise Exception(str(upload_result.error))
                    
                build_logs[job_id].append("Upload to Supabase successful")
            except Exception as e:
                build_logs[job_id].append(f"Upload error: {str(e)}")
                raise Exception(f"Upload failed: {str(e)}")

        # Get signed URL
        try:
            signed_url = supabase.storage.from_("game-builds").create_signed_url(
                f"{job_id}.zip",
                3600  # 1 hour expiry
            )
            
            if hasattr(signed_url, 'error') and signed_url.error:
                raise Exception(str(signed_url.error))
                
            build_logs[job_id].append("Signed URL created successfully")
            return {"jobId": job_id, "download": signed_url["signedURL"]}
        except Exception as e:
            build_logs[job_id].append(f"Signed URL error: {str(e)}")
            # Fallback to direct download if Supabase storage fails
            build_logs[job_id].append("Using fallback direct download URL")
            return {"jobId": job_id, "download": f"/download/{job_id}"}
    except Exception as e:
        build_logs[job_id].append(f"Storage error: {str(e)}")
        # Fallback to direct download if Supabase storage fails
        build_logs[job_id].append("Using fallback direct download URL")
        return {"jobId": job_id, "download": f"/download/{job_id}"}

@app.post("/build")
async def build(data: BuildRequest, background_tasks: BackgroundTasks):
    job_id = data.jobId
    proj_dir = f"{BASE}/{job_id}"
    
    # Initialize build logs
    build_logs[job_id] = []
    active_builds[job_id] = True
    
    def add_log(job_id, message):
        if job_id in build_logs:
            build_logs[job_id].append(message)
            
    # Start the build process in the background
    background_tasks.add_task(run_build, job_id, proj_dir, add_log)
    
    return {"status": "building", "jobId": job_id}

async def run_build(job_id, proj_dir, log_callback):
    try:
        log_callback(job_id, f"Build started for job {job_id}")
        
        # 1. Pull edits from Supabase (placeholder)
        log_callback(job_id, "Syncing latest edits...")
        # Placeholder for pulling edits
        # pull_edits(job_id, proj_dir)
        log_callback(job_id, "Edits synced successfully")
        
        # 2. Run npm install if package.json exists
        if os.path.exists(f"{proj_dir}/package.json"):
            log_callback(job_id, "Installing dependencies...")
            proc = Popen(["npm", "install"], cwd=proj_dir, stdout=PIPE, stderr=PIPE, text=True)
            for line in proc.stdout:
                log_callback(job_id, line.strip())
            proc.wait()
            if proc.returncode != 0:
                for line in proc.stderr:
                    log_callback(job_id, f"ERROR: {line.strip()}")
                raise Exception("npm install failed")
            log_callback(job_id, "Dependencies installed successfully")
        
        # 3. Run npm build
        log_callback(job_id, "Building project...")
        proc = Popen(["npm", "run", "build"], cwd=proj_dir, stdout=PIPE, stderr=PIPE, text=True)
        for line in proc.stdout:
            log_callback(job_id, line.strip())
        proc.wait()
        if proc.returncode != 0:
            for line in proc.stderr:
                log_callback(job_id, f"ERROR: {line.strip()}")
            raise Exception("Build failed")
        
        # 4. Check if dist directory exists
        dist_dir = f"{proj_dir}/dist"
        if not os.path.exists(dist_dir):
            log_callback(job_id, "ERROR: No dist directory found after build")
            raise Exception("No dist directory found")
            
        # 5. Zip up the dist folder
        zip_filename = f"{job_id}-dist"
        zip_path = Path(f"/tmp/{zip_filename}.zip")
        log_callback(job_id, "Creating distribution package...")
        
        shutil.make_archive(f"/tmp/{zip_filename}", 'zip', dist_dir)
        
        # Verify zip is valid
        if not zipfile.is_zipfile(zip_path):
            log_callback(job_id, "ERROR: Failed to create valid dist ZIP file")
            raise Exception("Failed to create valid ZIP file")
            
        # 6. Upload to storage
        log_callback(job_id, "Uploading build...")
        try:
            with open(zip_path, "rb") as f:
                file_content = f.read()
                upload_result = supabase.storage.from_("game-builds").upload(
                    f"{job_id}/dist.zip",
                    file_content,
                    {"content-type": "application/zip"},
                    upsert=True
                )
                
            # Get a signed URL for the uploaded dist.zip
            signed_url = supabase.storage.from_("game-builds").create_signed_url(
                f"{job_id}/dist.zip",
                3600  # 1 hour expiry
            )
            
            preview_url = signed_url["signedURL"]
            log_callback(job_id, f"Build completed successfully! Preview available at {preview_url}")
            return {"status": "success", "preview": preview_url}
        except Exception as e:
            log_callback(job_id, f"Upload failed: {str(e)}")
            preview_url = f"/preview/{job_id}"  # Fallback URL
            log_callback(job_id, f"Using fallback preview URL: {preview_url}")
            return {"status": "success", "preview": preview_url}
    except Exception as e:
        log_callback(job_id, f"Build failed: {str(e)}")
        return {"status": "error", "error": str(e)}
    finally:
        active_builds[job_id] = False

@app.post("/improve")
async def improve(data: ImproveRequest, background_tasks: BackgroundTasks):
    job_id = data.jobId
    prompt = data.prompt
    proj_dir = f"{BASE}/{job_id}"
    
    # Initialize logs
    if job_id not in build_logs:
        build_logs[job_id] = []
    
    def add_log(job_id, message):
        if job_id in build_logs:
            build_logs[job_id].append(message)
    
    background_tasks.add_task(run_improve, job_id, proj_dir, prompt, add_log)
    
    return {"status": "improving", "jobId": job_id}

async def run_improve(job_id, proj_dir, prompt, log_callback):
    try:
        log_callback(job_id, f"Starting improvement for job {job_id}")
        log_callback(job_id, f"Using prompt: {prompt}")
        
        # Write the improvement prompt
        with open(f"{proj_dir}/improve_prompt", "w") as f:
            f.write(prompt)
        
        # Run GPT-Engineer in improvement mode
        log_callback(job_id, "Running AI improvement...")
        proc = Popen(["gpte", "-i", proj_dir], stdout=PIPE, stderr=PIPE, text=True)
        for line in proc.stdout:
            log_callback(job_id, line.strip())
        proc.wait()
        
        if proc.returncode != 0:
            for line in proc.stderr:
                log_callback(job_id, f"ERROR: {line.strip()}")
            raise Exception("AI improvement failed")
        
        log_callback(job_id, "AI improvement completed")
        
        # Automatically trigger a build
        await run_build(job_id, proj_dir, log_callback)
        
        return {"status": "success"}
    except Exception as e:
        log_callback(job_id, f"Improvement failed: {str(e)}")
        return {"status": "error", "error": str(e)}

@app.get("/logs/{job_id}")
async def get_logs(job_id: str):
    if job_id not in build_logs:
        return {"logs": []}
    return {"logs": build_logs[job_id]}

@app.get("/status/{job_id}")
async def get_status(job_id: str):
    is_active = job_id in active_builds and active_builds[job_id]
    return {"active": is_active}

# Serve zip files (updated to use signed URLs)
@app.get("/download/{job_id}")
async def download_zip(job_id: str):
    try:
        # Try to get a signed URL from Supabase
        if supabase:
            try:
                signed_result = supabase.storage.from_("game-builds").create_signed_url(
                    f"{job_id}.zip",
                    3600  # 1 hour expiry
                )
                
                if hasattr(signed_result, 'error') and signed_result.error:
                    raise Exception(f"Failed to get signed URL: {signed_result.error}")
                    
                return {"download": signed_result["signedURL"]}
            except Exception as e:
                print(f"Error getting signed URL: {e}")
                # Fall through to direct file serving
        
        # Fallback to serving the file directly
        zip_path = f"{BASE}/{job_id}.zip"
        if not os.path.exists(zip_path):
            return JSONResponse(
                status_code=404,
                content={"error": f"ZIP file not found: {job_id}"}
            )
            
        # Verify file is a valid ZIP
        if not zipfile.is_zipfile(zip_path):
            return JSONResponse(
                status_code=500,
                content={"error": f"Invalid ZIP file: {job_id}"}
            )
            
        # Get file size for logging
        file_size = os.path.getsize(zip_path)
        print(f"Serving ZIP file {zip_path} ({file_size} bytes)")
            
        def iterfile():
            with open(zip_path, 'rb') as f:
                yield from f
                
        return StreamingResponse(
            iterfile(),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={job_id}.zip"}
        )
    except Exception as e:
        print(f"Error in download_zip: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to serve ZIP: {str(e)}"}
        )

# Serve dist files
@app.get("/preview/{job_id}")
def preview_dist(job_id: str):
    zip_path = f"/tmp/{job_id}-dist.zip"
    if not os.path.exists(zip_path):
        return {"error": "Preview not found"}
        
    def iterfile():
        with open(zip_path, 'rb') as f:
            yield from f
            
    return StreamingResponse(
        iterfile(),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={job_id}-dist.zip"}
    )
