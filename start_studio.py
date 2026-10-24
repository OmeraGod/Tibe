"""Bootstrap the local app with project-contained dependencies when available."""
import os
from pathlib import Path
import sys
import threading
import webbrowser
import urllib.request
import json

root = Path(__file__).resolve().parent
local_packages = root / '.runtime/python'
if local_packages.is_dir():
    sys.path.insert(0, str(local_packages))
bundled_node = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
if not os.environ.get('CLIPCUT_NODE') and bundled_node.is_file():
    os.environ['CLIPCUT_NODE'] = str(bundled_node)
os.chdir(root)
from app import app, local_voice, capcut_resources, APP_INSTANCE
print('tibe: http://127.0.0.1:5050')
try:
    with urllib.request.urlopen('http://127.0.0.1:5050/api/status',timeout=2) as response:
        running=json.load(response)
    if running.get('version')=='3.6.0' and running.get('instance')==APP_INSTANCE:
        if '--no-browser' not in sys.argv:webbrowser.open('http://127.0.0.1:5050/omera')
        raise SystemExit(0)
except (OSError,ValueError):running=None
if running is not None:
    print('Dang co mot ban tibe khac chay o cong 5050. Hay dong cua so tibe cu roi mo lai MỞ TIBE.bat.',file=sys.stderr)
    raise SystemExit(1)
local_voice.prepare()
from scripts.prepare_omera import prepare as prepare_omera
threading.Thread(target=prepare_omera, args=(root,), daemon=True, name='omera-canvas-setup').start()
threading.Thread(target=capcut_resources.scan,daemon=True,name='tibe-capcut-resources').start()
if '--no-browser' not in sys.argv:
    threading.Timer(1.2,lambda:webbrowser.open('http://127.0.0.1:5050/omera')).start()
app.run(host='127.0.0.1', port=5050, debug=False, threaded=True)
