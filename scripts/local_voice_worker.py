"""Owned local VieNeu worker: no server, port, token, or external application."""
from pathlib import Path
import json
import os
import sys

ROOT=Path(__file__).resolve().parent.parent
cache=ROOT/'.runtime'/'models'/'huggingface';cache.mkdir(parents=True,exist_ok=True)
if os.name=='nt':
    import ctypes
    buffer=ctypes.create_unicode_buffer(32768)
    if ctypes.windll.kernel32.GetShortPathNameW(str(cache),buffer,len(buffer)):cache=Path(buffer.value)
    cache=Path('\\\\?\\'+str(cache))
os.environ['HF_HOME']=str(cache)
os.environ.setdefault('HF_HUB_DISABLE_TELEMETRY','1')
os.environ.setdefault('HF_HUB_DISABLE_SYMLINKS_WARNING','1')
os.environ.setdefault('TOKENIZERS_PARALLELISM','false')
os.environ.setdefault('NUMBA_CACHE_DIR',str(ROOT/'.runtime'/'numba'))

def main():
    sys.stdout.reconfigure(encoding='utf-8');sys.stderr.reconfigure(encoding='utf-8')
    if os.name=='nt':
        import onnxruntime as ort
        original_session=ort.InferenceSession
        class WindowsSession(original_session):
            def __init__(self,path,*args,**kwargs):
                if isinstance(path,(str,Path)):
                    text=str(path).removeprefix('\\\\?\\');short=ctypes.create_unicode_buffer(32768)
                    if ctypes.windll.kernel32.GetShortPathNameW(text,short,len(short)):path=short.value
                    import onnx
                    from onnx.external_data_helper import convert_model_from_external_data
                    graph=onnx.load_model(path,load_external_data=True)
                    convert_model_from_external_data(graph)
                    path=graph.SerializeToString()
                super().__init__(path,*args,**kwargs)
        ort.InferenceSession=WindowsSession
    from vieneu import Vieneu
    engine=Vieneu(mode='v3turbo',backend='onnx',device='cpu',precision='fp32',threads=4)
    voices=[{'id':voice_id,'name':label,'detail':'Tiếng Việt · chạy trên máy'} for label,voice_id in engine.list_preset_voices()]
    target=ROOT/'.runtime'/'local-voice.json'
    if '--prepare' in sys.argv:
        audio=engine.infer('Xin chào. Đây là giọng đọc trực tiếp trong tibe.',voice='Hải Đăng')
        engine.save(audio,str(ROOT/'workspace/tts/local_voice_preview.wav'))
        target.write_text(json.dumps({'ready':True,'engine':'VieNeu 3.8.3 / v3 Turbo ONNX','voices':voices},ensure_ascii=False),encoding='utf-8')
        print(json.dumps({'ok':True,'voices':len(voices)},ensure_ascii=False),flush=True)
        return
    payload=json.load(sys.stdin)
    output=Path(payload['output']).resolve()
    if output.parent!=(ROOT/'workspace'/'tts').resolve() or not output.name.startswith('local_') or output.suffix!='.wav':
        raise ValueError('Invalid local voice output.')
    if payload['voice'] not in {v['id'] for v in voices}:raise ValueError('Unknown preset voice.')
    import numpy as np
    import soundfile as sf
    import re
    # Pause tags are interpreted locally; emotion cues remain with the model.
    chunks=re.split(r'\[nghỉ\s+(\d+(?:\.\d+)?)\s*(ms|s)\]',payload['text'],flags=re.I)
    audio=[]
    for i in range(0,len(chunks),3):
        if chunks[i].strip():audio.append(engine.infer(chunks[i].strip(),voice=payload['voice']))
        if i+2<len(chunks):
            seconds=min(10,float(chunks[i+1])/(1000 if chunks[i+2].lower()=='ms' else 1))
            audio.append(np.zeros(round(seconds*48000),dtype=np.float32))
    if not audio:raise ValueError('Empty speech text.')
    sf.write(str(output),np.concatenate(audio),48000,subtype='PCM_16')
    print(json.dumps({'ok':True,'output':str(output),'voices':len(voices)},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
