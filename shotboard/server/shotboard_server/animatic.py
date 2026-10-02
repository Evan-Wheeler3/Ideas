"""Animatic jobs: the app uploads frames, then we burn in shot info and encode an MP4 with ffmpeg."""

import json
import shutil
import subprocess
import tempfile
import threading
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .models import AnimaticRequest


def find_ffmpeg() -> str | None:
    """System ffmpeg if installed, else the one bundled with imageio-ffmpeg."""
    path = shutil.which("ffmpeg")
    if path:
        return path
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def timecode(frame: int, fps: float) -> str:
    """HH:MM:SS:FF for a frame number."""
    whole = round(fps)
    secs, ff = divmod(frame, whole)
    mins, ss = divmod(secs, 60)
    hh, mm = divmod(mins, 60)
    return f"{hh:02d}:{mm:02d}:{ss:02d}:{ff:02d}"


@dataclass
class Job:
    id: str
    request: AnimaticRequest
    dir: Path
    state: str = "receiving"  # receiving → encoding → done | error | cancelled
    progress: float = 0.0
    message: str = ""
    received: set[int] = field(default_factory=set)
    process: subprocess.Popen | None = None

    @property
    def output(self) -> Path:
        return self.dir / "animatic.mp4"

    def to_json(self) -> dict:
        return {
            "id": self.id,
            "state": self.state,
            "progress": round(self.progress, 4),
            "message": self.message,
            "received": len(self.received),
            "total": self.request.total_frames,
        }


class JobStore:
    def __init__(self) -> None:
        self.jobs: dict[str, Job] = {}
        self.lock = threading.Lock()

    def create(self, req: AnimaticRequest) -> Job:
        job = Job(id=uuid.uuid4().hex[:12], request=req, dir=Path(tempfile.mkdtemp(prefix="shotboard-")))
        with self.lock:
            self.jobs[job.id] = job
        return job

    def get(self, job_id: str) -> Job | None:
        return self.jobs.get(job_id)

    def remove(self, job_id: str) -> None:
        with self.lock:
            job = self.jobs.pop(job_id, None)
        if job:
            if job.process and job.process.poll() is None:
                job.process.kill()
            shutil.rmtree(job.dir, ignore_errors=True)


def _font(size: int):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # Pillow < 10.1
        return ImageFont.load_default()


def burn_in(job: Job) -> None:
    """Draw shot number, type, lens and timecode along the bottom of every frame."""
    req = job.request
    size = max(12, round(req.height * 0.032))
    font = _font(size)
    pad = round(size * 0.6)
    bar_h = size + pad * 2
    frame = 0
    for shot in req.shots:
        left = f"SHOT {shot.number}   {shot.type}   {shot.lens}"
        for _ in range(shot.frames):
            path = job.dir / f"{frame:06d}.jpg"
            if path.exists():
                with Image.open(path) as im:
                    im = im.convert("RGB")
                    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
                    d = ImageDraw.Draw(overlay)
                    d.rectangle([0, im.height - bar_h, im.width, im.height], fill=(0, 0, 0, 150))
                    d.text((pad, im.height - bar_h + pad), left, font=font, fill=(255, 255, 255, 235))
                    tc = timecode(frame, req.fps)
                    tw = d.textlength(tc, font=font)
                    d.text((im.width - pad - tw, im.height - bar_h + pad), tc, font=font, fill=(255, 200, 90, 235))
                    if req.title:
                        d.text((pad, pad), req.title, font=_font(round(size * 0.8)), fill=(255, 255, 255, 170))
                    Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB").save(path, quality=92)
            frame += 1
            if job.state == "cancelled":
                return
            # Burn-in is the first ~30% of the work; encoding is the rest.
            job.progress = 0.3 * frame / req.total_frames


def encode(job: Job, ffmpeg: str) -> None:
    req = job.request
    total = req.total_frames
    try:
        if req.burn_in:
            burn_in(job)
        if job.state == "cancelled":
            return
        cmd = [
            ffmpeg, "-y", "-loglevel", "error", "-progress", "pipe:1",
            "-framerate", f"{req.fps}", "-i", str(job.dir / "%06d.jpg"),
            # H.264 needs even dimensions.
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", "-r", f"{req.fps}",
            str(job.output),
        ]
        job.process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        base = 0.3 if req.burn_in else 0.0
        assert job.process.stdout
        for line in job.process.stdout:
            if line.startswith("frame="):
                try:
                    job.progress = base + (1 - base) * min(int(line.split("=")[1]) / total, 1.0)
                except ValueError:
                    pass
        code = job.process.wait()
        if job.state == "cancelled":
            return
        if code != 0:
            err = job.process.stderr.read() if job.process.stderr else ""
            job.state = "error"
            job.message = f"ffmpeg failed: {err.strip()[-400:] or code}"
            return
        job.progress = 1.0
        job.state = "done"
    except Exception as e:  # report, don't crash the server
        job.state = "error"
        job.message = str(e)


def manifest(job: Job) -> str:
    return json.dumps(job.request.model_dump(by_alias=True))
