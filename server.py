
# minimal FastAPI wrapper around GPT-Engineer
from fastapi import FastAPI
from subprocess import run
import uuid, os, zipfile, shutil

app = FastAPI()
BASE = "/tmp/projects"

@app.post("/run")
async def run_gpte(data: dict):
    prompt = data.get("prompt", "Make me a cool game")
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

    # (optional) TODO: upload zip to Supabase Storage
    return {"jobId": job_id, "download": zip_path}
