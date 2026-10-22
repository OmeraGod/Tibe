"""Package reviewed source and bundled assets, excluding runtime and user media."""
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent
FILES = [
    '.gitignore', 'omera_hub.py', 'app.py', 'rea_adapter.py', 'render_engine.py', 'project_store.py', 'concat_audio.py', 'voice_studio.py', 'local_voice.py', 'capcut_resources.py', 'start_studio.py',
    'run_studio.bat', 'MỞ TIBE.bat', 'requirements.txt', 'requirements-voice.txt', 'package.json', 'package-lock.json',
    'README_HUONG_DAN.md', 'THIRD_PARTY_NOTICES.md', 'ClipCut_Studio_Standalone.html',
]
sources = [ROOT / name for name in FILES]
for folder in ['assets', 'templates', 'scripts', 'tests', 'third_party', 'docs']:
    sources.extend(p for p in (ROOT / folder).rglob('*')
                   if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc'
                   and not p.is_relative_to(ROOT/'docs/previews'))
output = ROOT / 'dist'
output.mkdir(exist_ok=True)
target = output / 'tibe_Studio_Source.zip'
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for source in sorted(sources):
        archive.write(source, source.relative_to(ROOT).as_posix())
with zipfile.ZipFile(target, 'r') as archive:
    bad = archive.testzip()
    if bad:
        raise RuntimeError(f'Archive verification failed: {bad}')
print(f'Packaged {len(sources)} source files: {target.name} ({target.stat().st_size:,} bytes).')
