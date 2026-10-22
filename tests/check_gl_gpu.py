"""Compile and render exact app shaders on native OpenGL, without a browser.
Run scripts/export_gl_checks.cjs first. Optional QA-only dependency: moderngl.
"""
from pathlib import Path
import json,hashlib,re,sys
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'.runtime/qa-gl'))
import moderngl
ctx=moderngl.create_standalone_context(require=330)
data=json.loads((ROOT/'.runtime/gl-shader-check.json').read_text(encoding='utf-8'))
def desktop(source):return re.sub(r'precision (?:highp|mediump|lowp) (?:float|int);','',source.replace('#version 300 es','#version 330'))
size=(160,100);w,h=size
source=bytes(value for y in range(h) for x in range(w) for value in (x*255//w,y*255//h,80+((x//10+y//10)%2)*140,255))
target=bytes(value for y in range(h) for x in range(w) for value in (70+(y//8%2)*90,220-x*120//w,x*255//w,255))
a=ctx.texture(size,4,source);b=ctx.texture(size,4,target)
for texture in [a,b]:texture.filter=(moderngl.LINEAR,moderngl.LINEAR);texture.repeat_x=False;texture.repeat_y=False
a.use(0);b.use(1);frame=ctx.simple_framebuffer(size,components=4);frame.use()
import struct
quad=ctx.buffer(struct.pack('8f',-1,-1,1,-1,-1,1,1,1));report=[];failures=[]
for entry in data['shaders']:
    try:
        program=ctx.program(vertex_shader=desktop(data['vertex']),fragment_shader=desktop(entry['fragment']))
        if 'tibe_from' in program:program['tibe_from'].value=0
        if 'tibe_to' in program:program['tibe_to'].value=1
        if 'ratio' in program:program['ratio'].value=w/h
        for name,value in entry['defaultParams'].items():
            if name in program:program[name].value=tuple(value) if isinstance(value,list) else value
        vao=ctx.vertex_array(program,[(quad,'2f','a_position')]);hashes=[]
        for progress in [.17,.53,.82,.17]:
            program['progress'].value=progress;vao.render(moderngl.TRIANGLE_STRIP);pixels=frame.read(components=4)
            assert any(pixels[3::4]),'fully transparent output'
            hashes.append(hashlib.sha256(pixels).hexdigest())
        assert hashes[0]==hashes[3],'non-deterministic output'
        assert len(set(hashes))>=2,'does not animate'
        report.append({'name':entry['name'],'compiled':True,'animated':True,'deterministic':True})
        vao.release();program.release()
    except Exception as error:failures.append({'name':entry['name'],'error':str(error)})
result={'renderer':ctx.info['GL_RENDERER'],'api':ctx.info['GL_VERSION'],'passed':len(report),'failures':failures,'transitions':report,'scope':'Native GL 3.3 compile/render of app GLSL; browser WebGL2 interaction not tested.'}
output=ROOT/'workspace/rea/gl-transitions-gpu-check.json';output.write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='transitions'},indent=2))
if failures:raise SystemExit(1)
