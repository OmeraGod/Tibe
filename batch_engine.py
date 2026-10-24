"""Persistent, sequential Omera video rendering with bounded local media access."""
from __future__ import annotations

import atexit
import base64
import hashlib
import json
import math
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import threading
import time
import uuid

from flask import Blueprint, jsonify, request, send_file
from PIL import Image
from omera_audio import prepare_voice
from render_engine import RenderJob

FLAGS = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
IDENTIFIER = re.compile(r'[a-f0-9]{32}')
LOCAL_MEDIA = re.compile(r'(assets/(?:demo|sfx)/[\w.-]+|/workspace/(?:uploads|tts)/[\w.-]+)')


def parse_fps(value):
    parts = value.split('/')
    return float(parts[0]) / float(parts[1]) if len(parts) == 2 else float(value)


class BatchManager:
    def __init__(self, base, local_voice=None, node=None):
        self.base = Path(base).resolve()
        self.root = self.base / 'workspace/batch'
        self.root.mkdir(parents=True, exist_ok=True)
        self.local_voice = local_voice
        bundled = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
        self.node = node or os.environ.get('CLIPCUT_NODE') or (str(bundled) if bundled.is_file() else shutil.which('node'))
        self.worker = self.base / 'scripts/omera_render_worker.cjs'
        self.lock = threading.RLock()
        self.create_lock = threading.Lock()
        self.jobs = {}
        self.events = {}
        self.wake = threading.Event()
        self.stopping = threading.Event()
        self.allowed = set()
        self.active = False
        self.thread = None
        self.process = None
        self.mixer = None
        self.running_key = None
        for path in self.root.glob('*/job.json'):
            try:
                job = json.loads(path.read_text(encoding='utf-8'))
                if not IDENTIFIER.fullmatch(job.get('id', '')) or path.parent.name != job['id']:
                    continue
                if job.get('state') in {'preparing', 'rendering', 'mixing', 'cancelling'}:
                    job.update(state='interrupted', message='Máy chủ đã dừng. Bấm Thử lại để dựng lại tác vụ này.')
                self.jobs[job['id']] = job
                self.events[job['id']] = threading.Event()
            except (OSError, ValueError, TypeError):
                continue
        atexit.register(self.close)

    def _write(self, job):
        path = self.root / job['id'] / 'job.json'
        temporary = path.with_suffix('.tmp')
        temporary.write_text(json.dumps(job, ensure_ascii=False, indent=2), encoding='utf-8')
        temporary.replace(path)

    def update(self, key, **values):
        with self.lock:
            job = self.jobs[key]
            job.update(values, updatedAt=time.time())
            self._write(job)
            return dict(job)

    def get(self, key):
        with self.lock:
            if not IDENTIFIER.fullmatch(str(key)) or key not in self.jobs:
                raise ValueError('Không tìm thấy tác vụ.')
            return dict(self.jobs[key])

    def list(self):
        with self.lock:
            return sorted((dict(job) for job in self.jobs.values()), key=lambda j: j['createdAt'], reverse=True)

    def _run_node(self, payload):
        if not self.node:
            raise ValueError('Chưa có Node.js để chạy bộ dựng. Mở MỞ TIBE.bat để chuẩn bị.')
        process = subprocess.run([self.node, str(self.worker), '--compile'], input=json.dumps(payload, ensure_ascii=False),
            cwd=self.base, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=60, creationflags=FLAGS)
        try:
            data = json.loads(process.stdout.strip().splitlines()[-1])
        except (ValueError, IndexError):
            raise ValueError('Không nạp được bộ vẽ Omera. Kiểm tra thư viện Canvas đã cài bằng trình khởi động.')
        if process.returncode or data.get('error'):
            raise ValueError(data.get('error', process.stderr[-400:]))
        return data

    def _media(self, item):
        if not isinstance(item, dict) or item.get('type') not in {'image', 'video', 'audio'}:
            raise ValueError('Loại tư liệu không hợp lệ.')
        url = item.get('url', '')
        if not isinstance(url, str):
            raise ValueError('Đường dẫn tư liệu không hợp lệ.')
        match = re.fullmatch(r'data:(image|video|audio)/(png|jpeg|webp|mp4|webm|wav|mpeg|x-wav);base64,([A-Za-z0-9+/=\r\n]+)', url)
        if match:
            if len(match[3]) > 60 * 1024 * 1024:
                raise ValueError('Tệp nhúng quá lớn; nhập qua Media trước khi xếp lô.')
            raw = base64.b64decode(match[3], validate=True)
            extension = {'jpeg': 'jpg', 'x-wav': 'wav', 'mpeg': 'mp3'}.get(match[2], match[2])
            name = 'omera_' + hashlib.sha256(raw).hexdigest()[:32] + '.' + extension
            path = self.base / 'workspace/uploads' / name
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.is_file():
                path.write_bytes(raw)
            url = '/workspace/uploads/' + name
        elif LOCAL_MEDIA.fullmatch(url):
            path = (self.base / url.lstrip('/')).resolve()
            allowed = [self.base / folder for folder in ('assets/demo', 'assets/sfx', 'workspace/uploads', 'workspace/tts')]
            if path.parent not in allowed or not path.is_file():
                raise ValueError('Không tìm thấy tư liệu trong thư viện tibe.')
        else:
            raise ValueError('Chỉ dùng tư liệu đã nhập vào tibe; không đọc URL hoặc đường dẫn tùy ý.')
        value = {'type': item['type'], 'name': str(item.get('name', path.name))[:160], 'url': url}
        if item['type'] == 'image':
            with Image.open(path) as image:
                if image.width * image.height > 42000000:
                    raise ValueError('Ảnh vượt giới hạn 42 megapixel.')
                value.update(width=image.width, height=image.height)
                image.verify()
            value['duration'] = 4
        else:
            result = subprocess.run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)], capture_output=True, text=True, check=True, timeout=30, creationflags=FLAGS)
            metadata = json.loads(result.stdout)
            if not any(stream['codec_type'] == item['type'] for stream in metadata.get('streams', [])):
                raise ValueError('Tệp không có track ' + item['type'])
            value['duration'] = float(metadata['format']['duration'])
            if not math.isfinite(value['duration']) or value['duration'] <= 0:
                raise ValueError('Tư liệu không có thời lượng hợp lệ.')
            if item['type'] == 'video':
                video = next(stream for stream in metadata['streams'] if stream['codec_type'] == 'video')
                value.update(width=video['width'], height=video['height'])
        return value

    def create(self, payload):
        # Serialize admission so simultaneous imports cannot overfill the queue.
        with self.create_lock:
            return self._create(payload)

    def _create(self, payload):
        if not isinstance(payload, dict):
            raise ValueError('Thiếu dữ liệu batch.')
        projects = payload.get('projects')
        variants = payload.get('variants', ['A', 'B', 'C'])
        if not isinstance(projects, list) or not 1 <= len(projects) <= 20:
            raise ValueError('Một lô cần từ 1 đến 20 kịch bản.')
        if not isinstance(variants, list) or not variants or any(not isinstance(v, str) for v in variants) or len(set(variants)) != len(variants) or any(v not in {'A', 'B', 'C'} for v in variants):
            raise ValueError('Chọn các biến thể A, B, C.')
        with self.lock:
            pending = sum(job['state'] in {'queued', 'preparing', 'rendering', 'mixing', 'cancelling'} for job in self.jobs.values())
        if pending + len(projects) * len(variants) > 60:
            raise ValueError('Hàng đợi tối đa 60 bản xuất chưa hoàn tất.')
        profile = payload.get('profile', 'production')
        if not isinstance(profile, str) or profile not in {'production', 'draft'}:
            raise ValueError('Chọn bản 1080p hoặc bản nháp 540p.')
        preview = payload.get('preview') is True
        try:
            preview_seconds = float(payload.get('previewSeconds', 3))
        except (ValueError, TypeError):
            raise ValueError('Thời lượng xem thử phải là một số.')
        if not math.isfinite(preview_seconds) or not .5 <= preview_seconds <= 8:
            raise ValueError('Xem thử từ 0,5 đến 8 giây.')
        specs = []
        for source in projects:
            if not isinstance(source, dict) or not isinstance(source.get('scenes'), list):
                raise ValueError('Mỗi mục cần có scenes.')
            project = json.loads(json.dumps(source))
            if not isinstance(payload.get('media', {}), dict) or not isinstance(project.get('media', {}), dict):
                raise ValueError('media cần là danh sách tư liệu theo ID.')
            if not isinstance(project.get('narration', {}), dict):
                raise ValueError('narration cần là một đối tượng.')
            library = {**payload.get('media', {}), **project.get('media', {})}
            needed = set()
            def require_media(identifier):
                if not isinstance(identifier, str) or not 1 <= len(identifier) <= 100:
                    raise ValueError('ID tư liệu phải là chuỗi từ 1 đến 100 ký tự.')
                needed.add(identifier)
            for scene in project['scenes']:
                if not isinstance(scene, dict):
                    raise ValueError('Cảnh không hợp lệ.')
                for role in ('mediaId', 'beforeId', 'diagramId', 'gearId'):
                    if scene.get(role):
                        require_media(scene[role])
                if not isinstance(scene.get('widgets', []), list):
                    raise ValueError('widgets cần là một mảng.')
                for widget in scene.get('widgets', []):
                    if isinstance(widget, dict) and widget.get('mediaId'):
                        require_media(widget['mediaId'])
            for key in [project.get('musicId'), project.get('narration', {}).get('mediaId')]:
                if key:
                    require_media(key)
            if len(needed) > 120 or any(not isinstance(k, str) or not 1 <= len(k) <= 100 for k in needed):
                raise ValueError('Danh sách tư liệu quá lớn hoặc ID không hợp lệ.')
            project['media'] = {key: self._media(library.get(key)) for key in needed}
            compiled = self._run_node({'plan': project, 'variants': variants, 'seed': secrets.randbits(32)})['specs']
            for spec in compiled:
                for scene in spec['scenes']:
                    for identifier in [scene['mediaId'], scene.get('beforeId')]:
                        item = project['media'].get(identifier)
                        if not item or item['type'] != 'video':
                            continue
                        if scene['sourceIn'] >= item['duration']:
                            raise ValueError('Điểm vào vượt thời lượng video nguồn.')
                        if scene['sourceIn'] + scene['duration'] * scene['speed'] > item['duration']:
                            spec['warnings'].append('Video ' + item['name'] + ' ngắn hơn cảnh và được lặp để đủ thời lượng. Nên thay tư liệu dài hơn trước khi đăng.')
            specs.extend(compiled)
        created = []
        for spec in specs:
            key = uuid.uuid4().hex
            folder = self.root / key
            folder.mkdir()
            (folder / 'spec.json').write_text(json.dumps(spec, ensure_ascii=False), encoding='utf-8')
            job = {'id': key, 'title': spec['title'], 'variant': spec['variant'], 'state': 'queued', 'progress': 0,
                'profile': profile, 'width': 1080 if profile == 'production' else 540,
                'height': 1920 if profile == 'production' else 960, 'fps': 60 if profile == 'production' else 30,
                'duration': min(preview_seconds, spec['duration']) if preview else spec['duration'],
                'preview': preview, 'createdAt': time.time(), 'updatedAt': time.time(),
                'message': 'Chờ xuất bản xem thử.' if preview else 'Đang chờ Render All Batch.', 'warnings': spec['warnings']}
            with self.lock:
                self.jobs[key] = job
                self.events[key] = threading.Event()
                self._write(job)
            created.append(dict(job))
        return created

    def start(self, keys=None):
        if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
            raise ValueError('Cần FFmpeg và FFprobe để xuất batch.')
        with self.lock:
            if self.stopping.is_set():
                raise ValueError('Máy chủ đang dừng.')
            if keys is not None and (not isinstance(keys, list) or any(not isinstance(key, str) or key not in self.jobs for key in keys)):
                raise ValueError('Danh sách tác vụ không hợp lệ.')
            self.allowed.update(keys if keys is not None else [key for key, job in self.jobs.items() if job['state'] == 'queued'])
            self.active = True
            if not self.thread or not self.thread.is_alive():
                self.thread = threading.Thread(target=self._loop, daemon=True, name='omera-batch')
                self.thread.start()
            self.wake.set()

    def cancel(self, key):
        job = self.get(key)
        if job['state'] in {'done', 'cancelled', 'failed'}:
            return job
        self.events[key].set()
        (self.root / key / 'cancel.flag').touch()
        if self.mixer and job['state'] == 'mixing':
            self.mixer.cancel()
        return self.update(key, state='cancelling' if self.running_key == key else 'cancelled', message='Đang hủy…' if self.running_key == key else 'Đã hủy.', progress=job['progress'])

    def retry(self, key):
        job = self.get(key)
        if self.running_key == key:
            raise ValueError('Đang dừng tác vụ cũ; đợi vài giây trước khi thử lại.')
        if job['state'] not in {'failed', 'cancelled', 'interrupted'}:
            raise ValueError('Chỉ thử lại tác vụ lỗi, bị hủy hoặc gián đoạn.')
        self.events[key].clear()
        (self.root / key / 'cancel.flag').unlink(missing_ok=True)
        self.update(key, state='queued', progress=0, message='Đã đưa lại vào hàng đợi.')
        self.start([key])

    def project(self, key):
        self.get(key)
        return json.loads((self.root / key / 'spec.json').read_text(encoding='utf-8'))

    def _loop(self):
        while not self.stopping.is_set():
            self.wake.wait(.5)
            if not self.active:
                continue
            with self.lock:
                waiting = sorted((job for job in self.jobs.values() if job['state'] == 'queued' and job['id'] in self.allowed), key=lambda j: j['createdAt'])
                if not waiting:
                    self.active = False
                    self.wake.clear()
                    continue
                key = waiting[0]['id']
                self.running_key = key
            try:
                self._render(key)
            finally:
                self.running_key = None

    def _render(self, key):
        folder = self.root / key
        event = self.events[key]
        try:
            if event.is_set():
                raise ValueError('Đã hủy tác vụ.')
            self.update(key, state='preparing', message='Chuẩn bị giọng, tư liệu và âm thanh…')
            job = self.get(key)
            spec = self.project(key)
            media = spec['media']
            narration = spec['narration']
            tracks = spec.get('voiceTracks')
            if tracks is None:
                tracks = []
                meter = [0.0] * 1024
                def add_voice(source, text, start, available, name, scene=None):
                    path, length, envelope = prepare_voice(self.base, source, text, narration['voice'], self.local_voice, event, hook=start == 0)
                    if not path:
                        return
                    if length > available - .02:
                        raise ValueError('Lời đọc của ' + name + ' dài hơn cảnh. Rút gọn nội dung hoặc tăng trọng số duration cho cảnh.')
                    tracks.append({'url': '/workspace/tts/' + path.name, 'start': start, 'duration': length})
                    for index, value in enumerate(envelope):
                        slot = min(1023, int((start + index / max(1, len(envelope)) * length) / spec['duration'] * 1024))
                        meter[slot] = max(meter[slot], value)
                    if scene is not None and not scene.get('wordTimingProvided'):
                        words = scene['caption'].split()
                        weights = [max(1, len(word)) for word in words]
                        total = max(1, sum(weights))
                        position = .02
                        timed = []
                        for word, weight in zip(words, weights):
                            end = position + max(.01, length - .04) * weight / total
                            timed.append({'text': word, 'start': position, 'end': end})
                            position = end
                        scene['words'] = timed
                if narration.get('mediaId') or narration.get('text'):
                    source = (self.base / media[narration['mediaId']]['url'].lstrip('/')) if narration.get('mediaId') else None
                    if source or narration.get('generate'):
                        add_voice(source, narration.get('text', ''), 0, spec['duration'], spec['title'])
                elif narration.get('generate'):
                    for index, scene in enumerate(spec['scenes']):
                        if event.is_set():
                            raise ValueError('Đã hủy tác vụ.')
                        self.update(key, message=f"Tạo giọng cảnh {index + 1} / {len(spec['scenes'])}…")
                        add_voice(None, scene['caption'], scene['start'], scene['duration'], 'cảnh ' + str(index + 1), scene)
                spec['voiceTracks'] = tracks
                spec['meter'] = meter
                (folder / 'spec.json').write_text(json.dumps(spec, ensure_ascii=False), encoding='utf-8')
            if event.is_set():
                raise ValueError('Đã hủy tác vụ.')
            audio_project = {'media': {}, 'clips': [], 'renderIdentity': key}
            def audio(identifier, url, start, length, volume, role='sfx', fade=0):
                audio_project['media'][identifier] = {'type': 'audio', 'url': url}
                audio_project['clips'].append({'id': identifier, 'track': 'audio', 'mediaId': identifier, 'start': start,
                    'duration': min(length, max(.05, job['duration'] - start)), 'volume': volume, 'audioRole': role, 'fadeOut': fade})
            for index, track in enumerate(tracks):
                if track['start'] < job['duration']:
                    audio('narration_' + str(index), track['url'], track['start'], track['duration'], 1, 'voice', .05)
            if spec.get('musicId'):
                item = media[spec['musicId']]
                remaining, start, index = job['duration'], 0, 0
                while remaining > .01:
                    length = min(remaining, item['duration'])
                    audio('music_' + str(index), item['url'], start, length, .12, 'music', min(.4, length / 3))
                    start += length; remaining -= length; index += 1
                    if index > 120:
                        raise ValueError('Bài nhạc quá ngắn; chọn đoạn nhạc dài hơn.')
            for index, cue in enumerate(spec['cues']):
                if cue['time'] >= job['duration']:
                    continue
                audio('cue_' + str(index), 'assets/sfx/' + cue['source'] + '.wav', cue['time'], .65, 10 ** (cue['db'] / 20))
            for clip in audio_project['clips']:
                if clip['audioRole'] == 'music':
                    clip['ducking'] = True
            assets = {identifier: {'path': str((self.base / item['url'].lstrip('/')).resolve()), 'type': item['type'], 'width': item.get('width'), 'height': item.get('height')} for identifier, item in media.items() if item['type'] in {'image', 'video'}}
            render_file = folder / 'worker.json'
            render_file.write_text(json.dumps({'spec': spec, 'assets': assets, 'width': job['width'], 'height': job['height'],
                'fps': job['fps'], 'duration': job['duration'], 'output': str(folder / 'video-only.mp4'), 'cancelFile': str(folder / 'cancel.flag')}, ensure_ascii=False), encoding='utf-8')
            self.update(key, state='rendering', message='Đang dựng khung hình…')
            with (folder / 'worker.log').open('w', encoding='utf-8') as log:
                self.process = subprocess.Popen([self.node, str(self.worker), '--render', str(render_file)], cwd=self.base,
                    stdout=subprocess.PIPE, stderr=log, text=True, encoding='utf-8', errors='replace', creationflags=FLAGS)
                for line in self.process.stdout:
                    try:
                        progress = json.loads(line)
                    except ValueError:
                        continue
                    if progress.get('state') == 'error':
                        raise ValueError(progress.get('error', 'Bộ vẽ bị lỗi.'))
                    if not event.is_set() and 'progress' in progress:
                        self.update(key, progress=progress['progress'] * .94,
                            message=f"Khung {progress['frame']} / {progress['frames']}")
                if self.process.wait(timeout=60) != 0:
                    raise ValueError('Bộ dựng dừng: ' + (folder / 'worker.log').read_text(encoding='utf-8')[-400:])
            self.process = None
            if event.is_set():
                raise ValueError('Đã hủy tác vụ.')
            self.update(key, state='mixing', progress=.95, message='Trộn giọng, nhạc, SFX và kiểm tra tệp…')
            self.mixer = RenderJob.from_video(folder, self.base, audio_project, folder / 'video-only.mp4', job['duration'])
            output = self.mixer.finish()
            self.mixer = None
            if event.is_set():
                output.unlink(missing_ok=True)
                raise ValueError('Đã hủy tác vụ.')
            filename = ('Preview_' if job['preview'] else '') + spec['filename'] + '.mp4'
            destination = folder / filename
            output.replace(destination)
            probe = subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(destination)], capture_output=True, text=True, check=True, timeout=30, creationflags=FLAGS)
            metadata = json.loads(probe.stdout)
            video = next(stream for stream in metadata['streams'] if stream['codec_type'] == 'video')
            if video['width'] != job['width'] or video['height'] != job['height'] or abs(parse_fps(video['avg_frame_rate']) - job['fps']) > .001 or abs(float(metadata['format']['duration']) - job['duration']) > .2:
                raise ValueError('Tệp xuất không khớp kích thước hoặc thời lượng yêu cầu.')
            digest = hashlib.md5()
            with destination.open('rb') as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                    digest.update(chunk)
            manifest = {'id': key, 'variant': spec['variant'], 'seed': spec['seed'], 'md5': digest.hexdigest(),
                'width': job['width'], 'height': job['height'], 'fps': job['fps'], 'preview': job['preview'],
                'duration': job['duration'], 'createdAt': time.time(), 'filename': filename,
                'contentNote': 'Mã phiên bản và metadata không bảo đảm tránh nhận diện nội dung trùng hoặc tăng lượt xem.'}
            (folder / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
            (folder / 'video-only.mp4').unlink(missing_ok=True)
            if event.is_set():
                destination.unlink(missing_ok=True)
                raise ValueError('Đã hủy tác vụ.')
            self.update(key, state='done', progress=1, message='Đã xuất và kiểm tra thành công.',
                outputUrl=f'/workspace/batch/{key}/{filename}', manifestUrl=f'/workspace/batch/{key}/manifest.json', md5=digest.hexdigest())
        except Exception as error:
            state = 'cancelled' if event.is_set() else 'failed'
            self.update(key, state=state, message=str(error)[:500])
        finally:
            if self.process and self.process.poll() is None:
                self.process.terminate()
                try:
                    self.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.process.kill()
            self.process = None
            if self.mixer:
                self.mixer.cancel()
                self.mixer = None

    def close(self):
        self.stopping.set()
        self.wake.set()
        with self.lock:
            for key, job in self.jobs.items():
                if job['state'] in {'preparing', 'rendering', 'mixing', 'cancelling'}:
                    self.events[key].set()
                    (self.root / key / 'cancel.flag').touch()
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
        if self.process and self.process.poll() is None:
            self.process.terminate()


def register_batch(app, base, local_voice):
    manager = BatchManager(base, local_voice)
    bp = Blueprint('batch', __name__)

    @bp.get('/api/batch/jobs')
    def jobs():
        return jsonify(ok=True, jobs=manager.list())

    @bp.post('/api/batch/jobs')
    def create():
        return jsonify(ok=True, jobs=manager.create(request.get_json()))

    @bp.post('/api/batch/start')
    def start():
        manager.start((request.get_json(silent=True) or {}).get('ids'))
        return jsonify(ok=True)

    @bp.post('/api/batch/jobs/<key>/cancel')
    def cancel(key):
        return jsonify(ok=True, job=manager.cancel(key))

    @bp.post('/api/batch/jobs/<key>/retry')
    def retry(key):
        manager.retry(key)
        return jsonify(ok=True)

    @bp.get('/api/batch/jobs/<key>/download')
    def download(key):
        job = manager.get(key)
        if job['state'] != 'done':
            raise ValueError('Tác vụ chưa có video hoàn tất.')
        filename = Path(job['outputUrl']).name
        return send_file(manager.root / key / filename, as_attachment=True, download_name=filename, conditional=True)

    @bp.get('/api/batch/jobs/<key>/spec')
    def project(key):
        return jsonify(ok=True, spec=manager.project(key))

    app.register_blueprint(bp)
    return manager