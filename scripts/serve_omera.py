"""Run the integrated local workspace without opening a console browser popup."""
import argparse
from pathlib import Path
import sys
import json
import urllib.request

root=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(root/'.runtime/python'),str(root)]
parser=argparse.ArgumentParser()
parser.add_argument('--port',type=int,default=5051)
args=parser.parse_args()
if not 1024<=args.port<=65535: parser.error('Invalid port')
from app import app, APP_INSTANCE
try:
    with urllib.request.urlopen(f'http://127.0.0.1:{args.port}/api/status',timeout=2) as response:
        running=json.load(response)
    if running.get('instance')==APP_INSTANCE:
        print('Tibe Omera đang chạy; dùng trang vừa mở.',flush=True)
        raise SystemExit(0)
    raise SystemExit('Cổng đang được một ứng dụng khác sử dụng. Chọn --port khác.')
except (OSError,ValueError):
    pass
print(f'tibe / Omera: http://127.0.0.1:{args.port}/omera',flush=True)
app.run(host='127.0.0.1',port=args.port,threaded=True,debug=False)
