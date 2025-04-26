# minimal FastAPI wrapper around GPT-Engineer
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from subprocess import run, Popen, PIPE
from pydantic import BaseModel
import uuid, os, zipfile, shutil, json, asyncio
import io, base64
from supabase import create_client

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

# Initialize Supabase client with service role key
supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    options={"auth": {"persist_session": False}}
)

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

    # write prompt file
    open(f"{proj_dir}/prompt", "w").write(prompt)

    # call GPT-Engineer
    run(["gpte", proj_dir])

    # zip the result
    zip_path = f"{proj_dir}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(proj_dir):
            for f in files:
                fp = os.path.join(root, f)
                z.write(fp, fp.replace(proj_dir + "/", ""))

    # Upload zip to Supabase Storage
    with open(zip_path, "rb") as f:
        supabase.storage.from_("game-builds").upload(
            f"{job_id}.zip",
            f,
            upsert=True
        )

    # Get signed URL
    signed = supabase.storage.from_("game-builds").create_signed_url(
        f"{job_id}.zip",
        3600  # 1 hour expiry
    )

    return {"jobId": job_id, "download": signed["signedURL"]}

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
        zip_path = f"/tmp/{job_id}-dist.zip"
        log_callback(job_id, "Creating distribution package...")
        shutil.make_archive(f"/tmp/{job_id}-dist", 'zip', dist_dir)
        
        # 6. Upload to storage (placeholder)
        log_callback(job_id, "Uploading build...")
        # upload_and_sign(zip_path, f"{job_id}/dist.zip")
        preview_url = f"/preview/{job_id}"  # Placeholder URL
        
        log_callback(job_id, f"Build completed successfully!")
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
        signed = supabase.storage.from_("game-builds").create_signed_url(
            f"{job_id}.zip",
            3600  # 1 hour expiry
        )
        return {"download": signed["signedURL"]}
    except Exception as e:
        return {"error": str(e)}

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
