"""Local Omera workspace bridge. Read verified reports; create separate editable drafts."""
from __future__ import annotations

import base64
from contextlib import closing
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import sqlite3

from flask import Blueprint, jsonify, render_template, request, send_file
from PIL import Image, ImageOps

CHANNEL = 'UC5YEwdle02kdZZqF2q7Ajtw'
VN = timezone(timedelta(hours=7))
SLUG = re.compile(r'[a-z0-9-]{1,70}')
VIDEO = re.compile(r'[A-Za-z0-9_-]{11}')


def read_json(path):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None


def stamp(value):
    try:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return dt.astimezone(VN) if dt.tzinfo else None
    except (TypeError, ValueError, AttributeError):
        return None


def numeric(value):
    return value if isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value) else None


class OmeraHub:
    def __init__(self, source, project_store):
        self.source = Path(source).resolve()
        self.projects = project_store

    def briefs(self):
        result = {}
        for p in (self.source / 'content').glob('*.json'):
            b = read_json(p)
            if not isinstance(b, dict) or b.get('channel_id') != CHANNEL or not SLUG.fullmatch(b.get('slug', '')):
                continue
            if b.get('superseded_by') or b.get('asset_policy') != 'original_ai_composited':
                continue
            result[b['slug']] = b
        return result

    def receipts(self):
        result = []
        for p in (self.source / 'data/productions').glob('*/manifest.json'):
            r = read_json(p)
            if isinstance(r, dict) and r.get('channel_id') == CHANNEL and not r.get('superseded_by'):
                result.append((p, r))
        return result

    def snapshot(self):
        path = self.source / 'data/studio.sqlite3'
        if not path.is_file():
            return None, 'Chưa kết nối kho số liệu Omera trên máy này.'
        try:
            with closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True, timeout=3)) as db:
                row = db.execute('SELECT snapshot,last_error FROM channel_reports WHERE channel_id=?', (CHANNEL,)).fetchone()
            if not row:
                return None, 'Chưa có báo cáo Studio đã xác minh.'
            snap = json.loads(row[0])
            if snap.get('channel_id') != CHANNEL or not isinstance(snap.get('videos'), list):
                raise ValueError('Wrong report')
            return snap, row[1]
        except (sqlite3.Error, ValueError, OSError):
            return None, 'Kho số liệu tạm thời chưa đọc được. Bản gốc được giữ nguyên.'

    def overview(self):
        snap, error = self.snapshot()
        if not snap:
            return {'ok': True, 'connected': False, 'message': error, 'videos': [], 'briefs': []}
        observations = {}
        for p in (self.source / 'data/assessments').glob('*.json'):
            a = read_json(p)
            if not isinstance(a, dict) or a.get('channel_id') != CHANNEL:
                continue
            for r in a.get('videos', []) if isinstance(a.get('videos'), list) else []:
                if not isinstance(r, dict) or not isinstance(r.get('metrics'), dict):
                    continue
                when = stamp(r.get('engagement_observed_at'))
                old = observations.get(r.get('video_id'))
                if when and (not old or when > stamp(old['engagement_observed_at'])):
                    observations[r['video_id']] = r
        receipts = self.receipts()
        published = {r['youtube_video_id']: r for _, r in receipts if r.get('publishing_status') == 'published' and VIDEO.fullmatch(r.get('youtube_video_id', ''))}
        videos = []
        metric_keys = ['engaged_views', 'analytics_views', 'stayed_to_watch_percent', 'swiped_away_percent', 'average_view_duration_seconds', 'average_percentage_viewed', 'subscribers_change']
        for v in snap['videos']:
            vid = v.get('video_id', '')
            if v.get('visibility') != 'public' or not VIDEO.fullmatch(vid):
                continue
            a = observations.get(vid, {})
            r = published.get(vid, {})
            at, pub = stamp(a.get('engagement_observed_at')), stamp(r.get('published_at'))
            videos.append({**{k:v.get(k) for k in ['video_id','title','published_at','views','duration','kind','notice','notice_observed_at']},
                           'views': numeric(v.get('views')), 'original': bool(r),
                           'metrics': {k:numeric(a.get('metrics', {}).get(k)) for k in metric_keys},
                           'analytics_observed_at': a.get('engagement_observed_at'), 'period': a.get('period'),
                           'age_hours': round((at-pub).total_seconds()/3600, 1) if at and pub else None,
                           'apv_source': a.get('apv_source'), 'retention_note': a.get('retention_note'),
                           'source_url': f'https://studio.youtube.com/video/{vid}/analytics/tab-overview/period-default'})
        briefs = []
        for slug, b in self.briefs().items():
            matching = next((r for _,r in receipts if r.get('title') == b['title']), {})
            briefs.append({'slug':slug, 'title':b['title'], 'scene_count':len(b.get('scenes', [])),
                           'state':matching.get('publishing_status', 'draft'),
                           'youtube_video_id':matching.get('youtube_video_id')})
        policy = read_json(self.source/'data/publication-policy.json') or {}
        last = stamp(snap.get('observed_at'))
        counts = [v['views'] for v in videos]
        revenue = numeric(snap.get('estimated_revenue_usd')) if snap.get('revenue_period') else None
        return {'ok':True, 'connected':True, 'channel':{'id':CHANNEL,'name':snap.get('channel_name','Omera Studio')},
                'observed_at':snap.get('observed_at'),'subscriber_observed_at':snap.get('subscriber_observed_at'),
                'loaded_at':datetime.now(VN).isoformat(),'source':snap.get('source'), 'complete':snap.get('complete') is True,
                'stale': not last or (datetime.now(VN)-last).total_seconds()>21600, 'last_error':error,
                'summary':{'published_count':len(videos),'views':sum(counts) if all(v is not None for v in counts) else None,
                           'subscribers':numeric(snap.get('subscribers')),'draft_count':numeric(snap.get('draft_count')),
                           'revenue_status':snap.get('revenue_status'), 'estimated_revenue_usd':revenue,'revenue_period':snap.get('revenue_period'),
                           'original_count':len(published)},
                'eligibility':snap.get('eligibility'), 'monetization_observed_at':snap.get('monetization_observed_at'),
                'videos':sorted(videos,key=lambda v:v.get('published_at') or '',reverse=True),'briefs':list(reversed(briefs)),
                'policy':{k:policy.get(k) for k in ['max_new_per_day','minimum_gap_hours','trial_limit','review_at_trial_count','review_due_local_date']}}

    def asset(self, item):
        relative = item.get('file', '')
        path = (self.source / relative).resolve()
        if not path.is_relative_to((self.source/'data/creative').resolve()) or not path.is_file() or path.suffix.lower() not in {'.png','.jpg','.jpeg','.webp'}:
            raise ValueError('Ảnh gốc không nằm trong thư viện minh họa được duyệt.')
        if path.stat().st_size > 25*1024*1024 or hashlib.sha256(path.read_bytes()).hexdigest() != item.get('sha256'):
            raise ValueError('Ảnh gốc đã thay đổi; cần kiểm tra nguồn trước khi dựng.')
        return path

    def project(self, slug):
        if not SLUG.fullmatch(slug):
            raise ValueError('Mã kịch bản không hợp lệ.')
        brief = self.briefs().get(slug)
        if not brief:
            raise ValueError('Không tìm thấy kịch bản gốc có nguồn minh họa.')
        assets = brief.get('asset_provenance', [])
        if not assets:
            raise ValueError('Kịch bản chưa có minh họa có nguồn.')
        media, clips, start = {}, [], 0.
        for i, scene in enumerate(brief['scenes']):
            duration = numeric(scene.get('min_duration')) or 4
            if not .5 <= duration <= 120:
                raise ValueError('Thời lượng cảnh chưa phù hợp.')
            visual = scene.get('visual','')
            key = ('high' if visual in {'angle_a','angle_high'} else 'low') if visual.startswith('angle_') else ('beach' if visual in {'space_beach','space_context'} else 'room')
            asset = next((a for a in assets if Path(a['file']).stem == key), assets[min(i, len(assets)-1)])
            with Image.open(self.asset(asset)) as im:
                image = im.convert('RGB')
                if visual.startswith('space_') and key == 'room':
                    image = image.resize((round(image.width*1920/image.height),1920), Image.Resampling.LANCZOS)
                    left = 255 if visual == 'space_a' else 535
                    image = image.crop((left,0,left+1080,1920))
                image = ImageOps.fit(image,(720,1280),method=Image.Resampling.LANCZOS)
                buf = io.BytesIO(); image.save(buf,format='JPEG',quality=90)
            mid=f'omera_{i}'
            media[mid]={'id':mid,'name':scene.get('headline','Cảnh minh họa'),'type':'image','duration':duration,
                        'url':'data:image/jpeg;base64,'+base64.b64encode(buf.getvalue()).decode()}
            clips.append({'id':f'ov{i}','track':'video','mediaId':mid,'title':scene.get('headline','Cảnh'), 'start':start,'duration':duration,'fit':'cover','anim':'none','filter':'original','effect':'none','transition':'none',
                          'keyframes':[{'time':0,'scale':1,'xOffset':0,'yOffset':0,'rotation':0,'opacity':1},{'time':duration,'scale':1.025,'xOffset':0,'yOffset':0,'rotation':0,'opacity':1}]})
            clips.append({'id':f'ot{i}','track':'text','title':scene.get('headline',''),'start':start,'duration':duration,'fontSize':22,'color':'#fff5df','textStyle':'heading','yOffset':-300,'anim':'none'})
            start += duration
        return {'format':'clipcut-project','version':2,'name':brief['title']+' · bản dựng Tibe','ratio':'9:16','clips':clips,'media':media,'canvas':{'enabled':True,'color':'#0b1820','blur':False}}


def register_omera(app, base, project_store):
    base = Path(base)
    default = base.parents[1]/'App/Py-YT'
    config = read_json(base/'workspace/omera-config.json') or {}
    hub = OmeraHub(os.environ.get('TIBE_OMERA_ROOT') or config.get('source_root') or default, project_store)
    bp = Blueprint('omera',__name__)

    @bp.get('/omera')
    @bp.get('/omera.html')
    def home():
        return render_template('omera.html')

    @bp.get('/api/omera/overview')
    def overview():
        response=jsonify(hub.overview()); response.headers['Cache-Control']='no-store'; return response

    @bp.get('/api/omera/brief/<slug>')
    def brief(slug):
        b=hub.briefs().get(slug)
        if not b: return jsonify(ok=False,error='Không tìm thấy kịch bản.'),404
        return jsonify(ok=True,brief={k:b.get(k) for k in ['slug','title','description','scenes','sources']})

    @bp.post('/api/omera/project/<slug>')
    def project(slug):
        p=hub.project(slug)
        saved=project_store.save({'project':p})
        return jsonify(ok=True,project_id=saved['id'],editor_url=f'/?project={saved["id"]}',
                       note='Bản phân cảnh chỉnh sửa được; chưa có giọng, nhạc hoặc phụ đề đồng bộ. Thời lượng đang theo đề cương, chưa phải bản đã duyệt để đăng.')

    @bp.get('/api/omera/video/<video_id>')
    def video(video_id):
        if not VIDEO.fullmatch(video_id): return jsonify(ok=False,error='Mã video không hợp lệ.'),404
        for manifest,r in hub.receipts():
            if r.get('youtube_video_id') != video_id: continue
            path=manifest.parent/'video.mp4'
            root=(hub.source/'data/productions').resolve()
            if path.resolve().is_relative_to(root) and path.is_file():
                return send_file(path,mimetype='video/mp4',conditional=True)
        return jsonify(ok=False,error='Chưa có bản dựng cục bộ của video này.'),404

    app.register_blueprint(bp)
    return hub
