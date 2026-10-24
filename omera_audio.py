"""Omera audio preparation, real RMS envelopes and locally synthesized UI sounds."""
from pathlib import Path
import array
import hashlib
import json
import math
import subprocess
import uuid
import wave

FLAGS = getattr(subprocess, 'CREATE_NO_WINDOW', 0)


def duration(path):
    result = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(path)], capture_output=True, text=True, check=True, timeout=30, creationflags=FLAGS)
    value = float(json.loads(result.stdout)['format']['duration'])
    if not math.isfinite(value) or value <= 0:
        raise ValueError('Âm thanh không có thời lượng hợp lệ.')
    return value


def rms_envelope(path, count=1024):
    with wave.open(str(path), 'rb') as audio:
        samples = array.array('h', audio.readframes(audio.getnframes()))
        if audio.getsampwidth() != 2 or audio.getnchannels() != 1:
            raise ValueError('Envelope cần PCM mono 16-bit.')
    stride = max(1, math.ceil(len(samples) / count))
    values = []
    for start in range(0, len(samples), stride):
        part = samples[start:start + stride]
        rms = math.sqrt(sum(sample * sample for sample in part) / len(part)) / 32768
        values.append(round(min(1, rms * 5), 4))
    return values


def prepare_voice(base, source, text, voice, local_engine, cancel_event, hook=True):
    """Only explicit local TTS; no external provider substitution."""
    directory = base / 'workspace/tts'
    directory.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    digest.update(json.dumps({'text': text, 'voice': voice, 'processing': 2, 'hook': bool(hook)}, ensure_ascii=False).encode('utf-8'))
    if source:
        with open(source, 'rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(chunk)
    target = directory / ('omera_' + digest.hexdigest()[:32] + '.wav')
    if target.is_file():
        return target, duration(target), rms_envelope(target)
    raw = None
    try:
        if not source:
            if not text.strip():
                return None, 0, []
            if not local_engine or not local_engine.status().get('available'):
                raise ValueError('Bộ giọng Việt đang chuẩn bị; mở Giọng đọc để xem trạng thái trước khi chạy lô.')
            raw = directory / ('local_' + uuid.uuid4().hex + '.wav')
            local_engine.synthesize(text, voice, raw, cancel_event=cancel_event)
            source = raw
        if cancel_event.is_set():
            raise ValueError('Đã hủy tác vụ.')
        clean = ('[0:a]silenceremove=start_periods=1:start_duration=0.02:start_threshold=-42dB:'
                 'stop_periods=-1:stop_duration=0.14:stop_threshold=-42dB:stop_silence=0.04,aresample=48000')
        if hook:
            graph = (clean + ',asplit=2[head][tail];'
                '[head]atrim=end=3.45,asetpts=PTS-STARTPTS,atempo=1.15[fast];'
                '[tail]atrim=start=3.45,asetpts=PTS-STARTPTS[rest];'
                '[fast][rest]concat=n=2:v=0:a=1[out]')
        else:
            graph = clean + ',asetpts=PTS-STARTPTS[out]'
        temporary = target.with_name(target.stem + '.partial.wav')
        result = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', str(source),
            '-filter_complex', graph, '-map', '[out]', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', str(temporary)],
            capture_output=True, timeout=180, creationflags=FLAGS)
        if result.returncode:
            temporary.unlink(missing_ok=True)
            raise ValueError('Không xử lý được lời đọc: ' + result.stderr.decode('utf-8', errors='replace')[-350:])
        duration(temporary)
        temporary.replace(target)
        return target, duration(target), rms_envelope(target)
    finally:
        if raw:
            raw.unlink(missing_ok=True)