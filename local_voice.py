"""Embedded voice models managed by tibe. No CIT app or external API required."""
import json
import os
from pathlib import Path
import subprocess
import threading
import sys
import time


class LocalVoice:
    def __init__(self,base):
        self.base=Path(base).resolve();self.runtime=self.base/'.runtime'
        self.python=self.runtime/'voice-env'/'Scripts'/'python.exe' if os.name=='nt' else self.runtime/'voice-env'/'bin'/'python'
        self.metadata=self.runtime/'local-voice.json';self.lock=threading.Lock()
        self.preparing=False;self.error='';self.thread=None;self.last_attempt=0

    def status(self):
        if self.python.is_file() and self.metadata.is_file():
            try:
                info=json.loads(self.metadata.read_text(encoding='utf-8'))
                if isinstance(info,dict) and info.get('ready') and isinstance(info.get('voices'),list) and info['voices'] and all(isinstance(v,dict) and isinstance(v.get('id'),str) and v['id'].strip() for v in info['voices']):return {**info,'available':True,'online':False,'embedded':True}
            except (OSError,ValueError):pass
        return {'available':False,'online':False,'embedded':True,'voices':[],
                'preparing':self.preparing,'message':self.error or 'tibe đang chuẩn bị giọng đọc trên máy…'}

    def env(self,offline=False):
        env=os.environ.copy();env.update(PYTHONIOENCODING='utf-8',HF_HOME=str(self.runtime/'models'/'huggingface'),
            HF_HUB_DISABLE_TELEMETRY='1',HF_HUB_DISABLE_SYMLINKS_WARNING='1',TOKENIZERS_PARALLELISM='false',NUMBA_CACHE_DIR=str(self.runtime/'numba'))
        if offline:env.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1')
        return env

    def prepare(self):
        with self.lock:
            if self.preparing or self.status().get('available') or time.time()-self.last_attempt<60:return
            self.preparing=True;self.error='';self.last_attempt=time.time()
            self.thread=threading.Thread(target=self._prepare,daemon=True,name='tibe-voice-prepare');self.thread.start()

    def _prepare(self):
        try:
            self.runtime.mkdir(exist_ok=True)
            with (self.runtime/'voice-prepare.log').open('w',encoding='utf-8') as log:
                installed=subprocess.run([sys.executable,str(self.base/'scripts/prepare_runtime.py')],cwd=self.base,env=self.env(),stdout=log,stderr=subprocess.STDOUT,timeout=1200,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
                if installed.returncode:raise ValueError('Chưa tải được bộ giọng đọc. Kiểm tra Internet cho lần chuẩn bị đầu tiên.')
                process=subprocess.run([str(self.python),str(self.base/'scripts/local_voice_worker.py'),'--prepare'],cwd=self.base,
                    env=self.env(),stdout=log,stderr=subprocess.STDOUT,timeout=1800,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            if process.returncode or not self.metadata.is_file():raise ValueError('Chưa chuẩn bị được mô hình giọng. Kiểm tra kết nối Internet ở lần tải đầu; tibe sẽ lưu để dùng ngoại tuyến.')
        except Exception as error:self.error=str(error)
        finally:self.preparing=False

    def synthesize(self,text,voice,path,cancel_event=None):
        if not self.status().get('available'):raise ValueError('Giọng đọc trên máy chưa chuẩn bị xong. Hãy chờ thanh trạng thái hoàn tất.')
        command=[str(self.python),str(self.base/'scripts/local_voice_worker.py')]
        payload=json.dumps({'text':text,'voice':voice,'output':str(path)},ensure_ascii=False)
        options=dict(cwd=self.base,env=self.env(offline=True),text=True,encoding='utf-8',errors='replace',creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        if cancel_event is None:
            process=subprocess.run(command,input=payload,capture_output=True,timeout=900,**options)
        else:
            worker=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,**options)
            deadline=time.monotonic()+900
            pending=payload
            while True:
                if cancel_event.is_set() or time.monotonic()>deadline:
                    worker.kill();worker.communicate()
                    raise ValueError('Đã hủy hoặc hết thời gian tạo giọng.')
                try:
                    output,error=worker.communicate(input=pending,timeout=.5)
                    process=subprocess.CompletedProcess(command,worker.returncode,output,error)
                    break
                except subprocess.TimeoutExpired:
                    pending=None
        if process.returncode or not Path(path).is_file():raise ValueError('Bộ giọng đọc trên máy gặp lỗi: '+(process.stderr or process.stdout)[-500:])
