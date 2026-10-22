"""Automatically discover compatible local CapCut algorithms, never execute Lua."""
import hashlib
import json
from pathlib import Path
import threading
import time


class CapCutResources:
    def __init__(self,rea):
        self.rea=rea;self.lock=threading.RLock();self.cached=None;self.checked=0

    def scan(self):
        with self.lock:
            if self.cached is not None and time.time()-self.checked<300:return self.cached
            target=self.rea.target().resolve();cache=target.parent/'User Data/Cache/effect'
            profiles={
                'AmazingFeature_particle/xshader/noise.frag':('grain','Hạt phim CapCut',['getNoise','Intensity','Seed','9331.99']),
                'xshader/gles2_filter.frag':('direction_blur','Mờ chuyển động CapCut',['directionBlur','blurDirection','blurStep','num 7']),
                'Amazing3dlight/xshader/rouguang2.frag':('soft_blur','Mờ mềm CapCut',['half_gaussian_weight','blurSize','radius = 8'])}
            supported={'grain':'14d41a7144f9269b027f504e6fdc7cb616e3e96fafbcf101fe893f20c7545f05',
                'direction_blur':'4d2b7a6c3fb66c6383703e2c6f3eea8616662c0e77d61205a259733077f7cbde',
                'soft_blur':'00639277cb74edffe0e106a59a53368c458779fd37546cfe59f3ba15944b1747'}
            algorithms=[];seen=set()
            for suffix,(algorithm,name,markers) in profiles.items():
                for path in cache.glob('**/'+suffix) if cache.is_dir() else []:
                    if path.is_symlink() or not path.resolve().is_relative_to(cache) or path.stat().st_size>128000:continue
                    raw=path.read_bytes();source=raw.decode('utf-8',errors='replace')
                    if not all(marker in source for marker in markers):continue
                    digest=hashlib.sha256(raw).hexdigest()
                    if digest!=supported[algorithm]:continue
                    if algorithm in seen:continue
                    seen.add(algorithm);algorithms.append({'algorithm':algorithm,'name':name,'sha256':digest,'source':str(path.relative_to(cache)),
                        'implementation':'tibe canvas adaptation','kind':'local CapCut shader algorithm'})
                    break
            self.cached={'ok':True,'automatic':True,'algorithms':algorithms,'reaVersion':self.rea.status().get('version'),
                'limitations':'Chỉ các thuật toán đã nhận diện và chuyển đổi. Không thực thi engine CapCut hay Lua tùy ý.'}
            self.checked=time.time()
            report=self.rea.reports/'capcut-compatible-algorithms.json'
            report.write_text(json.dumps(self.cached,ensure_ascii=False,indent=2),encoding='utf-8')
            return self.cached
