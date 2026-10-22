"""Read shader signatures to identify single-input resource compatibility."""
from pathlib import Path
import re

if __name__=='__main__':
    root=Path.home()/'AppData/Local/CapCut/User Data/Cache/effect'
    seen=set();count=0
    for path in root.rglob('*.frag'):
        source=path.read_text(errors='replace')
        varying=re.findall(r'varying\s+(\w+)\s+(\w+)',source)
        uniforms=re.findall(r'uniform\s+(\w+)\s+(\w+)',source)
        samplers=[key for kind,key in uniforms if kind=='sampler2D']
        if len(varying)==1 and varying[0][0]=='vec2' and len(samplers)==1 and source not in seen:
            seen.add(source);print(path.parent.parent.name,uniforms,path)
            count+=1
            if count>=30:break
