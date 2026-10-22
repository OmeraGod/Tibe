"""Build genuine, browser-independent waveforms from bundled PCM WAV samples."""
from pathlib import Path
import array
import hashlib
import json
import math
import wave

ROOT=Path(__file__).resolve().parent.parent
result={}
for key,name in [('music1','sunny-days.wav'),('music2','ocean-breeze.wav')]:
    source=ROOT/'assets/demo'/name
    with wave.open(str(source)) as audio:
        if audio.getsampwidth()!=2:
            raise ValueError('This build helper expects 16-bit PCM.')
        samples=array.array('h',audio.readframes(audio.getnframes()))
        length=len(samples);bins=2048;envelope=[]
        for i in range(bins):
            window=samples[i*length//bins:(i+1)*length//bins]
            peak=max((abs(v)/32768 for v in window),default=0)
            rms=math.sqrt(sum((v/32768)**2 for v in window)/max(1,len(window)))
            envelope.append(.45*peak+.55*rms)
        maximum=max(envelope,default=0)
        result[key]={'duration':audio.getnframes()/audio.getframerate(),'peaks':[round(v/maximum*.95,5) if maximum else 0 for v in envelope],
                     'sha256':hashlib.sha256(source.read_bytes()).hexdigest()}
target=ROOT/'assets/js/demo-waveforms.js'
target.write_text('/* Generated from the actual bundled audio. Rebuild with scripts/build_demo_waveforms.py. */\nconst TIBE_DEMO_WAVES='+json.dumps(result,separators=(',',':'))+';\n',encoding='utf-8')
print(f'Built {len(result)} genuine waveforms.')
