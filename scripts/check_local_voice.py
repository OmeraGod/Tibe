"""Offline smoke check of the embedded model through the app's actual job path."""
from pathlib import Path
import sys
import time
ROOT=Path(__file__).resolve().parent.parent
sys.path[:0]=[str(ROOT/'.runtime/python'),str(ROOT)]
from app import voice_studio

if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    job=voice_studio.create({'provider':'local','voice':'Hải Đăng','text':'Xin chào. Hôm nay là thứ năm, một ngày mới lại bắt đầu.','speed':1})
    print('Generating with embedded model; network disabled in worker.',flush=True)
    while True:
        job=voice_studio.get(job['id'])
        if job['state'] in {'done','failed'}:break
        time.sleep(.5)
    print(job['state'],job['message'],flush=True)
    if job.get('result'):print(job['result']['audioUrl'],job['result']['duration'],flush=True)
