"""Run the integrated local workspace without opening a console browser popup."""
import argparse
from pathlib import Path
import sys

root=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(root/'.runtime/python'),str(root)]
parser=argparse.ArgumentParser()
parser.add_argument('--port',type=int,default=5051)
args=parser.parse_args()
if not 1024<=args.port<=65535: parser.error('Invalid port')
from app import app
print(f'tibe / Omera: http://127.0.0.1:{args.port}/omera',flush=True)
app.run(host='127.0.0.1',port=args.port,threaded=True,debug=False)
