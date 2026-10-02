import base64
import io
import json
import subprocess
import time

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from shotboard_server.animatic import find_ffmpeg, timecode
from shotboard_server.app import create_app

TOKEN = "test-token"
H = {"X-ShotBoard-Token": TOKEN}


@pytest.fixture()
def client():
    return TestClient(create_app(TOKEN))


def jpeg(w=64, h=27, color=(200, 120, 40)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, "JPEG")
    return buf.getvalue()


def shots(n=7, with_image=True):
    img = base64.b64encode(jpeg(480, 201)).decode() if with_image else None
    return [
        {
            "number": str(i + 1),
            "type": "CU",
            "typeLabel": "Close-up",
            "lens": "50mm f/2",
            "duration": 3.0,
            "notes": f"Shot {i + 1} notes & <special> characters\nsecond line",
            "fields": {"location": "INT. DINER – NIGHT"},
            "image": img if i % 3 else None,
        }
        for i in range(n)
    ]


def test_requires_token(client):
    assert client.get("/health").status_code == 401
    assert client.get("/health", headers={"X-ShotBoard-Token": "nope"}).status_code == 401
    r = client.get("/health", headers=H)
    assert r.status_code == 200 and r.json()["ok"]


@pytest.mark.parametrize("layout", ["storyboard", "list"])
def test_pdf_layouts(client, layout):
    body = {
        "title": "Diner Scene",
        "subtitle": "Sample Film · Director",
        "layout": layout,
        "pageSize": "a4",
        "aspect": 2.39,
        "columns": [{"id": c, "label": c.title()} for c in ["thumb", "number", "type", "lens", "duration", "notes", "location"]],
        "shots": shots(),
    }
    r = client.post("/pdf", headers=H, json=body)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    # 7 shots at 6 per storyboard page → 2 pages.
    pages = r.content.count(b"/Type /Page\n") + r.content.count(b"/Type /Page ") + r.content.count(b"/Type /Page>>")
    assert pages >= 1


def test_pdf_rejects_empty(client):
    assert client.post("/pdf", headers=H, json={"title": "x", "shots": []}).status_code == 400


def test_timecode():
    assert timecode(0, 24) == "00:00:00:00"
    assert timecode(24 * 61 + 5, 24) == "00:01:01:05"


@pytest.mark.skipif(find_ffmpeg() is None, reason="ffmpeg not available")
def test_animatic_roundtrip(client, tmp_path):
    req = {
        "title": "Test",
        "fps": 24,
        "width": 64,
        "height": 28,
        "burnIn": True,
        "shots": [{"number": "1", "type": "WS", "lens": "24mm", "frames": 6}, {"number": "2", "type": "CU", "lens": "85mm", "frames": 4}],
    }
    job = client.post("/animatic", headers=H, json=req).json()
    jid = job["id"]
    assert job["total"] == 10

    # Finishing early is refused.
    assert client.post(f"/animatic/{jid}/finish", headers=H).status_code == 400
    for i in range(10):
        r = client.put(f"/animatic/{jid}/frames/{i}", headers=H, content=jpeg(64, 28, (i * 20, 80, 160)))
        assert r.status_code == 204
    assert client.put(f"/animatic/{jid}/frames/10", headers=H, content=jpeg()).status_code == 400

    assert client.post(f"/animatic/{jid}/finish", headers=H).status_code == 200
    for _ in range(200):
        status = client.get(f"/jobs/{jid}", headers=H).json()
        if status["state"] in ("done", "error"):
            break
        time.sleep(0.05)
    assert status["state"] == "done", status
    assert status["progress"] == 1

    r = client.get(f"/jobs/{jid}/file", headers=H)
    assert r.status_code == 200
    out = tmp_path / "a.mp4"
    out.write_bytes(r.content)
    ffprobe = find_ffmpeg().replace("ffmpeg", "ffprobe")
    info = json.loads(
        subprocess.run(
            [ffprobe, "-v", "error", "-count_frames", "-show_entries", "stream=nb_read_frames,width,height", "-of", "json", str(out)],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    )["streams"][0]
    assert int(info["nb_read_frames"]) == 10
    assert (info["width"], info["height"]) == (64, 28)

    assert client.delete(f"/jobs/{jid}", headers=H).status_code == 204
    assert client.get(f"/jobs/{jid}", headers=H).status_code == 404
