"""Run the original pinned Concat FFmpeg audio packages in the local editor.

Package definitions: third_party/concat (AGPL-3.0-or-later).
This adapter does not execute package code or accept arbitrary filter strings.
"""
import ast
import base64
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import threading
try:
    import tomllib
except ImportError:  # Python 3.10 compatibility
    import tomli as tomllib
import uuid


def expression(text, values):
    """The numeric subset used by the pinned package templates; never eval()."""
    tree = ast.parse(re.sub(r'\bif\s*\(', 'choose(', text.strip()), mode='eval')
    def visit(node):
        if isinstance(node, ast.Expression): return visit(node.body)
        if isinstance(node, ast.Constant) and type(node.value) in (int, float): return node.value
        if isinstance(node, ast.Name) and node.id in values: return values[node.id]
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
            return (-1 if isinstance(node.op, ast.USub) else 1)*visit(node.operand)
        if isinstance(node, ast.BinOp):
            left, right = visit(node.left), visit(node.right)
            if isinstance(node.op, ast.Add): return left+right
            if isinstance(node.op, ast.Sub): return left-right
            if isinstance(node.op, ast.Mult): return left*right
            if isinstance(node.op, ast.Div): return left/right
        if isinstance(node, ast.Compare) and len(node.ops)==1 and isinstance(node.ops[0], ast.Gt):
            return visit(node.left)>visit(node.comparators[0])
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and not node.keywords:
            args=[visit(a) for a in node.args]
            if node.func.id=='pow' and len(args)==2: return math.pow(*args)
            if node.func.id=='clamp' and len(args)==3: return min(args[2], max(args[1], args[0]))
            if node.func.id=='choose' and len(args)==3: return args[1] if args[0] else args[2]
            if node.func.id=='round' and len(args)==1: return str(math.floor(args[0]+.5))
            if node.func.id=='fixed' and len(args)==2 and 0<=args[1]<=8: return f'{args[0]:.{int(args[1])}f}'
        raise ValueError('Biểu thức gói âm thanh không được hỗ trợ.')
    result=visit(tree)
    if isinstance(result, (int,float)) and not math.isfinite(result): raise ValueError('Giá trị âm thanh không hữu hạn.')
    return result


class ConcatAudio:
    def __init__(self, base):
        self.base=Path(base).resolve()
        self.output=self.base/'workspace'/'uploads'
        self.output.mkdir(parents=True, exist_ok=True)
        self.slots=threading.BoundedSemaphore(2)
        self.packages={}
        for file in (self.base/'third_party'/'concat'/'packages').glob('*/effect.toml'):
            package=tomllib.loads(file.read_text(encoding='utf-8'))
            if package['effect']['kind']=='audio' and 'ffmpeg' in package:
                self.packages[package['effect']['id']]=package

    def catalogue(self):
        return [{'id':p['effect']['id'],'name':p['effect']['name'],'category':p['effect'].get('category',''),
                 'description':p['effect'].get('description',''),'params':p.get('param',[])}
                for p in sorted(self.packages.values(),key=lambda p:(p['effect'].get('category',''),p['effect'].get('order',0)))]

    def chain(self, package_id, params=None):
        package=self.packages.get(package_id)
        if not package: raise ValueError('Không tìm thấy hiệu ứng âm thanh Concat.')
        if params is not None and not isinstance(params,dict): raise ValueError('Thông số âm thanh không hợp lệ.')
        params=params or {}; allowed={p['key'] for p in package.get('param',[])}
        if set(params)-allowed: raise ValueError('Thông số không thuộc hiệu ứng đã chọn.')
        values={}
        for param in package.get('param',[]):
            try: value=float(params.get(param['key'],param['default']))
            except (TypeError,ValueError): raise ValueError('Thông số âm thanh phải là số.')
            if not math.isfinite(value) or not param['min']<=value<=param['max']: raise ValueError('Thông số âm thanh vượt giới hạn.')
            values[param['key']]=value
        for statement in package['ffmpeg'].get('let',[]):
            name, text=statement.split('=',1);values[name.strip()]=expression(text,values)
        return re.sub(r'\{([^{}]+)\}',lambda match:str(expression(match[1],values)),package['ffmpeg']['chain'])

    def source(self,url):
        if not isinstance(url,str): raise ValueError('Thiếu tư liệu cần xử lý.')
        if re.fullmatch(r'(?:/?assets/demo|/workspace/(?:uploads|tts))/[\w.-]+',url):
            path=(self.base/url.lstrip('/')).resolve()
            roots=[(self.base/p).resolve() for p in ('assets/demo','workspace/uploads','workspace/tts')]
            if path.parent not in roots or not path.is_file() or path.is_symlink(): raise ValueError('Không tìm thấy tư liệu cục bộ.')
            return path,False
        match=re.fullmatch(r'data:(?:audio|video)/[\w.+-]+;base64,([A-Za-z0-9+/=\r\n]+)',url)
        if not match or len(match[1])>140000000: raise ValueError('Tư liệu cần là âm thanh hoặc video cục bộ, tối đa 100 MB khi đóng gói.')
        target=self.output/('input_'+uuid.uuid4().hex+'.bin')
        target.write_bytes(base64.b64decode(match[1],validate=True))
        return target,True

    def process(self,payload):
        if not shutil.which('ffmpeg') or not shutil.which('ffprobe'): raise ValueError('Cần FFmpeg và FFprobe để xử lý âm thanh.')
        if not isinstance(payload,dict): raise ValueError('Thiếu thông tin âm thanh.')
        chain=self.chain(payload.get('effect'),payload.get('params'))
        if not self.slots.acquire(blocking=False): raise ValueError('Đang xử lý hai tệp âm thanh. Hãy thử lại khi hoàn tất.')
        source=None;temporary=False;target=self.output/('concat_'+uuid.uuid4().hex+'.wav')
        try:
            source,temporary=self.source(payload.get('url'))
            probe=subprocess.run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(source)],capture_output=True,text=True,timeout=20,check=True)
            info=json.loads(probe.stdout);duration=float(info.get('format',{}).get('duration',0))
            if not any(s.get('codec_type')=='audio' for s in info.get('streams',[])): raise ValueError('Tư liệu này không có âm thanh.')
            preview=payload.get('preview') is True
            if not math.isfinite(duration) or duration<=0 or (not preview and duration>600): raise ValueError('Xử lý tối đa 10 phút cho mỗi tư liệu. Hãy cắt tư liệu dài trước.')
            start=float(payload.get('start',0)) if preview else 0
            if not math.isfinite(start) or start<0 or start>=duration: raise ValueError('Điểm nghe thử nằm ngoài tư liệu.')
            length=min(8,duration-start) if preview else duration
            command=['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-y','-ss',str(start),'-i',str(source),'-t',str(length),'-map','0:a:0','-vn','-af',chain,'-ar','48000','-ac','2','-c:a','pcm_s16le',str(target)]
            process=subprocess.run(command,capture_output=True,timeout=150)
            if process.returncode: raise ValueError('FFmpeg không xử lý được hiệu ứng này: '+process.stderr.decode('utf-8',errors='replace')[-600:])
            return {'url':'/workspace/uploads/'+target.name,'name':self.packages[payload['effect']]['effect']['name'],
                    'duration':length,'type':'audio','sampleRate':48000,'preview':preview}
        except Exception:
            target.unlink(missing_ok=True)
            raise
        finally:
            if temporary and source: source.unlink(missing_ok=True)
            self.slots.release()
