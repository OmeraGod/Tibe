"""Omera batch lifecycle, input boundaries and real FFmpeg audio regression checks."""
from pathlib import Path
import array
import json
import math
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path[:0] = [str(ROOT / '.runtime/python'), str(ROOT)]
from batch_engine import BatchManager
from omera_audio import prepare_voice
from render_engine import RenderJob


class BatchChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name).resolve()
        self.manager = BatchManager(self.directory)
        self.manager.base = ROOT
        self.manager.worker = ROOT / 'scripts/omera_render_worker.cjs'
        self.plan = {'title': 'Bài Omera', 'media': {'image': {'type': 'image', 'url': 'assets/demo/coast-hd.png'}},
            'scenes': [{'mediaId': 'image', 'duration': 4, 'caption': 'Một góc máy đẹp cho câu chuyện của bạn.'}]}

    def tearDown(self):
        self.manager.close()
        self.temp.cleanup()

    def test_five_inputs_produce_fifteen_independent_jobs(self):
        jobs = self.manager.create({'projects': [self.plan] * 5})
        self.assertEqual(len(jobs), 15)
        self.assertEqual(len({job['id'] for job in jobs}), 15)
        self.assertEqual({job['duration'] for job in jobs}, {34, 42, 68})
        self.assertTrue(all(job['state'] == 'queued' and job['fps'] == 60 and job['height'] == 1920 for job in jobs))
        self.assertEqual(len({self.manager.project(job['id'])['seed'] for job in jobs}), 15)

    def test_private_paths_remote_urls_and_unknown_media_are_rejected(self):
        for url in ['https://example.com/a.png', 'C:/Windows/win.ini', '/workspace/../app.py', 'assets/demo/../../app.py']:
            plan = json.loads(json.dumps(self.plan)); plan['media']['image']['url'] = url
            with self.assertRaises(ValueError):
                self.manager.create({'projects': [plan]})
        for payload in [{}, {'projects': []}, {'projects': [self.plan] * 21}, {'projects': [self.plan], 'variants': ['A', 'A']}, {'projects': [self.plan], 'variants': [{}]}]:
            with self.assertRaises(ValueError):
                self.manager.create(payload)
        self.assertEqual(self.manager.list(), [])

    def test_malformed_media_and_preview_values_are_user_errors(self):
        for changed in [{'previewSeconds': None}, {'previewSeconds': []}, {'media': []}]:
            with self.assertRaises(ValueError):
                self.manager.create({'projects': [self.plan], **changed})
        for changed in [{'widgets': {}}, {'mediaId': ['image']}]:
            plan = json.loads(json.dumps(self.plan))
            plan['scenes'][0].update(changed)
            with self.assertRaises(ValueError):
                self.manager.create({'projects': [plan]})
        with self.assertRaises(ValueError):
            self.manager.start([{}])

    def test_batch_http_routes_and_origin_guard(self):
        from app import app, batch_manager
        client = app.test_client()
        with client.get('/batch') as response:
            self.assertEqual(response.status_code, 200)
            self.assertIn(b'queue-panel', response.data)
        self.assertEqual(client.post('/api/batch/jobs', headers={'Origin': 'https://example.com'}, json={}).status_code, 403)
        with patch.object(batch_manager, 'create', side_effect=self.manager.create):
            self.assertEqual(client.post('/api/batch/jobs', json={'projects': [self.plan], 'previewSeconds': None}).status_code, 400)
            response = client.post('/api/batch/jobs', json={'projects': [self.plan], 'variants': ['A']})
        self.assertEqual(response.status_code, 200, response.json)
        key = response.json['jobs'][0]['id']
        with patch.object(batch_manager, 'project', side_effect=self.manager.project):
            response = client.get('/api/batch/jobs/' + key + '/spec')
        self.assertEqual(response.json['spec']['variant'], 'A')
        with patch.object(batch_manager, 'cancel', side_effect=self.manager.cancel):
            response = client.post('/api/batch/jobs/' + key + '/cancel')
        self.assertEqual(response.json['job']['state'], 'cancelled')

    def test_restart_marks_inflight_job_interrupted(self):
        job = self.manager.create({'projects': [self.plan], 'variants': ['A']})[0]
        self.manager.update(job['id'], state='rendering')
        other = BatchManager(self.directory)
        try:
            self.assertEqual(other.get(job['id'])['state'], 'interrupted')
            self.assertIsNone(other.thread)
        finally:
            other.close()
        self.manager.update(job['id'], state='cancelled')

    def test_preview_does_not_start_other_queued_jobs(self):
        jobs = self.manager.create({'projects': [self.plan], 'variants': ['A', 'B'], 'preview': True, 'previewSeconds': .5})
        seen = []
        def render(key):
            seen.append(key)
            self.manager.update(key, state='done', progress=1)
        self.manager._render = render
        self.manager.start([jobs[1]['id']])
        self.wait(lambda: self.manager.get(jobs[1]['id'])['state'] == 'done')
        self.assertEqual(seen, [jobs[1]['id']])
        self.assertEqual(self.manager.get(jobs[0]['id'])['state'], 'queued')

    def test_failure_does_not_block_next_queue_item(self):
        jobs = self.manager.create({'projects': [self.plan], 'variants': ['A', 'B']})
        def render(key):
            self.manager.update(key, state='failed' if key == jobs[0]['id'] else 'done')
        self.manager._render = render
        self.manager.start()
        self.wait(lambda: self.manager.get(jobs[1]['id'])['state'] == 'done')
        self.assertEqual(self.manager.get(jobs[0]['id'])['state'], 'failed')

    def test_cancel_active_waits_before_retry(self):
        job = self.manager.create({'projects': [self.plan], 'variants': ['A']})[0]
        release = threading.Event()
        def render(key):
            self.manager.update(key, state='rendering')
            release.wait(2)
            self.manager.update(key, state='cancelled')
        self.manager._render = render
        self.manager.start([job['id']])
        self.wait(lambda: self.manager.get(job['id'])['state'] == 'rendering')
        self.assertEqual(self.manager.cancel(job['id'])['state'], 'cancelling')
        with self.assertRaises(ValueError):
            self.manager.retry(job['id'])
        release.set()
        self.wait(lambda: self.manager.get(job['id'])['state'] == 'cancelled')

    def wait(self, predicate):
        for _ in range(200):
            if predicate(): return
            time.sleep(.01)
        self.fail('Queue did not reach expected state')

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'FFmpeg required')
    def test_real_voice_silence_trim_hook_speed_and_cached_result(self):
        source = self.directory / 'source.wav'
        samples = array.array('h')
        for i in range(120000):
            t = i / 48000
            samples.append(0 if 1 <= t < 1.5 else round(10000 * math.sin(t * 2 * math.pi * 330)))
        import wave
        with wave.open(str(source), 'wb') as output:
            output.setnchannels(1); output.setsampwidth(2); output.setframerate(48000); output.writeframes(samples.tobytes())
        target, duration, envelope = prepare_voice(self.directory, source, '', 'test', None, threading.Event())
        self.assertTrue(target.is_file())
        self.assertGreater(duration, 1.6); self.assertLess(duration, 2.2)
        self.assertTrue(any(envelope))
        cached, _, _ = prepare_voice(self.directory, source, '', 'test', None, threading.Event())
        self.assertEqual(target, cached)

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'FFmpeg required')
    def test_shared_audio_mixer_accepts_worker_video_and_generated_sfx(self):
        video = self.directory / 'video.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=teal:s=144x256:r=30', '-t', '0.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(video)], check=True)
        export = self.directory / 'exports'; export.mkdir()
        project = {'media': {'pop': {'type': 'audio', 'url': 'assets/sfx/pop_soft.wav'}},
            'clips': [{'track': 'audio', 'mediaId': 'pop', 'start': 0, 'duration': .5, 'volume': .2}], 'renderIdentity': 'a' * 32}
        job = RenderJob.from_video(export, ROOT, project, video, .5)
        try:
            output = job.finish()
            metadata = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(output)]))
            self.assertTrue(any(stream['codec_type'] == 'audio' and stream['codec_name'] == 'aac' for stream in metadata['streams']))
            self.assertEqual(metadata['format']['tags']['comment'], 'Omera render ' + 'a' * 32)
        finally:
            job.cancel()


if __name__ == '__main__': unittest.main()