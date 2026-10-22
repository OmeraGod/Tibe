"""Optional real-provider smoke check; creates a short local voice result."""
from pathlib import Path
import sys
import time
ROOT=Path(__file__).resolve().parent.parent
sys.path[:0]=[str(ROOT/'.runtime/python'),str(ROOT)]
from app import voice_studio

if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    job=voice_studio.create({'provider':'edge','voice':'vi-VN-HoaiMyNeural','text':'Xin chào, đây là giọng đọc thử của tibe.','speed':1})
    print('Voice job started.',flush=True)
    while True:
        state=voice_studio.get(job['id'])
        if state['state'] in {'done','failed'}:break
        time.sleep(.5)
    print(state['state'],state['message'],flush=True)
    if state.get('result'):
        print(state['result']['audioUrl'],state['result']['duration'],flush=True)
