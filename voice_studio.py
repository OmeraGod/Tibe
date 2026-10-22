"""Speech jobs using embedded VieNeu, Edge TTS and legacy CIT API compatibility."""
from concurrent.futures import ThreadPoolExecutor
import http.client
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import threading
import time
import uuid

EDGE_VOICES=[{'id':'vi-VN-HoaiMyNeural','name':'Hoài My','detail':'Nữ · Tiếng Việt'},
             {'id':'vi-VN-NamMinhNeural','name':'Nam Minh','detail':'Nam · Tiếng Việt'},
             {'id':'en-US-JennyNeural','name':'Jenny','detail':'Nữ · English'}]
try:
    cached_voices=json.loads((Path(__file__).parent/'assets/voice-catalog.json').read_text(encoding='utf-8'))
    if isinstance(cached_voices,list) and all(isinstance(v,dict) and isinstance(v.get('id'),str) for v in cached_voices):EDGE_VOICES=cached_voices
except (OSError,ValueError):pass


class VoiceStudio:
    def __init__(self, workspace, edge_engine, local_engine=None):
        self.root=Path(workspace).resolve()/'tts';self.root.mkdir(parents=True,exist_ok=True)
        self.edge_engine=edge_engine
        self.local_engine=local_engine
        self.pool=ThreadPoolExecutor(max_workers=1,thread_name_prefix='tibe-voice')
        self.lock=threading.RLock();self.jobs={}

    @staticmethod
    def port(value=8001):
        if isinstance(value,bool) or not str(value).isdigit() or not 1024<=int(value)<=65535 or int(value)==5050:
            raise ValueError('Cổng CIT phải từ 1024 đến 65535, khác cổng 5050 của tibe.')
        return int(value)

    def cit_request(self,path,port=8001,payload=None,timeout=3,limit=4*1024*1024):
        # Fixed host, fixed API paths, no redirects, proxy or arbitrary file fetching.
        if path not in {'/health','/voices','/api/tts/generate'}:raise ValueError('Đường dẫn CIT không hợp lệ.')
        conn=http.client.HTTPConnection('127.0.0.1',self.port(port),timeout=timeout)
        try:
            body=json.dumps(payload,ensure_ascii=False).encode('utf-8') if payload is not None else None
            conn.request('POST' if body else 'GET',path,body=body,headers={'Content-Type':'application/json','Accept':'application/json, audio/wav, audio/mpeg'})
            response=conn.getresponse();data=response.read(limit+1)
            if len(data)>limit:raise ValueError('Phản hồi CIT vượt dung lượng hỗ trợ.')
            if response.status!=200:
                message='CIT trả lỗi '+str(response.status)
                try:message+=': '+str(json.loads(data).get('detail',''))[:300]
                except (ValueError,AttributeError):pass
                raise ValueError(message)
            return data,response.getheader('Content-Type','').lower()
        except (OSError,http.client.HTTPException) as error:
            raise ValueError('Chưa kết nối được CIT Voice Studio. Mở CIT trên máy, kiểm tra cổng server rồi bấm Kết nối lại.') from error
        finally:conn.close()

    @staticmethod
    def normalize_voices(value):
        if isinstance(value,dict):
            value=value.get('voices',value.get('data',value))
            if isinstance(value,dict):value=[{'id':key,**(item if isinstance(item,dict) else {'name':str(item)})} for key,item in value.items()]
        if not isinstance(value,list):raise ValueError('CIT trả danh sách giọng không đúng định dạng.')
        result=[];seen=set()
        for entry in value[:500]:
            if isinstance(entry,str):entry={'id':entry,'name':entry}
            if not isinstance(entry,dict):continue
            voice_id=entry.get('voice_id',entry.get('id',entry.get('name')))
            if not isinstance(voice_id,str) or not voice_id.strip() or len(voice_id)>160 or voice_id in seen:continue
            seen.add(voice_id)
            detail=' · '.join(str(entry[key])[:80] for key in ['gender','region','dialect','style'] if entry.get(key))
            result.append({'id':voice_id,'name':str(entry.get('name',voice_id))[:160],'detail':detail})
        return result

    def providers(self,port=8001,include_cit=False):
        port=self.port(port)
        info={'edge':{'available':True,'online':True,'voices':EDGE_VOICES}}
        if include_cit:info['cit']={'available':False,'online':False,'port':port,'voices':[]}
        if self.local_engine:
            self.local_engine.prepare()
            info['local']=self.local_engine.status()
        if not include_cit:return info
        try:
            raw,_=self.cit_request('/health',port)
            health=json.loads(raw)
            if not isinstance(health,dict):raise ValueError('Phản hồi sức khỏe CIT không hợp lệ.')
            raw,_=self.cit_request('/voices',port)
            voices=self.normalize_voices(json.loads(raw))
            if not voices:raise ValueError('CIT chưa có giọng đọc sẵn sàng.')
            info['cit'].update(available=True,voices=voices,message='CIT đã kết nối · xử lý trên máy')
        except (ValueError,UnicodeError) as error:info['cit']['message']=str(error)
        return info

    def validate(self,payload):
        if not isinstance(payload,dict):raise ValueError('Thiếu nội dung tạo giọng.')
        provider=payload.get('provider','edge');text=payload.get('text');voice=payload.get('voice')
        if provider not in {'cit','edge','local'}:raise ValueError('Bộ tạo giọng không hợp lệ.')
        if not isinstance(text,str) or not 1<=len(text.strip())<=5000:raise ValueError('Nhập từ 1 đến 5.000 ký tự.')
        if not isinstance(voice,str) or not 1<=len(voice)<=160:raise ValueError('Chọn một giọng đọc.')
        if provider=='edge' and voice not in {v['id'] for v in EDGE_VOICES}:raise ValueError('Giọng Edge không hợp lệ.')
        if provider=='local' and (not self.local_engine or voice not in {v['id'] for v in self.local_engine.status().get('voices',[])}):raise ValueError('Giọng đọc trên máy chưa sẵn sàng hoặc không tồn tại.')
        try:speed=float(payload.get('speed',1))
        except (TypeError,ValueError):raise ValueError('Tốc độ đọc phải là số.')
        if not math.isfinite(speed) or not .75<=speed<=1.5:raise ValueError('Tốc độ đọc từ 0,75× đến 1,50×.')
        if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):raise ValueError('Cần FFmpeg và FFprobe để chuẩn bị giọng đọc cho video.')
        return {'provider':provider,'text':text.strip(),'voice':voice,'speed':speed,'port':self.port(payload.get('port',8001))}

    def create(self,payload):
        value=self.validate(payload)
        with self.lock:
            if any(j['state'] in {'queued','running'} for j in self.jobs.values()):raise ValueError('Đang tạo một bản giọng đọc. Hãy chờ hoàn tất.')
            for key in list(self.jobs):
                if self.jobs[key]['updatedAt']<time.time()-3600:del self.jobs[key]
            job={'id':uuid.uuid4().hex,'state':'queued','message':'Đang chờ tạo giọng…','updatedAt':time.time()}
            self.jobs[job['id']]=job;self.pool.submit(self.run,job['id'],value)
            return {**job}

    def get(self,job_id):
        with self.lock:
            if not re.fullmatch('[a-f0-9]{32}',job_id) or job_id not in self.jobs:raise ValueError('Không tìm thấy lần tạo giọng.')
            return {**self.jobs[job_id]}

    def update(self,job_id,**values):
        with self.lock:self.jobs[job_id].update(**values,updatedAt=time.time())

    def run(self,job_id,value):
        target=self.root/('voice_'+job_id+'.wav');raw=None
        try:
            self.update(job_id,state='running',message='Đang tổng hợp giọng đọc…')
            if value['provider']=='local':
                raw=self.root/('local_'+job_id+'.wav')
                self.local_engine.synthesize(value['text'],value['voice'],raw)
            elif value['provider']=='cit':
                voices_raw,_=self.cit_request('/voices',value['port'])
                if value['voice'] not in {v['id'] for v in self.normalize_voices(json.loads(voices_raw))}:raise ValueError('Giọng CIT đã thay đổi. Kết nối lại để tải danh sách mới.')
                audio,content_type=self.cit_request('/api/tts/generate',value['port'],{'text':value['text'],'voice_id':value['voice']},timeout=600,limit=200*1024*1024)
                if not (audio[:4]==b'RIFF' and audio[8:12]==b'WAVE' or content_type.startswith('audio/')):raise ValueError('CIT không trả tệp âm thanh. Kiểm tra phiên bản API trong CIT /docs.')
                raw=self.root/('raw_'+job_id+'.audio');raw.write_bytes(audio)
            else:
                response=self.edge_engine.synthesize_voice(value['text'],value['voice'])
                name=Path(response['audioUrl']).name
                if not re.fullmatch(r'tts_[a-f0-9]{32}\.mp3',name):raise ValueError('Đường dẫn giọng đọc không hợp lệ.')
                raw=self.root/name
            self.update(job_id,message='Đang chuẩn bị WAV 48 kHz…')
            command=['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-y','-i',str(raw),'-vn','-af',f'atempo={value["speed"]}',
                     '-ar','48000','-ac','1','-c:a','pcm_s16le','-metadata','comment=AI-generated voice · tibe / '+value['provider'],str(target)]
            rendered=subprocess.run(command,capture_output=True,timeout=120,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            if rendered.returncode:raise ValueError('Không chuẩn bị được tệp giọng đọc. Hãy thử tạo lại.')
            probe=subprocess.run(['ffprobe','-v','error','-show_format','-of','json',str(target)],capture_output=True,text=True,check=True,timeout=20,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            duration=float(json.loads(probe.stdout)['format']['duration'])
            if not math.isfinite(duration) or not 0<duration<=21600:raise ValueError('Thời lượng giọng đọc không hợp lệ.')
            result={'audioUrl':'/workspace/tts/'+target.name,'duration':duration,'provider':value['provider'],'voice':value['voice'],'speed':value['speed'],
                    'name':value['text'][:50].replace('\n',' '),'text':value['text'],'sampleRate':48000,'createdAt':time.time()}
            metadata=self.root/('voice_'+job_id+'.json');temporary=metadata.with_suffix('.tmp')
            temporary.write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8');temporary.replace(metadata)
            self.update(job_id,state='done',message='Giọng đọc đã sẵn sàng.',result=result)
        except Exception as error:
            target.unlink(missing_ok=True);self.update(job_id,state='failed',message=(str(error) or 'Hết thời gian tạo giọng. Kiểm tra kết nối và thử lại.')[:500])
        finally:
            if raw and value['provider'] in {'cit','local'}:raw.unlink(missing_ok=True)

    def history(self):
        result=[]
        for path in self.root.glob('voice_*.json'):
            if not re.fullmatch('voice_[a-f0-9]{32}.json',path.name) or path.is_symlink():continue
            try:
                value=json.loads(path.read_text(encoding='utf-8'))
                if value.get('audioUrl')=='/workspace/tts/'+path.stem+'.wav' and path.with_suffix('.wav').is_file():result.append(value)
            except (OSError,ValueError,AttributeError):continue
        return sorted(result,key=lambda r:r.get('createdAt',0),reverse=True)[:50]
