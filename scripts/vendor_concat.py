"""Pin upstream effect sources, licences and checksums; no native binaries."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import urllib.request

REV = '797c8c707be5f2c798bb99e0fffad20612552510'
ROOT = Path(__file__).resolve().parent.parent/'third_party'/'concat'
BASE = f'https://raw.githubusercontent.com/jub0t/Concat/{REV}/'

def get(path):
    with urllib.request.urlopen(BASE+path, timeout=45) as response:
        return path, response.read()

def main():
    with urllib.request.urlopen(f'https://api.github.com/repos/jub0t/Concat/git/trees/{REV}?recursive=1', timeout=45) as response:
        tree = json.load(response)['tree']
    manifests = [entry['path'] for entry in tree if entry['path'].startswith('src/crates/concat-effects/packages/') and entry['path'].endswith('/effect.toml')]
    import tomllib
    docs = list(ThreadPoolExecutor(8).map(get, manifests))
    selected = [(path, data) for path, data in docs if tomllib.loads(data.decode())['effect']['kind'] in {'filter', 'audio'}]
    shader_paths = [path.replace('effect.toml', 'effect.wgsl') for path, data in selected if '[wgsl]' in data.decode()]
    helpers = [entry['path'] for entry in tree if entry['path'].endswith('.wgsl') and '/packages/' not in entry['path']]
    extra = ['LICENSE', 'src/crates/concat-server/src/discovery.rs', 'src/crates/concat-host/src/dirs.rs', 'src/crates/concat-core/src/shader.rs', 'src/crates/concat-effects/src/shader.rs']+shader_paths+helpers
    sources = selected+list(ThreadPoolExecutor(8).map(get, extra))
    checksums = {}
    for path, data in sources:
        relative = path.removeprefix('src/crates/concat-effects/')
        target = ROOT/relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        checksums[relative] = hashlib.sha256(data).hexdigest()
    (ROOT/'UPSTREAM.json').write_text(json.dumps({'repository':'https://github.com/jub0t/Concat','commit':REV,'files':checksums}, indent=2), encoding='utf-8')
    print(f'Vendored {len(sources)} source files at {REV}.')

if __name__ == '__main__':
    main()
