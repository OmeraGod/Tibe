"""tibe local server: media, MP4 conversion and optional REA inspection."""
import json
import hashlib
import math
import os
from pathlib import Path
import shutil
import subprocess
import uuid
from urllib.parse import quote

from flask import Flask, jsonify, render_template, request, send_file, send_from_directory
from werkzeug.exceptions import HTTPException
from rea_adapter import ReaAgentsOrchestrator, export_capcut_draft
from render_engine import RenderStore
from project_store import ProjectStore
from concat_audio import ConcatAudio
from voice_studio import VoiceStudio
from local_voice import LocalVoice
from capcut_resources import CapCutResources

BASE_DIR = Path(__file__).parent.resolve()
APP_INSTANCE = hashlib.sha256(str(BASE_DIR).encode("utf-8")).hexdigest()[:20]
WORKSPACE_DIR = BASE_DIR / "workspace"
UPLOADS_DIR = WORKSPACE_DIR / "uploads"
EXPORTS_DIR = WORKSPACE_DIR / "exports"
for directory in (UPLOADS_DIR, EXPORTS_DIR):
    directory.mkdir(parents=True, exist_ok=True)
app = Flask(__name__, template_folder="templates")
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024 * 1024
app.config["TEMPLATES_AUTO_RELOAD"] = True
rea_engine = ReaAgentsOrchestrator(WORKSPACE_DIR)
render_store = RenderStore(EXPORTS_DIR)
project_store = ProjectStore(WORKSPACE_DIR/'projects')
concat_audio = ConcatAudio(BASE_DIR)
local_voice = LocalVoice(BASE_DIR)
voice_studio = VoiceStudio(WORKSPACE_DIR, rea_engine, local_voice)
capcut_resources = CapCutResources(rea_engine)

from batch_engine import register_batch
batch_manager = register_batch(app, BASE_DIR, local_voice)

from omera_hub import register_omera
omera_hub = register_omera(app, BASE_DIR, project_store)


IDE_ORIGINS={f'http://{host}:{port}' for host in ('localhost','127.0.0.1') for port in (63342,63343)}

@app.before_request
def local_origin_only():
    if request.host.split(':')[0] not in {'localhost','127.0.0.1'}:
        return jsonify(ok=False,error='Chỉ cho phép truy cập máy cục bộ.'),403
    origin=request.headers.get('Origin')
    bridge=origin in IDE_ORIGINS and request.headers.get('X-Tibe-Client')=='studio'
    if request.method=='OPTIONS' and origin:
        if origin not in IDE_ORIGINS and origin!=request.host_url.rstrip('/'):
            return jsonify(ok=False,error='Nguồn yêu cầu không hợp lệ.'),403
    if request.method in {'POST','PUT','PATCH','DELETE'}:
        if origin and origin!=request.host_url.rstrip('/') and not bridge:
            return jsonify(ok=False,error='Nguồn yêu cầu không hợp lệ.'),403
        if request.headers.get('Sec-Fetch-Site')=='cross-site' and not bridge:
            return jsonify(ok=False,error='Nguồn yêu cầu không hợp lệ.'),403

@app.after_request
def local_preview_headers(response):
    origin=request.headers.get('Origin')
    if origin in IDE_ORIGINS:
        response.headers['Access-Control-Allow-Origin']=origin
        response.headers.add('Vary','Origin')
        response.headers['Access-Control-Allow-Methods']='GET, POST, PUT, PATCH, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers']='Content-Type, X-Tibe-Client'
        response.headers['Access-Control-Expose-Headers']='Content-Disposition, X-ClipCut-Report'
    return response


@app.errorhandler(Exception)
def api_error(exc):
    code = exc.code if isinstance(exc, HTTPException) else 500
    if isinstance(exc, ValueError):
        code = 400
    return jsonify(ok=False, error=str(exc)), code


@app.get("/")
def index():
    return render_template("index.html")


@app.get('/batch')
def batch_studio():
    return render_template('batch.html')


@app.get("/assets/<path:subpath>")
def assets(subpath):
    return send_from_directory(BASE_DIR / "assets", subpath)


@app.get("/workspace/<path:subpath>")
def workspace(subpath):
    return send_from_directory(WORKSPACE_DIR, subpath)


@app.get("/api/status")
def status():
    return jsonify(ok=True, version='3.6.0',instance=APP_INSTANCE,ffmpeg=bool(shutil.which("ffmpeg")), frameRenderer=bool(shutil.which("ffmpeg") and shutil.which("ffprobe")), rea=rea_engine.status(), voice=local_voice.status())


@app.post('/api/render/start')
def render_start():
    job = render_store.create(request.get_json())
    return jsonify(ok=True, jobId=job.id, frames=job.expected, fps=job.fps, fpsRatio=job.fps_ratio)


@app.get('/api/projects')
def list_projects():
    return jsonify(ok=True, projects=project_store.list(), location='workspace/projects')


@app.get('/api/concat/audio')
def concat_audio_catalogue():
    return jsonify(ok=True, effects=concat_audio.catalogue(), available=bool(shutil.which('ffmpeg') and shutil.which('ffprobe')))


@app.get('/api/resources/capcut')
def capcut_compatible_resources():
    return jsonify(capcut_resources.scan())


@app.post('/api/concat/audio')
def concat_audio_process():
    return jsonify(ok=True, media=concat_audio.process(request.get_json()))


@app.post('/api/projects')
def save_local_project():
    return jsonify(ok=True, project=project_store.save(request.get_json()))


@app.put('/api/projects/<project_id>')
def update_local_project(project_id):
    project_store.load(project_id)
    return jsonify(ok=True, project=project_store.save(request.get_json(), project_id))


@app.get('/api/projects/<project_id>')
def open_local_project(project_id):
    return jsonify(ok=True, project=project_store.load(project_id))


@app.post('/api/render/<job_id>/frames')
def render_frames(job_id):
    job = render_store.get(job_id)
    job.write(int(request.form.get('start', -1)), request.files.getlist('frames'))
    return jsonify(ok=True, received=job.received, total=job.expected)


@app.post('/api/render/<job_id>/finish')
def render_finish(job_id):
    job = render_store.get(job_id)
    try:
        output = job.finish()
    except Exception:
        job.cancel()
        raise
    finally:
        render_store.remove(job_id)
    return send_file(output, as_attachment=True, download_name='tibe.mp4')


@app.post('/api/render/<job_id>/cancel')
def render_cancel(job_id):
    job = render_store.remove(job_id)
    if job:
        job.cancel()
    return jsonify(ok=True)


@app.post("/api/rea/inspect")
def inspect():
    return jsonify(rea_engine.inspect_capcut())


@app.get('/api/rea/luts')
def local_luts():
    return jsonify(rea_engine.local_luts())


@app.post('/api/rea/materials')
def inspect_materials():
    return jsonify(rea_engine.inspect_materials())


@app.post('/api/export/capcut_draft')
def capcut_draft():
    payload = request.get_json()
    if not isinstance(payload, dict):
        raise ValueError('Thiếu dữ liệu dự án.')
    archive, report = export_capcut_draft(payload.get('project', payload), WORKSPACE_DIR)
    response = send_file(archive, as_attachment=True, download_name='tibe_CapCut_Draft.zip')
    response.headers['X-ClipCut-Report'] = quote(json.dumps({'warnings': len(report['warnings']), 'nativeOpenVerified': False}))
    return response


@app.post("/api/tts/synthesize")
def voice():
    data = request.get_json()
    return jsonify(rea_engine.synthesize_voice(data.get("text", ""), data.get("voice", "vi-VN-HoaiMyNeural")))


@app.get('/api/tts/providers')
def voice_providers():
    return jsonify(ok=True, providers=voice_studio.providers(request.args.get('port',8001),include_cit=request.args.get('legacy')=='1'))


@app.post('/api/tts/jobs')
def voice_create_job():
    return jsonify(ok=True, job=voice_studio.create(request.get_json()))


@app.get('/api/tts/jobs/<job_id>')
def voice_get_job(job_id):
    return jsonify(ok=True, job=voice_studio.get(job_id))


@app.get('/api/tts/history')
def voice_history():
    return jsonify(ok=True, history=voice_studio.history())


@app.post("/api/upload")
def upload():
    file = request.files.get("file")
    if not file or not file.filename:
        raise ValueError("Chưa chọn tệp.")
    ext = Path(file.filename).suffix.lower()
    types = {"video": {".mp4", ".mov", ".webm", ".mkv", ".m4v"},
             "audio": {".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac"},
             "image": {".png", ".jpg", ".jpeg", ".webp", ".gif"}}
    media_type = next((kind for kind, extensions in types.items() if ext in extensions), None)
    if not media_type:
        raise ValueError("Định dạng tệp không hỗ trợ.")
    path = UPLOADS_DIR / f"media_{uuid.uuid4().hex}{ext}"
    file.save(path)
    metadata = {}
    if shutil.which("ffprobe"):
        result = subprocess.run([shutil.which("ffprobe"), "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
                                capture_output=True, timeout=30, encoding="utf-8", errors="replace")
        if result.returncode:
            path.unlink(missing_ok=True)
            raise ValueError("Tệp không phải video, ảnh hoặc âm thanh hợp lệ.")
        metadata = json.loads(result.stdout)
    return jsonify(ok=True, filename=file.filename, url=f"/workspace/uploads/{path.name}", mediaType=media_type, metadata=metadata)


@app.post("/api/export/convert_mp4")
def convert_mp4():
    binary = shutil.which("ffmpeg")
    if not binary:
        return jsonify(ok=False, error="Chưa có FFmpeg. Bạn vẫn có thể xuất WebM."), 503
    video = request.files.get("video")
    if not video:
        raise ValueError("Thiếu video cần chuyển đổi.")
    job = uuid.uuid4().hex
    source = EXPORTS_DIR / f"source_{job}.webm"
    output = EXPORTS_DIR / f"tibe_{job}.mp4"
    fps = int(request.form.get("fps", 30))
    if fps not in {24, 30, 60}:
        raise ValueError("FPS không hợp lệ.")
    duration = float(request.form.get("duration", 0))
    if not math.isfinite(duration) or duration < 0 or duration > 21600:
        raise ValueError("Thời lượng không hợp lệ.")
    timing = ["-vf", "tpad=stop_mode=clone:stop_duration=0.25", "-af", "aresample=async=1:first_pts=0,apad", "-t", str(duration)] if duration else []
    video.save(source)
    try:
        result = subprocess.run([binary, "-nostdin", "-y", "-v", "error", "-i", str(source),
                                 "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "fast",
                                 "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(fps), "-c:a", "aac",
                                 "-b:a", "192k", "-movflags", "+faststart"] + timing + [str(output)],
                                capture_output=True, timeout=900, encoding="utf-8", errors="replace")
        if result.returncode:
            raise ValueError("FFmpeg không thể đọc video: " + result.stderr[-800:])
    finally:
        source.unlink(missing_ok=True)
    return send_file(output, as_attachment=True, download_name="tibe.mp4")


if __name__ == "__main__":
    print("tibe: http://127.0.0.1:5050")
    app.run(host="127.0.0.1", port=5050, debug=False, threaded=True)
