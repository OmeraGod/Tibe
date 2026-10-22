"""Static editor only. Never package channel evidence, models or user projects."""
from pathlib import Path
import shutil

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'site-dist'


def build():
    OUT.mkdir(exist_ok=True)
    for p in (ROOT/'assets').rglob('*'):
        if p.is_file() and p.suffix.lower() in {'.js','.css','.json','.svg','.png','.webp','.jpg','.jpeg','.wav','.mp3','.woff','.woff2'}:
            dest=OUT/p.relative_to(ROOT);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
    shutil.copy2(ROOT/'templates/index.html',OUT/'index.html')
    shutil.copy2(ROOT/'templates/omera.html',OUT/'omera.html')
    shutil.copy2(ROOT/'THIRD_PARTY_NOTICES.md',OUT/'THIRD_PARTY_NOTICES.md')
    (OUT/'.nojekyll').write_text('',encoding='utf-8')
    for p in OUT.rglob('*'):
        assert not any(n in {'workspace','.runtime','data','.streamlit','.git','node_modules'} for n in p.relative_to(OUT).parts)
    print('Static editor ready in site-dist; channel data are not included.')


if __name__=='__main__':build()
