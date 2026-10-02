"""HTTP API used by the ShotBoard app. Listens on 127.0.0.1 only; every call needs the launch token."""

import threading

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from . import __version__
from .animatic import JobStore, encode, find_ffmpeg
from .models import AnimaticRequest, PdfRequest
from .pdf import make_pdf


def create_app(token: str) -> FastAPI:
    app = FastAPI(title="ShotBoard export helper", version=__version__, docs_url=None, redoc_url=None)
    jobs = JobStore()
    ffmpeg = find_ffmpeg()

    # The app's pages are served from file:// (desktop) or localhost (dev), so allow any origin;
    # the token is what protects the API.
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

    @app.middleware("http")
    async def check_token(request: Request, call_next):
        if request.method != "OPTIONS" and request.headers.get("x-shotboard-token") != token:
            return JSONResponse({"detail": "Missing or wrong token"}, status_code=401)
        return await call_next(request)

    @app.get("/health")
    def health():
        return {"ok": True, "version": __version__, "ffmpeg": {"found": ffmpeg is not None, "path": ffmpeg}}

    @app.post("/pdf")
    def pdf(req: PdfRequest):
        if not req.shots:
            raise HTTPException(400, "No shots to export")
        return Response(make_pdf(req), media_type="application/pdf")

    @app.post("/animatic")
    def start_animatic(req: AnimaticRequest):
        if not ffmpeg:
            raise HTTPException(503, "ffmpeg is not installed, so MP4 export isn't available")
        job = jobs.create(req)
        return job.to_json()

    def _job(job_id: str):
        job = jobs.get(job_id)
        if not job:
            raise HTTPException(404, "No such export")
        return job

    @app.put("/animatic/{job_id}/frames/{index}", status_code=204)
    async def put_frame(job_id: str, index: int, request: Request):
        job = _job(job_id)
        if job.state != "receiving":
            raise HTTPException(409, f"Export is {job.state}")
        if not 0 <= index < job.request.total_frames:
            raise HTTPException(400, "Frame number out of range")
        (job.dir / f"{index:06d}.jpg").write_bytes(await request.body())
        job.received.add(index)
        return Response(status_code=204)

    @app.post("/animatic/{job_id}/finish")
    def finish(job_id: str):
        job = _job(job_id)
        missing = job.request.total_frames - len(job.received)
        if missing:
            raise HTTPException(400, f"{missing} frames are missing")
        job.state = "encoding"
        threading.Thread(target=encode, args=(job, ffmpeg), daemon=True).start()
        return job.to_json()

    @app.get("/jobs/{job_id}")
    def status(job_id: str):
        return _job(job_id).to_json()

    @app.get("/jobs/{job_id}/file")
    def download(job_id: str):
        job = _job(job_id)
        if job.state != "done":
            raise HTTPException(409, f"Export is {job.state}")
        return FileResponse(job.output, media_type="video/mp4", filename="animatic.mp4")

    @app.delete("/jobs/{job_id}", status_code=204)
    def cancel(job_id: str):
        job = jobs.get(job_id)
        if job:
            job.state = "cancelled"
            jobs.remove(job_id)
        return Response(status_code=204)

    return app
