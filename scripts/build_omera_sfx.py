"""Create original, deterministic Omera edit sounds; no downloaded commercial assets."""
from pathlib import Path
import array
import json
import math
import random
import wave

ROOT = Path(__file__).resolve().parent.parent
RATE = 48000


def build():
    folder = ROOT / 'assets/sfx'
    folder.mkdir(exist_ok=True)
    for name, length in [('whoosh_bass_hit', .65), ('pop_soft', .22), ('camera_shutter', .25), ('swish_transition', .5), ('bell_ding', .65)]:
        rng = random.Random(name)
        samples = array.array('h')
        for index in range(round(RATE * length)):
            t = index / RATE
            noise = rng.uniform(-1, 1)
            if name == 'whoosh_bass_hit':
                value = .65 * math.sin(2 * math.pi * (70 * t - 30 * t * t)) * math.exp(-t * 9) + .3 * noise * math.sin(math.pi * t / length) ** 2
            elif name == 'pop_soft':
                value = .65 * math.sin(2 * math.pi * (900 * t - 900 * t * t)) * math.exp(-t * 30)
            elif name == 'camera_shutter':
                value = noise * (.6 * math.exp(-t * 70) + .45 * math.exp(-abs(t - .08) * 95))
            elif name == 'swish_transition':
                value = .5 * noise * math.sin(math.pi * t / length) ** 3
            else:
                value = (.45 * math.sin(2 * math.pi * 1320 * t) + .2 * math.sin(2 * math.pi * 1980 * t)) * math.exp(-t * 7)
            envelope = min(1, t / .004) * min(1, max(0, length - t) / .015)
            samples.append(round(max(-1, min(1, value * envelope)) * 32767))
        with wave.open(str(folder / (name + '.wav')), 'wb') as output:
            output.setnchannels(1); output.setsampwidth(2); output.setframerate(RATE); output.writeframes(samples.tobytes())
    (folder / 'SOURCES.json').write_text(json.dumps({'source': 'Original procedural synthesis in scripts/build_omera_sfx.py', 'sampleRate': RATE, 'notes': 'No CapCut or commercial sound library recordings.'}, indent=2), encoding='utf-8')


if __name__ == '__main__':
    build()
    print('Built five original 48 kHz edit sounds.')