"""Real, read-only REA CLI integration. REA is not a video rendering engine."""
import asyncio
import base64
import copy
import io
import hashlib
import json
import math
import mimetypes
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import uuid
import zipfile

from PIL import Image
from render_engine import source_offset


def export_capcut_draft(project, workspace_dir):
    """Export an editable, best-effort desktop draft without touching CapCut's store.

    Schema references (community implementations, not an official interchange API):
    https://github.com/GuanYixuan/pyCapCut/tree/main/pycapcut/assets
    https://github.com/renezander030/capcut-cli/tree/master/docs/draft-schema
    Native opening is deliberately not certified by this structural exporter.
    """
    if not isinstance(project, dict) or project.get('format') != 'clipcut-project':
        raise ValueError('Dự án tibe không hợp lệ.')
    clips, media, state = project.get('clips'), project.get('media'), project.get('trackState', {})
    if not isinstance(clips, list) or not 1 <= len(clips) <= 3000 or not all(isinstance(c,dict) for c in clips) or not isinstance(media, dict) or not isinstance(state, dict):
        raise ValueError('Dự án cần có từ 1 đến 3.000 clip.')
    workspace = Path(workspace_dir).resolve()
    base = workspace.parent
    project_id = str(uuid.uuid4()).upper()
    folder = workspace / 'exports' / ('CapCut_Draft_' + uuid.uuid4().hex)
    folder.mkdir(parents=True)
    assets = folder / 'assets'
    assets.mkdir()
    archive = folder.with_suffix('.zip')
    warnings, registration, imported = [], [], {}
    us = lambda value: round(float(value) * 1_000_000)
    def number(value, default=0, low=-21600, high=21600):
        result = float(default if value is None else value)
        if not math.isfinite(result) or not low <= result <= high:
            raise ValueError('Giá trị clip vượt phạm vi cho phép.')
        return result
    def identifier():
        return str(uuid.uuid4()).upper()
    def resolve_asset(item):
        url = item.get('url', '')
        if not isinstance(url, str):
            raise ValueError('Đường dẫn tư liệu không hợp lệ.')
        if re.fullmatch(r'(assets/demo/[\w.-]+|/workspace/(uploads|tts)/[\w.-]+)', url):
            path = (base / url.lstrip('/')).resolve()
            allowed = {(base / 'assets/demo').resolve(), (workspace / 'uploads').resolve(), (workspace / 'tts').resolve()}
            if path.parent not in allowed or not path.is_file():
                raise ValueError('Không tìm thấy tư liệu đã nhập.')
            return path
        match = re.fullmatch(r'data:(image|video|audio)/([\w.+-]+);base64,([A-Za-z0-9+/=\r\n]+)', url)
        if not match or len(match[3]) > 700 * 1024 * 1024:
            raise ValueError('Chỉ xuất tư liệu cục bộ đã nhập hoặc tư liệu nhúng hợp lệ.')
        extension = mimetypes.guess_extension(match[1] + '/' + match[2]) or '.media'
        path = assets / ('source_' + uuid.uuid4().hex + extension)
        path.write_bytes(base64.b64decode(match[3], validate=True))
        return path
    def import_asset(key, item):
        if key in imported:
            return imported[key]
        kind = item.get('type')
        if kind not in {'image', 'video', 'audio'}:
            raise ValueError('Loại tư liệu không hợp lệ.')
        source = resolve_asset(item)
        target = assets / (uuid.uuid4().hex + ('.png' if kind == 'image' else source.suffix.lower()))
        width, height = int(number(item.get('width'), 0, 0, 100000)), int(number(item.get('height'), 0, 0, 100000))
        if kind == 'image':
            with Image.open(source) as image:
                width, height = image.size
                image.convert('RGBA').save(target)
        else:
            shutil.copyfile(source, target)
            if shutil.which('ffprobe'):
                probe = subprocess.run([shutil.which('ffprobe'), '-v', 'error', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', str(target)], capture_output=True, timeout=30, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                if probe.returncode:
                    raise ValueError('Không đọc được tư liệu âm thanh/video.')
                info = json.loads(probe.stdout)
                video = next((v for v in info.get('streams', []) if v.get('width')), {})
                width, height = video.get('width', width), video.get('height', height)
        local_id, material_id = identifier(), identifier()
        duration = us(number(item.get('duration'), 4, .001, 21600))
        path = str(target.resolve()).replace('\\', '/')
        name = str(item.get('name', target.name))[:200]
        registration.append({'id': local_id, 'file_Path': path, 'extra_info': name, 'duration': duration, 'width': width, 'height': height,
                             'metetype': {'image': 'photo', 'video': 'video', 'audio': 'music'}[kind], 'type': 0, 'item_source': 1,
                             'create_time': -1, 'import_time': -1, 'import_time_ms': -1, 'md5': '', 'ai_group_type': '',
                             'roughcut_time_range': {'start': -1, 'duration': -1}, 'sub_time_range': {'start': -1, 'duration': -1}})
        material = {'id': material_id, 'local_material_id': local_id, 'path': path, 'duration': duration, 'material_name': name,
                    'name': name, 'width': width, 'height': height, 'type': 'photo' if kind == 'image' else 'extract_music' if kind == 'audio' else 'video'}
        if kind != 'audio':
            material.update(crop={'upper_left_x': 0, 'upper_left_y': 0, 'upper_right_x': 1, 'upper_right_y': 0,
                                  'lower_left_x': 0, 'lower_left_y': 1, 'lower_right_x': 1, 'lower_right_y': 1},
                            crop_ratio='free', crop_scale=1.0, audio_fade=None,
                            matting={'flag': 0, 'has_use_quick_brush': False, 'interactiveTime': [], 'path': '', 'strokes': []},
                            stable={'matrix_path': '', 'stable_level': 0}, video_algorithm={'algorithms': []})
            if kind == 'image':
                material['duration'] = 10800000000
        else:
            material.update(music_id='', category_id='', category_name='local', source_platform=0, wave_points=[], tone_category_id='', tone_category_name='', tone_effect_id='', tone_effect_name='')
        imported[key] = (material, kind)
        return imported[key]
    try:
        ratio = project.get('ratio', '9:16')
        if ratio not in {'9:16', '16:9', '1:1', '4:5'}:
            raise ValueError('Tỷ lệ khung hình không hợp lệ.')
        rw, rh = map(int, ratio.split(':'))
        width, height = round(1080 * rw / min(rw, rh)), round(1080 * rh / min(rw, rh))
        logical_h = 450 * rh / rw
        name = str(project.get('name', 'tibe Project'))[:120]
        platform = {'app_id': 359289, 'app_source': 'cc', 'app_version': '8.3.0', 'os': 'windows'}
        # Only non-content schema markers are read from existing plaintext drafts.
        markers = {'version': 360000, 'new_version': '140.0.0'}
        drafts = Path.home() / 'AppData/Local/CapCut/User Data/Projects/com.lveditor.draft'
        if drafts.is_dir():
            for candidate in sorted(drafts.glob('*/draft_content.json'), key=lambda f: f.stat().st_mtime, reverse=True)[:20]:
                try:
                    if candidate.stat().st_size > 16 * 1024 * 1024:
                        continue
                    existing = json.loads(candidate.read_text(encoding='utf-8-sig'))
                    if isinstance(existing.get('version'), int) and isinstance(existing.get('new_version'), str):
                        markers = {key: existing[key] for key in markers}
                        break
                except (OSError, ValueError):
                    continue  # Encrypted drafts are never decrypted or modified.
        categories = 'videos audios texts stickers speeds audio_fades canvases common_mask chromas effects video_effects material_animations transitions placeholder_infos sound_channel_mappings vocal_separations audio_effects audio_balances beats shapes smart_crops manual_deformations'.split()
        materials = {key: [] for key in categories}
        draft = {'id': project_id, 'name': name, 'duration': 0, 'fps': 30.0, **markers, 'color_space': 0,
                 'canvas_config': {'width': width, 'height': height, 'ratio': ratio, 'background': None},
                 'platform': platform, 'last_modified_platform': dict(platform), 'create_time': 0, 'update_time': 0,
                 'config': {'maintrack_adsorb': False, 'video_mute': False, 'material_save_mode': 0},
                 'tracks': [], 'materials': materials, 'keyframes': {k: [] for k in ['videos','audios','texts','stickers','filters','effects','adjusts','handwrites']},
                 'keyframe_graph_list': [], 'relationships': [], 'free_render_index_mode_on': False, 'render_index_track_mode_on': False,
                 'cover': None, 'extra_info': None, 'mutable_config': None, 'source': 'default', 'path': ''}
        used_material_ids = set()
        lanes = []
        for clip in sorted(clips, key=lambda c: (['video','overlay','text','sticker','audio'].index(c.get('track')) if c.get('track') in ['video','overlay','text','sticker','audio'] else 99, number(c.get('start')))):
            if not isinstance(clip, dict) or clip.get('track') not in {'video','overlay','text','sticker','audio'}:
                raise ValueError('Track không hợp lệ.')
            start, duration = number(clip.get('start'), 0, 0), number(clip.get('duration'), 4, .05)
            rate = number(clip.get('speed'), 1, .25, 4)
            if clip.get('speedCurve') not in (None,'none'):
                # Preserve the consumed range; the native draft uses average rate.
                curve_clip=dict(clip,duration=duration,speed=rate,
                                curveSpan=number(clip.get('curveSpan'),duration,.05,216000),
                                curveOffset=number(clip.get('curveOffset'),0,-216000,216000))
                rate=source_offset(curve_clip,duration)/duration
            source_in = number(clip.get('sourceIn'), 0, 0)
            title = str(clip.get('title', ''))
            track_state = state.get(clip['track'], {})
            refs = []
            if clip['track'] in {'text','sticker'} and not clip.get('stickerId'):
                material_id, kind = identifier(), 'text'
                color = clip.get('color', '#ffffff')
                color = color if re.fullmatch(r'#[a-fA-F0-9]{6}', str(color)) else '#ffffff'
                rgb = [int(color[i:i+2], 16)/255 for i in (1,3,5)]
                font_size = number(clip.get('fontSize'), 42, 12, 120)/5
                text = {'text': title, 'styles': [{'range': [0,len(title.encode('utf-16-le'))//2], 'size': font_size,
                         'fill': {'content': {'solid': {'color': rgb}}}, 'bold': clip.get('textStyle') != 'script',
                         'italic': clip.get('textStyle') == 'script', 'font': {'id': '', 'path': ''}}], 'layer_weight': 1, 'effect': []}
                mat = {'id': material_id, 'type': 'text', 'content': json.dumps(text,ensure_ascii=False), 'font_size': font_size,
                       'text_color': '#'+color[1:].upper()+'FF', 'text_alpha': 1.0, 'text_alignment': 1, 'font_name': '', 'font_path': '',
                       'background_alpha': .7 if clip.get('textStyle') in {'subtitle','badge'} else 0.0,
                       'background_color': clip.get('badgeColor','#16141b')+'FF', 'background_style': 1,
                       'has_shadow': clip.get('textStyle') == 'neon', 'shadow_alpha': .8, 'shadow_color': '#000000FF',
                       'border_width': 0.0, 'line_spacing': .02, 'letter_spacing': 0.0, 'vertical': False, 'is_rich_text': False}
                materials['texts'].append(mat)
            else:
                if clip.get('stickerId'):
                    raster = project.get('stickerRasters', {}).get(clip['stickerId'])
                    if not isinstance(raster,str) or len(raster)>4*1024*1024 or not raster.startswith('data:image/png;base64,'):
                        raise ValueError('Thiếu ảnh PNG của sticker; hãy xuất từ giao diện tibe.')
                    mat, kind = import_asset('sticker:'+clip['stickerId'], {'type':'image','url':raster,'name':clip['stickerId'],'duration':duration})
                else:
                    key = clip.get('mediaId')
                    if key not in media:
                        raise ValueError('Clip thiếu tư liệu nguồn.')
                    mat, kind = import_asset(key, media[key])
                if clip['track']=='audio' and kind=='video':
                    mat=copy.deepcopy(mat);mat['id']=identifier();mat['type']='extract_music';kind='audio'
                material_id = mat['id']
                if material_id not in used_material_ids:
                    materials['audios' if kind=='audio' else 'videos'].append(mat);used_material_ids.add(material_id)
            native_track = 'text' if kind=='text' else 'audio' if clip['track']=='audio' else 'video'
            scale = number(clip.get('scale'), 1, .1, 5)
            if clip.get('stickerId'):
                scale *= number(clip.get('fontSize'),50,12,120)/450
            elif clip['track']=='overlay':
                scale *= 210/450
            native_transform = {'rotation': number(clip.get('rotation')), 'alpha': number(clip.get('opacity'), 1, 0, 1),
                                'scale': {'x':scale,'y':scale}, 'transform': {'x': number(clip.get('xOffset'))/225, 'y': -number(clip.get('yOffset'))/(logical_h/2)},
                                'flip': {'horizontal':bool(clip.get('flipX')),'vertical':bool(clip.get('flipY'))}}
            speed_id = identifier();materials['speeds'].append({'id':speed_id,'type':'speed','mode':0,'speed':rate,'curve_speed':None});refs.append(speed_id)
            if clip.get('fadeIn') or clip.get('fadeOut'):
                fade_id = identifier();materials['audio_fades'].append({'id':fade_id,'type':'audio_fade','fade_in_duration':us(number(clip.get('fadeIn'),0,0,30)),'fade_out_duration':us(number(clip.get('fadeOut'),0,0,30))});refs.append(fade_id)
            volume=0 if clip.get('muted') or track_state.get('muted') else number(clip.get('volume'),1,0,2)
            segment={'id':identifier(),'material_id':material_id,'target_timerange':{'start':us(start),'duration':us(duration)},
                     'source_timerange':{'start':us(source_in),'duration':us(duration*rate)},'clip':None if native_track=='audio' else native_transform,
                     'speed':rate,'volume':volume,'last_nonzero_volume':max(volume,.01),'visible':not(clip.get('hidden') or track_state.get('hidden')),
                     'render_index':0,'render_uniform_index':-1,'extra_material_refs':refs,'common_keyframes':[],
                     'uniform_scale':{'on':True,'value':scale},'group_id':'','track_render_index':0,'is_loop':False,
                     'enable_adjust':True,'enable_color_curves':True,'enable_color_wheels':True,'enable_lut':True,'cartoon':False}
            for prop, native, divisor in [('xOffset','KFTypePositionX',225),('yOffset','KFTypePositionY',-logical_h/2),('scale','UNIFORM_SCALE',1),('rotation','KFTypeRotation',1),('opacity','KFTypeAlpha',1)]:
                frames=clip.get('keyframes',[])
                if frames and native_track!='audio':
                    values=[{'id':identifier(),'time_offset':us(number(k.get('time'),0,0)),'values':[number(k.get(prop),1 if prop in {'scale','opacity'} else 0)/divisor], 'curveType':'Line','left_control':{'x':0,'y':0},'right_control':{'x':0,'y':0},'graphID':'','string_value':''} for k in frames[:1000]]
                    segment['common_keyframes'].append({'id':identifier(),'property_type':native,'keyframe_list':values,'material_id':''})
            lane=next((lane for lane in lanes if lane['source']==clip['track'] and lane['end']<=start+.000001),None)
            if lane is None:
                native_lane={'id':identifier(),'type':native_track,'name':clip['track'],'segments':[],'attribute':0,'flag':0,'is_default_name':False}
                lane={'source':clip['track'],'end':0,'track':native_lane};lanes.append(lane);draft['tracks'].append(native_lane)
            segment['render_index']=draft['tracks'].index(lane['track']);lane['track']['segments'].append(segment);lane['end']=start+duration
            draft['duration']=max(draft['duration'],us(start+duration))
            unsupported=[]
            for key in ('filter','effect','anim','mask','speedCurve','blend'):
                if clip.get(key) not in (None,'none','original','source-over'):
                    unsupported.append(key)
            if clip.get('chroma'):unsupported.append('chroma')
            if any(number(v) for v in clip.get('adjust',{}).values()):unsupported.append('adjust')
            if clip.get('ducking'):unsupported.append('ducking')
            if clip.get('voiceEffect') not in (None,'none'):unsupported.append('voiceEffect')
            if clip.get('textStyle') in {'script','karaoke','neon','badge'}:unsupported.append('textStyle')
            if clip.get('crop') or clip.get('fit')=='contain':unsupported.append('crop/fit')
            if clip.get('transition') not in (None,'none'):unsupported.append('transition')
            if unsupported:warnings.append({'clipId':clip.get('id'),'title':title,'features':unsupported,'note':'Giữ thông số gốc trong .clipcut; chưa chuyển nguyên vẹn sang engine CapCut. Xuất MP4 để giữ hình ảnh/âm thanh.'})
        # A curve is flattened to a source-range-preserving average in the native draft.
        # Never silently label an unsupported speed envelope as transferred.
        for lane in draft['tracks']:
            for seg in lane['segments']:
                if seg['source_timerange']['duration']<1:seg['source_timerange']['duration']=1
        now=time.time_ns()//1000
        meta={'draft_id':project_id,'draft_name':name,'draft_fold_path':str(folder).replace('\\','/'),'draft_root_path':str(folder.parent).replace('\\','/'),
              'draft_json_file':str(folder/'draft_content.json').replace('\\','/'),'draft_cover':'','draft_type':'',
              'draft_materials':[{'type':i,'value':registration if i==0 else []} for i in (0,1,2,3,6,7,8)],
              'draft_materials_copied_info':[],'draft_segment_extra_info':[],'draft_timeline_materials_size_':sum(f.stat().st_size for f in assets.iterdir()),
              'tm_draft_create':now,'tm_draft_modified':now,'tm_duration':draft['duration'],'tm_draft_removed':0,
              'cloud_draft_sync':False,'draft_is_invisible':False,'draft_new_version':markers['new_version']}
        report={'nativeOpenVerified':False,'target':'CapCut Desktop Windows 8.3','schemaVersion':markers,
                'transferred':['media registration','tracks without overlap within a lane','trim and start times','constant speed','text content','transforms','keyframes','volume and fades','rasterized vector stickers'],
                'warnings':warnings,'sources':['https://github.com/GuanYixuan/pyCapCut/tree/main/pycapcut/assets','https://github.com/renezander030/capcut-cli/tree/master/docs/draft-schema']}
        if project.get('canvas',{}).get('blur') or project.get('canvas',{}).get('enabled'):
            report['warnings'].append({'features':['canvas background'],'note':'Nền tibe chưa được chuyển vào bản nháp CapCut.'})
        for filename,data in [('draft_content.json',draft),('draft_meta_info.json',meta),('compatibility.json',report),('project.clipcut',project)]:
            (folder/filename).write_text(json.dumps(data,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
        (folder/'README.txt').write_text('TIBE → CAPCUT DESKTOP\n\nBản nháp thử nghiệm, chưa xác nhận mở thành công trong CapCut 8.3.\nĐọc compatibility.json để xem các tính năng cần dựng lại. MP4 giữ hiệu ứng chính xác.\n\nThư mục bản nháp trên máy: '+str(folder)+'\nThư mục dự án CapCut thường dùng: '+str(drafts)+'\n\nGói này không sửa hoặc đăng ký vào kho dự án CapCut của bạn. Các đường dẫn tư liệu trỏ tới thư mục xuất trên máy hiện tại; giữ thư mục này khi mở dự án. Khi chuyển máy cần liên kết lại tư liệu trong assets.\nDùng project.clipcut để mở đầy đủ trở lại trong tibe.\n',encoding='utf-8')
        with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as bundle:
            for file in folder.rglob('*'):
                if file.is_file():bundle.write(file,folder.name+'/'+file.relative_to(folder).as_posix())
        return archive,report
    except Exception:
        # Only this freshly created, UUID-named export folder can be removed.
        if folder.parent == (workspace/'exports') and re.fullmatch(r'CapCut_Draft_[a-f0-9]{32}',folder.name):
            shutil.rmtree(folder,ignore_errors=True)
        archive.unlink(missing_ok=True)
        raise


class ReaAgentsOrchestrator:
    def __init__(self, workspace_dir: Path):
        self.workspace = workspace_dir
        self.base = workspace_dir.parent
        self.tts_dir = workspace_dir / "tts"
        self.reports = workspace_dir / "rea"
        self.tts_dir.mkdir(parents=True, exist_ok=True)
        self.reports.mkdir(parents=True, exist_ok=True)

    def command(self):
        entry = self.base / "node_modules/rea-agents/scripts/rea.mjs"
        bundled = Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
        node = os.environ.get("CLIPCUT_NODE") or (str(bundled) if bundled.is_file() else shutil.which("node"))
        if entry.is_file() and node:
            return [node, str(entry)]
        cli = shutil.which("rea")
        return [cli] if cli and not cli.lower().endswith((".cmd", ".bat")) else None

    def target(self):
        configured = os.environ.get("CLIPCUT_REA_TARGET")
        if configured:
            return Path(configured)
        candidates = [Path.home() / "AppData/Local/CapCut/Apps"]
        if os.environ.get("LOCALAPPDATA"):
            candidates.insert(0, Path(os.environ["LOCALAPPDATA"]) / "CapCut/Apps")
        return next((p for p in candidates if p.is_dir()), candidates[0])

    def status(self, probe=False):
        command = self.command()
        status = {"installed": bool(command), "targetFound": self.target().is_dir(),
                  "purpose": "Phân tích bản cài cục bộ và đọc LUT tương thích; các gói engine được báo cáo riêng."}
        if command and not probe:
            try:
                package=json.loads((self.base/'node_modules/rea-agents/package.json').read_text(encoding='utf-8'))
                status.update(ready=True,version=package.get('version','installed'))
            except (OSError,ValueError):status.update(ready=True,version='installed')
        elif command:
            try:
                result = subprocess.run(command + ["--version"], capture_output=True, timeout=20,
                                        encoding="utf-8", errors="replace", creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                status.update(ready=result.returncode == 0, version=result.stdout.strip()[:200])
                if result.returncode:
                    status["error"] = result.stderr[-1200:]
            except (OSError, subprocess.TimeoutExpired) as exc:
                status.update(ready=False, error=str(exc))
        else:
            status["ready"] = False
        return status

    def inspect_capcut(self):
        command = self.command()
        if not command:
            raise ValueError("Chưa cài REA. Chạy npm install với Node.js 22.19+, 24.11+ hoặc 26+.")
        target = self.target().resolve()
        if not target.is_dir():
            raise ValueError("Không tìm thấy CapCut/Apps. Đặt CLIPCUT_REA_TARGET tới thư mục đã cài.")
        report = self.reports / f"capcut_{uuid.uuid4().hex}.evidence.json"
        # The published 6.7.0 CLI supports PE inspection; newer desktop-directory
        # commands in the upstream main-branch docs are not present in this release.
        versions = sorted((p for p in target.iterdir() if p.is_dir() and (p / "CapCut.exe").is_file()),
                          key=lambda p: tuple(int(x) if x.isdigit() else 0 for x in p.name.split('.')), reverse=True)
        binary = versions[0] / "CapCut.exe" if versions else target / "CapCut.exe"
        if not binary.is_file():
            raise ValueError("Không tìm thấy CapCut.exe trong thư mục đã chọn.")
        result = subprocess.run(command + ["inspect-pe-resources", str(binary), "--format", "json"],
                                capture_output=True, timeout=180, encoding="utf-8", errors="replace",
                                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        if result.returncode:
            raise ValueError((result.stderr or result.stdout)[-2400:])
        try:
            evidence = json.loads(result.stdout)
        except json.JSONDecodeError as exc:
            raise ValueError("REA không trả về JSON hợp lệ.") from exc
        payload = {"operation": "inspect-pe-resources", "version": versions[0].name if versions else None,
                   "installationComponents": sorted(p.name for p in binary.parent.iterdir())[:300],
                   "limitations": ["Chỉ kiểm tra tĩnh PE và tên thành phần cài đặt.",
                                   "Chưa dịch ngược engine, khôi phục mã hiệu ứng hoặc chuyển chức năng CapCut."],
                   "reaEvidence": evidence}
        report.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return {"ok": True, "evidence": payload, "reportUrl": f"/workspace/rea/{report.name}"}

    async def _voice(self, text, voice, path):
        import edge_tts
        await asyncio.wait_for(edge_tts.Communicate(text, voice).save(str(path)), timeout=120)

    def local_luts(self):
        target = self.target().resolve()
        versions = sorted((p for p in target.glob('*') if p.is_dir() and (p/'CapCut.exe').is_file()),
                          key=lambda p:tuple(int(n) if n.isdigit() else 0 for n in p.name.split('.')), reverse=True)
        roots = ([versions[0]/'Resources'] if versions else []) + [target.parent/'User Data/Resources/Lut',target.parent/'User Data/Cache/effect']
        result = []; seen = set(); lookup_seen = set(); skipped = 0
        for root in roots:
            if not root.is_dir(): continue
            for source in root.rglob('*.cube'):
                if len(result)>=24: break
                if source.is_symlink() or not source.resolve().is_relative_to(root.resolve()): continue
                if source.stat().st_size>4*1024*1024: skipped+=1;continue
                raw=source.read_bytes();digest=hashlib.sha256(raw).hexdigest()
                if digest in seen:continue
                try:text=raw.decode('utf-8-sig')
                except UnicodeDecodeError:skipped+=1;continue
                size=re.search(r'^\s*LUT_3D_SIZE\s+(\d+)\s*$',text,re.M)
                if not size or not 2<=int(size.group(1))<=65:skipped+=1;continue
                points=[];domain_min=[0.,0.,0.];domain_max=[1.,1.,1.]
                try:
                    for raw_line in text.splitlines():
                        line=raw_line.split('#')[0].strip()
                        if not line or line.startswith(('TITLE','LUT_3D_SIZE')):continue
                        if line.startswith('DOMAIN_MIN'):domain_min=list(map(float,line.split()[1:]));continue
                        if line.startswith('DOMAIN_MAX'):domain_max=list(map(float,line.split()[1:]));continue
                        row=list(map(float,line.split()))
                        if len(row)!=3 or any(not math.isfinite(v) for v in row):raise ValueError('Invalid cube row')
                        points.extend(round(v,6) for v in row)
                    if len(points)!=int(size.group(1))**3*3:raise ValueError('Invalid cube size')
                    if len(domain_min)!=3 or len(domain_max)!=3 or any(not math.isfinite(n) or not math.isfinite(domain_max[i]) or domain_max[i]<=n for i,n in enumerate(domain_min)):raise ValueError('Invalid cube domain')
                except ValueError:skipped+=1;continue
                lookup=hashlib.sha256(json.dumps([int(size.group(1)),domain_min,domain_max,points],separators=(',',':')).encode()).hexdigest()
                if lookup in lookup_seen:continue
                lookup_seen.add(lookup)
                seen.add(digest);result.append({'name':source.stem,'cube':text,'sha256':digest,
                    'source':{'kind':'CapCut local .cube','relativePath':source.relative_to(root).as_posix(),'sha256':digest}})
        return {'ok':True,'luts':result,'skipped':skipped,'version':versions[0].name if versions else None}

    def inspect_materials(self):
        command=self.command()
        if not command:raise ValueError('Chưa cài REA. Chạy npm install trước.')
        target=self.target().resolve()
        versions=sorted((p for p in target.glob('*') if p.is_dir() and (p/'CapCut.exe').is_file()),
                        key=lambda p:tuple(int(n) if n.isdigit() else 0 for n in p.name.split('.')),reverse=True)
        if not versions:raise ValueError('Chưa tìm thấy bản cài CapCut.')
        report=self.reports/f'capcut_materials_{uuid.uuid4().hex}.evidence.json'
        result=subprocess.run([command[0],str(self.base/'scripts/inspect_capcut_resources.mjs'),str(versions[0]),str(report)],
                              capture_output=True,timeout=180,encoding='utf-8',errors='replace',
                              creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        if result.returncode:raise ValueError((result.stderr or result.stdout)[-1800:])
        evidence=json.loads(report.read_text(encoding='utf-8'))
        return {'ok':True,'evidence':evidence,'reportUrl':f'/workspace/rea/{report.name}',
                'lutCount':len(self.local_luts()['luts'])}

    def synthesize_voice(self, text, voice="vi-VN-HoaiMyNeural"):
        if not isinstance(voice,str) or not re.fullmatch(r'[a-z]{2,3}-[A-Z]{2}-(?:[A-Za-z0-9]+-)*[A-Za-z0-9]+Neural',voice):
            raise ValueError("Giọng đọc không hợp lệ.")
        if not isinstance(text, str) or not 1 <= len(text.strip()) <= 5000:
            raise ValueError("Nhập từ 1 đến 5.000 ký tự.")
        path = self.tts_dir / f"tts_{uuid.uuid4().hex}.mp3"
        asyncio.run(self._voice(text, voice, path))
        return {"ok": True, "audioUrl": f"/workspace/tts/{path.name}", "voice": voice}
