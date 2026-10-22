"""Deterministic canvas-frame encoding with a separate FFmpeg timeline audio mix."""
import atexit
import base64
import io
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import threading
import time
import uuid

from PIL import Image

FLAGS = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
CURVES = {
    'montage': [(0,1),(.22,2.5),(.48,.5),(.72,2.5),(1,1)],
    'hero': [(0,1),(.3,1.6),(.48,.3),(.75,.3),(1,1.7)],
    'bullet': [(0,2),(.3,2),(.42,.25),(.67,.25),(1,2)],
    'jump_cut': [(0,.5),(.2,.5),(.38,3),(.6,3),(.78,.5),(1,.5)]}


def source_offset(clip, seconds):
    """Same analytic Bezier integral as ClipCore.sourceOffset, including splits."""
    rate = float(clip.get('speed', 1))
    points = CURVES.get(clip.get('speedCurve'))
    if points is None:
        return seconds * rate
    span, offset = max(.05,float(clip.get('curveSpan',clip['duration']))), float(clip.get('curveOffset',0))
    def integral(x):
        area = min(0,x)*points[0][1]+max(0,x-1)*points[-1][1]
        for (a,va),(b,vb) in zip(points,points[1:]):
            u = min(1,max(0,(x-a)/(b-a)))
            area += (b-a)*(va*u+(vb-va)*(u**3-.5*u**4))
        return area
    return span*rate*(integral((offset+seconds)/span)-integral(offset/span))


def tempo_filters(rate):
    result = []
    while rate < .5:
        result.append('atempo=0.5');rate /= .5
    while rate > 2:
        result.append('atempo=2');rate /= 2
    return result+['atempo='+str(rate)]


def bounded(value, low, high, label):
    number = float(value)
    if not math.isfinite(number) or number < low or number > high:
        raise ValueError(f'{label} không hợp lệ.')
    return number


class RenderJob:
    def __init__(self, root, project, width, height, fps, duration):
        self.id = uuid.uuid4().hex
        self.root, self.base = root, root.parent.parent
        self.folder = root / ('render_' + self.id)
        self.folder.mkdir()
        self.width, self.height, self.fps, self.duration = width, height, fps, duration
        self.expected = math.ceil(duration * fps)
        self.received = 0
        self.created = time.monotonic()
        self.lock = threading.RLock()
        self.cancelled = False
        self.proc = None
        self.log = None
        self.project = project
        self.audio = []
        try:
            self._collect_audio()
            self.log = (self.folder / 'encode.log').open('wb')
            self.proc = subprocess.Popen([
                shutil.which('ffmpeg'), '-nostdin', '-v', 'error', '-y',
                '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', str(fps), '-i', 'pipe:0',
                '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
                '-frames:v', str(self.expected), '-movflags', '+faststart', str(self.folder / 'video.mp4')
            ], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=self.log, creationflags=FLAGS)
        except Exception:
            self.cancel()
            raise

    def _source(self, item):
        url = item.get('url', '')
        if re.fullmatch(r'(assets/demo/[\w.-]+|/workspace/(uploads|tts)/[\w.-]+)', url):
            path = (self.base / url.lstrip('/')).resolve()
            allowed = [(self.base / 'assets/demo').resolve(), (self.base / 'workspace/uploads').resolve(),
                       (self.base / 'workspace/tts').resolve()]
            if path.parent not in allowed or not path.is_file():
                raise ValueError('Không tìm thấy tư liệu âm thanh trong dự án.')
            return path
        match = re.fullmatch(r'data:(audio|video)/([\w.+-]+);base64,([A-Za-z0-9+/=\r\n]+)', url)
        if match:
            if len(match[3]) > 700 * 1024 * 1024:
                raise ValueError('Tư liệu nhúng quá lớn để xuất.')
            data = base64.b64decode(match[3], validate=True)
            path = self.folder / ('embedded_' + uuid.uuid4().hex + '.media')
            path.write_bytes(data)
            return path
        raise ValueError('Tư liệu âm thanh cần được nhập và lưu trước khi xuất MP4.')

    def _collect_audio(self):
        clips = self.project.get('clips', [])
        media = self.project.get('media', {})
        state = self.project.get('trackState', {})
        if not isinstance(clips, list) or not isinstance(media, dict) or not isinstance(state, dict) or len(clips) > 3000:
            raise ValueError('Dữ liệu dự án không hợp lệ.')
        sources, has_audio = {}, {}
        for clip in clips:
            item = media.get(clip.get('mediaId'))
            track = state.get(clip.get('track'), {})
            if not item or item.get('type') not in {'video', 'audio'} or clip.get('muted') or clip.get('hidden') or track.get('hidden') or track.get('muted'):
                continue
            key = clip['mediaId']
            if key not in sources:
                sources[key] = self._source(item)
                result = subprocess.run([shutil.which('ffprobe'), '-v', 'error', '-select_streams', 'a:0',
                                         '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', str(sources[key])],
                                        capture_output=True, timeout=30, creationflags=FLAGS)
                has_audio[key] = result.returncode == 0 and b'audio' in result.stdout
            if has_audio[key]:
                normalized = {
                    'start': bounded(clip.get('start', 0), 0, 21600, 'Thời điểm bắt đầu'),
                    'duration': bounded(clip.get('duration', 1), .05, 21600, 'Thời lượng clip'),
                    'sourceIn': bounded(clip.get('sourceIn', 0), 0, 21600, 'Điểm nguồn'),
                    'speed': bounded(clip.get('speed', 1), .25, 4, 'Tốc độ'),
                    'volume': bounded(clip.get('volume', 1), 0, 2, 'Âm lượng'),
                    'fadeIn': bounded(clip.get('fadeIn', 0), 0, 30, 'Fade in'),
                    'fadeOut': bounded(clip.get('fadeOut', 0), 0, 30, 'Fade out'),
                    'speedCurve': clip.get('speedCurve') if clip.get('speedCurve') in CURVES else 'none',
                    'curveSpan': bounded(clip.get('curveSpan',clip.get('duration',1)),.05,216000,'Curve span'),
                    'curveOffset': bounded(clip.get('curveOffset',0),-216000,216000,'Curve offset'),
                    'voiceEffect': clip.get('voiceEffect') if clip.get('voiceEffect') in {'deep','high','echo','radio'} else 'none',
                    'ducking': bool(clip.get('ducking')),
                    'voice': clip.get('audioRole')=='voice' or item.get('url','').startswith('/workspace/tts/')
                }
                self.audio.append((sources[key], normalized))

    def write(self, start, frames):
        with self.lock:
            if self.cancelled or self.proc is None:
                raise ValueError('Tác vụ xuất đã hủy.')
            if start != self.received:
                raise ValueError('Thứ tự khung hình không khớp, vui lòng xuất lại.')
            if not 1 <= len(frames) <= 30 or self.received + len(frames) > self.expected:
                raise ValueError('Số khung hình không hợp lệ.')
            encoded = []
            for frame in frames:
                data = frame.read(16 * 1024 * 1024)
                with Image.open(io.BytesIO(data)) as image:
                    if image.format != 'JPEG' or image.size != (self.width, self.height):
                        raise ValueError('Kích thước hoặc định dạng khung hình không đúng.')
                    image.verify()
                encoded.append(data)
            try:
                for data in encoded:
                    self.proc.stdin.write(data)
                self.proc.stdin.flush()
            except (OSError, BrokenPipeError) as exc:
                raise ValueError('FFmpeg dừng mã hóa khung hình.') from exc
            self.received += len(encoded)

    def finish(self):
        with self.lock:
            if self.cancelled or self.received != self.expected:
                raise ValueError('Chưa nhận đủ khung hình hoặc tác vụ đã hủy.')
            self.proc.stdin.close()
            if self.proc.wait(timeout=180):
                raise ValueError('Không mã hóa được khung hình.')
            self.log.close()
            output = self.root / ('ClipCut_' + self.id + '.mp4')
            if not self.audio:
                shutil.copyfile(self.folder / 'video.mp4', output)
            else:
                command = [shutil.which('ffmpeg'), '-nostdin', '-v', 'error', '-y', '-i', str(self.folder / 'video.mp4')]
                filters, labels = [], []
                for i, (path, clip) in enumerate(self.audio, 1):
                    command += ['-i', str(path)]
                    duration = clip['duration']
                    if clip['speedCurve'] in CURVES:
                        # At most 300 source windows; pad before atempo to avoid
                        # short-window loss, then trim each window to its exact time.
                        count=min(300,max(2,math.ceil(duration/.1)))
                        split_labels=''.join(f'[s{i}_{k}]' for k in range(count))
                        filters.append(f'[{i}:a:0]asplit={count}'+split_labels)
                        for k in range(count):
                            t0,t1=duration*k/count,duration*(k+1)/count
                            a,b=source_offset(clip,t0),source_offset(clip,t1)
                            rate=(b-a)/(t1-t0)
                            trim=[f'atrim=start={clip["sourceIn"]+a}:duration={b-a+.15*rate}', 'asetpts=PTS-STARTPTS', 'apad=pad_dur=0.15']
                            trim+=tempo_filters(rate)+[f'atrim=duration={t1-t0}','asetpts=PTS-STARTPTS']
                            filters.append(f'[s{i}_{k}]'+','.join(trim)+f'[c{i}_{k}]')
                        filters.append(''.join(f'[c{i}_{k}]' for k in range(count))+f'concat=n={count}:v=0:a=1[curve{i}]')
                        source_label=f'[curve{i}]'
                        chain=[]
                    else:
                        source_label=f'[{i}:a:0]'
                        chain=[f'atrim=start={clip["sourceIn"]}:duration={duration*clip["speed"]}', 'asetpts=PTS-STARTPTS']+tempo_filters(clip['speed'])
                    chain += ['aresample=48000']
                    effect=clip['voiceEffect']
                    if effect in {'deep','high'}:
                        pitch=.8 if effect=='deep' else 1.25
                        chain += [f'asetrate={48000*pitch}', 'aresample=48000']+tempo_filters(1/pitch)
                    elif effect=='echo':
                        chain += ['aecho=0.85:1:180:0.32']
                    elif effect=='radio':
                        chain += ['highpass=f=500','lowpass=f=2800']
                    chain += ['apad',f'atrim=duration={duration}',f'volume={clip["volume"]}']
                    if clip['ducking'] and not clip['voice']:
                        gain='1'
                        for _,voice in self.audio:
                            if voice['voice'] and voice['volume']>0:
                                a=voice['start']-clip['start'];b=a+voice['duration']
                                envelope=f'clip(min((t-{a}+.12)/.12,({b}+.12-t)/.12),0,1)'
                                gain=f'min({gain},1-.72*{envelope})'
                        chain += [f"volume='{gain}':eval=frame"]
                    if clip['fadeIn']:
                        chain.append(f'afade=t=in:st=0:d={min(duration,clip["fadeIn"])}')
                    if clip['fadeOut']:
                        fade = min(duration, clip['fadeOut'])
                        chain.append(f'afade=t=out:st={duration-fade}:d={fade}')
                    chain.append(f'adelay={round(clip["start"]*1000)}:all=1')
                    filters.append(source_label + ','.join(chain) + f'[a{i}]')
                    labels.append(f'[a{i}]')
                filters.append(''.join(labels) + f'amix=inputs={len(labels)}:normalize=0,alimiter=limit=0.95:level=0,apad[mixed]')
                graph = self.folder / 'audio-filter.txt'
                graph.write_text(';\n'.join(filters), encoding='utf-8')
                command += ['-filter_complex_script', str(graph), '-map', '0:v:0', '-map', '[mixed]', '-c:v', 'copy',
                            '-c:a', 'aac', '-b:a', '192k', '-t', str(self.duration), '-movflags', '+faststart', str(output)]
                with (self.folder / 'mix.log').open('wb') as log:
                    self.proc = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=log, creationflags=FLAGS)
                    if self.proc.wait(timeout=900):
                        raise ValueError('Không trộn được âm thanh. Kiểm tra các tư liệu nguồn.')
            self._cleanup()
            return output

    def cancel(self):
        self.cancelled = True
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.kill();self.proc.wait(timeout=5)
        if self.proc and self.proc.stdin and not self.proc.stdin.closed:
            try:
                self.proc.stdin.close()
            except OSError:
                pass
        if self.log and not self.log.closed:
            self.log.close()
        self._cleanup()

    def _cleanup(self):
        # Only generated per-job directories directly inside the export root can be removed.
        target = self.folder.resolve()
        if target.parent == self.root.resolve() and re.fullmatch(r'render_[a-f0-9]{32}', target.name):
            shutil.rmtree(target, ignore_errors=True)


class RenderStore:
    def __init__(self, root):
        self.root = root
        self.jobs = {}
        self.lock = threading.RLock()
        atexit.register(self.close)

    def create(self, data):
        if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
            raise ValueError('Cần FFmpeg và FFprobe để xuất MP4 từng khung hình.')
        width = int(bounded(data.get('width', 0), 128, 3840, 'Chiều rộng'))
        height = int(bounded(data.get('height', 0), 128, 3840, 'Chiều cao'))
        fps = int(data.get('fps', 30))
        duration = bounded(data.get('duration', 0), .05, 21600, 'Thời lượng')
        if fps not in {24, 30, 60} or width % 2 or height % 2:
            raise ValueError('FPS hoặc độ phân giải không hợp lệ.')
        project = data.get('project')
        if not isinstance(project, dict):
            raise ValueError('Thiếu dự án cần xuất.')
        with self.lock:
            for key, job in list(self.jobs.items()):
                if time.monotonic() - job.created > 7200:
                    job.cancel();self.jobs.pop(key, None)
            if len(self.jobs) >= 2:
                raise ValueError('Có tác vụ xuất khác đang chạy. Hãy hoàn tất hoặc hủy trước.')
            job = RenderJob(self.root, project, width, height, fps, duration)
            self.jobs[job.id] = job
            return job

    def get(self, key):
        with self.lock:
            if not re.fullmatch('[a-f0-9]{32}', key) or key not in self.jobs:
                raise ValueError('Tác vụ xuất không tồn tại hoặc đã hết hạn.')
            return self.jobs[key]

    def remove(self, key):
        with self.lock:
            return self.jobs.pop(key, None)

    def close(self):
        with self.lock:
            for job in self.jobs.values():
                job.cancel()
            self.jobs.clear()
