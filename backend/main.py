import os
import uuid
import time
import asyncio
from pydantic import BaseModel
from fastapi import FastAPI, BackgroundTasks, UploadFile, File, Form, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import sys
# Asegurar que tanto la raíz del proyecto como backend estén en sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
for p in [current_dir, parent_dir]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from backend.config import settings
    from backend.middleware import get_user_credentials, validate_credentials
    from backend.database.db import init_db, get_db, Clip, Campaign
    from backend.models.schemas import (
        VideoProcessRequest, ProcessingStatus, ClipResult, 
        CampaignCreate, CampaignUpdate, CampaignResponse
    )
    from backend.security import (
        RateLimiter, InputSanitizer, SecurityHeadersMiddleware,
        CredentialEncryption, AuditLogger, RequestValidator
    )
    from backend.services.downloader import download_video
    from backend.services.transcriber import transcriber_service
    from backend.services.clip_selector import clip_selector_service
    from backend.services.video_processor import cut_clip, add_subtitles, reframe_vertical
    from backend.services.campaign_manager import campaign_manager_service
    from backend.services.face_tracker import face_tracker_service
except ImportError:
    from config import settings
    from middleware import get_user_credentials, validate_credentials
    from database.db import init_db, get_db, Clip, Campaign
    from models.schemas import (
        VideoProcessRequest, ProcessingStatus, ClipResult, 
        CampaignCreate, CampaignUpdate, CampaignResponse
    )
    from security import (
        RateLimiter, InputSanitizer, SecurityHeadersMiddleware,
        CredentialEncryption, AuditLogger, RequestValidator
    )
    from services.downloader import download_video
    from services.transcriber import transcriber_service
    from services.clip_selector import clip_selector_service
    from services.video_processor import cut_clip, add_subtitles, reframe_vertical
    from services.campaign_manager import campaign_manager_service
    from services.face_tracker import face_tracker_service

app = FastAPI(title="ClipEngine API")

process_limiter = RateLimiter(max_requests=5, window_seconds=60)
auth_limiter = RateLimiter(max_requests=10, window_seconds=60)
general_limiter = RateLimiter(max_requests=60, window_seconds=60)
sanitizer = InputSanitizer()
audit = AuditLogger()
credential_crypto = CredentialEncryption(settings.SESSION_SECRET if hasattr(settings, "SESSION_SECRET") else "default_secret_key_1234567890123")
request_validator = RequestValidator()

app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware('http')
async def rate_limit_middleware(request: Request, call_next):
    ip = request.client.host if request.client else 'unknown'
    if '/process' in request.url.path:
        allowed = await process_limiter.check(ip)
    elif '/auth' in request.url.path:
        allowed = await auth_limiter.check(ip)
    else:
        allowed = await general_limiter.check(ip)
    if not allowed:
        await audit.log_security_event(ip, 'RATE_LIMIT', request.url.path)
        return JSONResponse(status_code=429, content={'detail': 'Too many requests. Please wait.'})
    return await call_next(request)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    ip = request.client.host if request.client else 'unknown'
    await audit.log_security_event(ip, 'ERROR', str(exc))
    return JSONResponse(status_code=500, content={'detail': 'Internal server error'})

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.OUTPUT_DIR, exist_ok=True)

app.mount("/output", StaticFiles(directory=settings.OUTPUT_DIR), name="output")
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

jobs = {}

async def cleanup_task():
    while True:
        try:
            now = time.time()
            ttl_seconds = settings.TEMP_FILE_TTL_HOURS * 3600
            for d in [settings.UPLOAD_DIR, settings.OUTPUT_DIR]:
                for f in os.listdir(d):
                    p = os.path.join(d, f)
                    if os.path.isfile(p) and now - os.path.getmtime(p) > ttl_seconds:
                        os.remove(p)
        except Exception:
            pass
        await asyncio.sleep(3600)

@app.on_event("startup")
async def startup_event():
    await init_db()
    asyncio.create_task(cleanup_task())

async def process_video_task(job_id: str, request: VideoProcessRequest, file_path: str = None, credentials: dict = None):
    try:
        jobs[job_id] = {
            "status": "processing", 
            "step": "download",
            "progress": 5, 
            "message": "Preparando entorno...", 
            "clips": []
        }
        
        if request.url:
            jobs[job_id]["step"] = "download"
            jobs[job_id]["progress"] = 15
            jobs[job_id]["message"] = "Descargando video desde la URL..."
            print(f"[{job_id[:8]}] Descargando: {request.url}")
            info = await download_video(request.url, settings.UPLOAD_DIR)
            file_path = info['filepath']
        
        jobs[job_id]["step"] = "transcribe"
        jobs[job_id]["progress"] = 35
        jobs[job_id]["message"] = "Transcribiendo audio con Whisper..."
        print(f"[{job_id[:8]}] Transcribiendo: {file_path}")
        transcript_data = await transcriber_service.transcribe(file_path)
        
        jobs[job_id]["step"] = "analyze"
        jobs[job_id]["progress"] = 55
        jobs[job_id]["message"] = "Analizando y seleccionando mejores momentos con IA..."
        print(f"[{job_id[:8]}] Analizando momentos virales con IA...")
        
        try:
            from backend.database.db import async_session
        except ImportError:
            from database.db import async_session
            
        async with async_session() as db:
            campaigns = await campaign_manager_service.get_campaigns(db, status="active")
        
        clips = await clip_selector_service.select_clips(
            transcript_data, 
            request.min_duration, 
            request.max_duration, 
            request.clip_count,
            campaigns,
            credentials
        )
        
        jobs[job_id]["step"] = "cut"
        jobs[job_id]["progress"] = 70
        jobs[job_id]["message"] = f"Generando {len(clips)} clips personalizados..."
        print(f"[{job_id[:8]}] Generando {len(clips)} clips...")
        
        generated_clips = []
        async with async_session() as db:
            total_clips = len(clips)
            for idx, clip in enumerate(clips):
                progress_val = 70 + int(((idx + 1) / max(1, total_clips)) * 25)
                jobs[job_id]["progress"] = min(95, progress_val)
                jobs[job_id]["message"] = f"Cortando clip {idx+1} de {total_clips}..."
                
                output_name = os.path.join(settings.OUTPUT_DIR, f"{job_id}_{idx}.mp4")
                
                await cut_clip(file_path, clip['start_time'], clip['end_time'], output_name)
                
                if request.reframe_vertical:
                    try:
                        faces = await face_tracker_service.track_faces(output_name)
                        await reframe_vertical(output_name, faces, output_name)
                    except Exception as e:
                        print(f"[{job_id[:8]}] Reframe error: {e}")
                
                if request.add_subtitles:
                    try:
                        words = []
                        for seg in transcript_data.get('segments', []):
                            for w in seg.get('words', []):
                                if w['start'] >= clip['start_time'] and w['end'] <= clip['end_time']:
                                    w_copy = w.copy()
                                    w_copy['start'] -= clip['start_time']
                                    w_copy['end'] -= clip['start_time']
                                    words.append(w_copy)
                        if words:
                            await add_subtitles(output_name, words, output_name, request.subtitle_style)
                    except Exception as e:
                        print(f"[{job_id[:8]}] Subtitle error: {e}")

                # Guardar en Base de Datos
                new_clip = Clip(
                    video_source=request.url or "upload",
                    title=clip.get("title", f"Clip #{idx+1}"),
                    start_time=clip['start_time'],
                    end_time=clip['end_time'],
                    duration=clip['end_time'] - clip['start_time'],
                    transcript=clip.get("summary", ""),
                    virality_score=clip.get("virality_score", 80.0),
                    output_path=output_name,
                    campaign_id=clip.get("campaign_matches", [{}])[0].get("campaign_id") if clip.get("campaign_matches") else None,
                    status="done"
                )
                db.add(new_clip)
                await db.commit()
                await db.refresh(new_clip)
                
                generated_clips.append(ClipResult(
                    id=new_clip.id,
                    title=new_clip.title,
                    start_time=new_clip.start_time,
                    end_time=new_clip.end_time,
                    duration=new_clip.duration,
                    transcript=new_clip.transcript,
                    virality_score=new_clip.virality_score,
                    output_path=new_clip.output_path,
                    campaign_id=new_clip.campaign_id
                ))
            
        jobs[job_id]["step"] = "export"
        jobs[job_id]["progress"] = 100
        jobs[job_id]["status"] = "done"
        jobs[job_id]["message"] = "¡Clips generados exitosamente!"
        jobs[job_id]["clips"] = generated_clips
        print(f"[{job_id[:8]}] Proceso completado exitosamente.")

    except Exception as e:
        import traceback
        traceback.print_exc()
        jobs[job_id]["status"] = "error"
        jobs[job_id]["message"] = f"Error: {str(e)}"
        print(f"[{job_id[:8]}] Error en proceso: {e}")

@app.post("/api/process")
async def process_video(
    request_obj: Request,
    background_tasks: BackgroundTasks,
    request: VideoProcessRequest = None,
    file: UploadFile = File(None),
    min_duration: int = Form(30),
    max_duration: int = Form(60),
    clip_count: int = Form(5),
    add_subtitles: bool = Form(True),
    reframe_vertical: bool = Form(True),
    subtitle_style: str = Form("hormozi"),
    credentials: dict = Depends(get_user_credentials)
):
    ip = request_obj.client.host if request_obj.client else 'unknown'
    await audit.log_request(request_obj, "PROCESS_VIDEO")
    
    job_id = str(uuid.uuid4())
    
    if file:
        file_path = os.path.join(settings.UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            f.write(await file.read())
        req = VideoProcessRequest(
            min_duration=min_duration,
            max_duration=max_duration,
            clip_count=clip_count,
            add_subtitles=add_subtitles,
            reframe_vertical=reframe_vertical,
            subtitle_style=subtitle_style
        )
        background_tasks.add_task(process_video_task, job_id, req, file_path, credentials)
    elif request and request.url:
        try:
            val_data = request_validator.validate_process_request(request.model_dump())
            request = VideoProcessRequest(**val_data)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        background_tasks.add_task(process_video_task, job_id, request, None, credentials)
    else:
        raise HTTPException(status_code=400, detail="Must provide url or file")

    jobs[job_id] = {
        "status": "pending", 
        "step": "download",
        "progress": 5, 
        "message": "En cola...", 
        "clips": []
    }
    return {"job_id": job_id, "jobId": job_id, "status": "pending"}

@app.get("/api/status/{job_id}", response_model=ProcessingStatus)
async def get_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return ProcessingStatus(job_id=job_id, **jobs[job_id])

@app.get("/api/clips")
async def list_clips(campaign_id: int = None, status: str = None, db: AsyncSession = Depends(get_db)):
    query = select(Clip)
    if campaign_id:
        query = query.where(Clip.campaign_id == campaign_id)
    if status:
        query = query.where(Clip.status == status)
    result = await db.execute(query)
    clips = result.scalars().all()
    return clips

@app.get("/api/clips/{clip_id}")
async def get_clip(clip_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Clip).where(Clip.id == clip_id))
    clip = result.scalars().first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    return clip

@app.delete("/api/clips/{clip_id}")
async def delete_clip(clip_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    clip = await get_clip(clip_id, db)
    ip = request.client.host if request.client else 'unknown'
    await audit.log_file_access(ip, clip.output_path, "delete")
    if os.path.exists(clip.output_path):
        os.remove(clip.output_path)
    await db.delete(clip)
    await db.commit()
    return {"status": "deleted"}

@app.get("/api/clips/{clip_id}/download")
async def download_clip_file(clip_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    from fastapi.responses import FileResponse
    clip = await get_clip(clip_id, db)
    ip = request.client.host if request.client else 'unknown'
    await audit.log_file_access(ip, clip.output_path, "download")
    try:
        safe_path = sanitizer.sanitize_path(clip.output_path, settings.OUTPUT_DIR)
    except ValueError:
        await audit.log_security_event(ip, "PATH_TRAVERSAL", f"Attempted to download: {clip.output_path}")
        raise HTTPException(status_code=400, detail="Invalid file path")
    return FileResponse(safe_path, media_type="video/mp4", filename=os.path.basename(safe_path))

@app.post("/api/clips/{clip_id}/trim")
async def trim_clip(clip_id: int, start_time: float, end_time: float, db: AsyncSession = Depends(get_db)):
    try:
        val_data = request_validator.validate_trim_request({"start_time": start_time, "end_time": end_time})
        start_time = val_data["start_time"]
        end_time = val_data["end_time"]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    clip = await get_clip(clip_id, db)
    new_out = clip.output_path.replace(".mp4", "_trimmed.mp4")
    await cut_clip(clip.output_path, start_time, end_time, new_out)
    clip.output_path = new_out
    clip.start_time += start_time
    clip.end_time = clip.start_time + (end_time - start_time)
    clip.duration = end_time - start_time
    await db.commit()
    return {"status": "trimmed", "output": new_out}

@app.get("/api/campaigns", response_model=list[CampaignResponse])
async def list_campaigns(status: str = None, db: AsyncSession = Depends(get_db)):
    camps = await campaign_manager_service.get_campaigns(db, status)
    res = []
    for c in camps:
        r = CampaignResponse.model_validate(c)
        clips = await campaign_manager_service.get_campaign_clips(db, c.id)
        r.clip_count = len(clips)
        res.append(r)
    return res

@app.post("/api/campaigns", response_model=CampaignResponse)
async def create_campaign(data: CampaignCreate, db: AsyncSession = Depends(get_db)):
    try:
        val_data = request_validator.validate_campaign_data(data.model_dump())
        data = CampaignCreate(**val_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    c = await campaign_manager_service.create_campaign(db, data)
    return CampaignResponse.model_validate(c)

@app.get("/api/campaigns/{id}", response_model=CampaignResponse)
async def get_campaign(id: int, db: AsyncSession = Depends(get_db)):
    c = await campaign_manager_service.get_campaign(db, id)
    if not c: raise HTTPException(404)
    r = CampaignResponse.model_validate(c)
    clips = await campaign_manager_service.get_campaign_clips(db, c.id)
    r.clip_count = len(clips)
    return r

@app.put("/api/campaigns/{id}", response_model=CampaignResponse)
async def update_campaign(id: int, data: CampaignUpdate, db: AsyncSession = Depends(get_db)):
    try:
        val_data = request_validator.validate_campaign_data(data.model_dump())
        data = CampaignUpdate(**val_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    c = await campaign_manager_service.update_campaign(db, id, data)
    return CampaignResponse.model_validate(c)

@app.delete("/api/campaigns/{id}")
async def delete_campaign(id: int, db: AsyncSession = Depends(get_db)):
    success = await campaign_manager_service.delete_campaign(db, id)
    if not success: raise HTTPException(404)
    return {"status": "deleted"}

@app.post("/api/campaigns/classify")
async def classify_pending_clips(db: AsyncSession = Depends(get_db)):
    clips = await db.execute(select(Clip).where(Clip.campaign_id == None))
    clips = clips.scalars().all()
    camps = await campaign_manager_service.get_campaigns(db, "active")
    
    clips_dicts = [{"id": c.id, "transcript": c.transcript, "title": c.title} for c in clips]
    enriched = await campaign_manager_service.classify_clips(clips_dicts, camps)
    
    for ec in enriched:
        if "campaign_id" in ec:
            for c in clips:
                if c.id == ec["id"]:
                    c.campaign_id = ec["campaign_id"]
                    c.campaign_match_score = ec.get("campaign_match_score")
    await db.commit()
    return {"status": "classified"}

@app.get("/api/campaigns/{id}/clips")
async def get_campaign_clips(id: int, db: AsyncSession = Depends(get_db)):
    return await campaign_manager_service.get_campaign_clips(db, id)

@app.get("/api/settings")
async def get_settings():
    return settings.model_dump()

@app.put("/api/settings")
async def update_settings(updates: dict):
    # Only in-memory for this simple demo
    for k, v in updates.items():
        if k in ["LLM_API_KEY", "LLM_PROVIDER", "LLM_MODEL", "OLLAMA_URL"]:
            continue
        if hasattr(settings, k):
            setattr(settings, k, v)
    return settings.model_dump()

class ValidateAuthRequest(BaseModel):
    provider: str
    api_key: str = ""
    model: str = None
    ollama_url: str = None

@app.post("/api/auth/validate")
async def validate_auth(req: ValidateAuthRequest, request: Request):
    ip = request.client.host if request.client else 'unknown'
    credentials = {
        "provider": req.provider,
        "api_key": req.api_key,
        "model": req.model,
        "ollama_url": req.ollama_url
    }
    valid = await validate_credentials(credentials)
    await audit.log_auth(ip, req.provider, valid)
    if valid:
        return {"valid": True, "message": "Credentials valid"}
    return {"valid": False, "message": "Invalid credentials"}

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}

# --- Serve Frontend Static Files ---
# In production, serve the built React app
frontend_dist = os.path.join(os.path.dirname(__file__), 'static')
if os.path.exists(frontend_dist):
    app.mount('/assets', StaticFiles(directory=os.path.join(frontend_dist, 'assets')), name='static-assets')
    
    @app.get('/{full_path:path}')
    async def serve_frontend(full_path: str):
        """Serve React SPA - all non-API routes return index.html."""
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, 'index.html'))

