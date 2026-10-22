"""Local project folders with bounded inputs and atomic file replacement."""
import json
import math
import os
from pathlib import Path
import re
import threading
import time
import uuid


class ProjectStore:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()

    def folder(self, project_id):
        if not re.fullmatch(r'[a-f0-9]{32}', str(project_id)):
            raise ValueError('Mã dự án không hợp lệ.')
        folder = self.root / project_id
        if folder.is_symlink() or folder.resolve().parent != self.root:
            raise ValueError('Thư mục dự án không hợp lệ.')
        return folder

    @staticmethod
    def validate(project):
        if not isinstance(project, dict) or project.get('format') != 'clipcut-project':
            raise ValueError('Định dạng dự án không hợp lệ.')
        clips, media = project.get('clips'), project.get('media')
        if not isinstance(clips, list) or len(clips) > 3000 or not isinstance(media, dict) or len(media) > 1000:
            raise ValueError('Danh sách clip hoặc tư liệu không hợp lệ.')
        if project.get('ratio') not in {'16:9', '9:16', '1:1', '4:5'}:
            raise ValueError('Tỷ lệ dự án không hợp lệ.')
        for clip in clips:
            if not isinstance(clip, dict) or clip.get('track') not in {'video', 'overlay', 'audio', 'text', 'sticker'}:
                raise ValueError('Track của clip không hợp lệ.')
            try:
                start, duration = float(clip.get('start', 0)), float(clip['duration'])
            except (TypeError, ValueError, KeyError):
                raise ValueError('Thời gian clip không hợp lệ.')
            if not math.isfinite(start) or not math.isfinite(duration) or start < 0 or duration <= 0 or start + duration > 21600:
                raise ValueError('Thời gian clip phải nằm trong 6 giờ.')
            if clip.get('mediaId') and (not isinstance(clip['mediaId'],str) or clip['mediaId'] not in media):
                raise ValueError('Clip đang tham chiếu tư liệu bị thiếu.')
        for item in media.values():
            if not isinstance(item, dict) or item.get('type') not in {'video', 'audio', 'image'}:
                raise ValueError('Loại tư liệu không hợp lệ.')
            url = item.get('url', '')
            if not isinstance(url, str) or not re.fullmatch(r'(?:assets/demo/[\w.-]+|data:(?:image|video|audio)/[^,]+,[\s\S]+)', url):
                raise ValueError('Hãy đóng gói tư liệu vào dự án trước khi lưu thư mục.')

    @staticmethod
    def atomic_json(path, value):
        temporary = path.with_name('.' + uuid.uuid4().hex + '.tmp')
        try:
            with temporary.open('w', encoding='utf-8') as stream:
                json.dump(value, stream, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)

    def save(self, payload, project_id=None):
        if not isinstance(payload, dict):
            raise ValueError('Thiếu dự án cần lưu.')
        project = payload.get('project')
        self.validate(project)
        with self.lock:
            project_id = project_id or uuid.uuid4().hex
            folder = self.folder(project_id)
            if folder.exists() and not (folder/'project.clipcut').is_file():
                raise ValueError('Thư mục không phải dự án tibe.')
            folder.mkdir(exist_ok=True)
            project = {**project, 'name': str(project.get('name') or 'Video chưa đặt tên')[:120], 'libraryId': project_id}
            thumbnail = payload.get('thumbnail', '')
            if not isinstance(thumbnail, str) or len(thumbnail) > 250000 or (thumbnail and not re.fullmatch(r'data:image/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+', thumbnail)):
                thumbnail = ''
            metadata = {'id': project_id, 'name': project['name'], 'ratio': project['ratio'],
                        'clipCount': len(project['clips']), 'duration': max((float(c.get('start', 0))+float(c['duration']) for c in project['clips']), default=0),
                        'updatedAt': time.time(), 'thumbnail': thumbnail, 'folder': project_id}
            self.atomic_json(folder/'project.clipcut', project)
            self.atomic_json(folder/'meta.json', metadata)
            return metadata

    def list(self):
        with self.lock:
            projects = []
            for folder in self.root.iterdir():
                if not re.fullmatch(r'[a-f0-9]{32}', folder.name) or folder.is_symlink() or not (folder/'project.clipcut').is_file():
                    continue
                try:
                    metadata = json.loads((folder/'meta.json').read_text(encoding='utf-8'))
                    if metadata.get('id') == folder.name:
                        projects.append(metadata)
                except (OSError, ValueError, AttributeError):
                    continue
            return sorted(projects, key=lambda p:p.get('updatedAt', 0), reverse=True)[:200]

    def load(self, project_id):
        with self.lock:
            source = self.folder(project_id)/'project.clipcut'
            if source.is_symlink() or not source.is_file():
                raise ValueError('Không tìm thấy dự án đã lưu.')
            return json.loads(source.read_text(encoding='utf-8'))
