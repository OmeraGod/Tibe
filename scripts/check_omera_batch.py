"""Real local batch smoke check: video decoding, Canvas, H.264 60 fps and AAC."""
from pathlib import Path
import argparse
import json
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
sys.path[:0] = [str(ROOT / '.runtime/python'), str(ROOT)]
from batch_engine import BatchManager
from local_voice import LocalVoice


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument('--extended', action='store_true', help='Also test local per-scene narration and a full 68-second draft.')
    extended = parser.parse_args().extended
    source = ROOT / 'workspace/uploads' / ('omera_demo_' + uuid.uuid4().hex + '.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-i', str(ROOT / 'assets/demo/coast-hd.png'),
        '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=48000', '-vf', 'scale=540:960:force_original_aspect_ratio=increase,crop=540:960',
        '-t', '2', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', str(source)], check=True)
    plan = {'title': 'Omera · kiểm tra bộ dựng', 'hook': 'Một góc máy mới cho video của bạn',
        'media': {'after': {'type': 'video', 'url': '/workspace/uploads/' + source.name},
                  'before': {'type': 'image', 'url': 'assets/demo/cliff-hd.png'}},
        'scenes': [{'mediaId': 'after', 'beforeId': 'before', 'speed': .6, 'duration': 4,
            'layout': 'BENTO_SPLIT_VERTICAL', 'caption': 'Ánh sáng và chuyển động làm khung hình khác biệt.',
            'settings': '0.6× · Kiểm tra video thật', 'widgets': [{'type': 'PhoneGridHUD', 'start': .1, 'duration': 2}]}]}
    if extended:
        plan['narration'] = {'generate': True, 'voice': 'Hải Đăng'}
        plan['scenes'][0]['caption'] = 'Ánh sáng đẹp.'
        plan['scenes'][0]['analysis'] = 'Quan sát bóng đổ.'
    manager = BatchManager(ROOT, LocalVoice(ROOT))
    try:
        jobs = manager.create({'projects': [plan], 'variants': ['A', 'B'], 'profile': 'production', 'preview': True, 'previewSeconds': 1})
        if extended:
            jobs.extend(manager.create({'projects': [plan], 'variants': ['C'], 'profile': 'draft'}))
        started = time.monotonic()
        manager.start([job['id'] for job in jobs])
        deadline = time.monotonic() + 1200
        last = None
        while time.monotonic() < deadline:
            states = [manager.get(job['id']) for job in jobs]
            current = tuple(job['state'] for job in states)
            if current != last:
                print(current, flush=True); last = current
            if all(job['state'] in {'done', 'failed', 'cancelled'} for job in states):
                break
            time.sleep(.5)
        for job in states:
            assert job['state'] == 'done', job
            file = ROOT / job['outputUrl'].lstrip('/')
            probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(file)]))
            video = next(item for item in probe['streams'] if item['codec_type'] == 'video')
            assert (video['width'], video['height'], video['r_frame_rate']) == (job['width'], job['height'], str(job['fps']) + '/1')
            assert video.get('color_space') == 'bt709', video
            assert any(item['codec_type'] == 'audio' and item['codec_name'] == 'aac' for item in probe['streams'])
            assert abs(float(probe['format']['duration']) - job['duration']) < .1
            if extended:
                spec = manager.project(job['id'])
                assert len(spec['voiceTracks']) == len(spec['scenes'])
                assert any(spec['meter'])
                for scene, track in zip(spec['scenes'], spec['voiceTracks']):
                    assert track['start'] == scene['start']
                    assert scene['words'][-1]['end'] <= track['duration'] + .05
            print(job['variant'], job['outputUrl'], job['md5'], flush=True)
        assert len({job['md5'] for job in states}) == len(states)
        print('Elapsed seconds:', round(time.monotonic() - started, 1), flush=True)
        if extended: print('Per-scene VieNeu narration and full 68-second C draft passed.', flush=True)
        print('Two real 1080x1920 / 60 fps previews with AAC, slow video decoding and distinct output MD5 passed.', flush=True)
    finally:
        manager.close()


if __name__ == '__main__':
    main()