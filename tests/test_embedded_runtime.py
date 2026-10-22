"""Regression checks for direct local speech and startup without external apps."""
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
import wave
from unittest.mock import patch

ROOT=Path(__file__).resolve().parent.parent
sys.path[:0]=[str(ROOT/'.runtime/python'),str(ROOT)]
from app import app, APP_INSTANCE
from local_voice import LocalVoice
from voice_studio import VoiceStudio
from capcut_resources import CapCutResources


def sample():
    data=io.BytesIO()
    with wave.open(data,'wb') as wav:
        wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(48000);wav.writeframes(b'\0\0'*48000)
    return data.getvalue()


class EmbeddedVoice:
    def __init__(self):self.calls=[];self.fail=False
    def prepare(self):pass
    def status(self):return {'available':True,'online':False,'voices':[{'id':'Giọng Việt','name':'Giọng Việt'}]}
    def synthesize(self,text,voice,path):
        self.calls.append((text,voice))
        if self.fail:raise ValueError('local model unavailable')
        Path(path).write_bytes(sample())


class EmbeddedRuntimeChecks(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name).resolve()
    def tearDown(self):self.temp.cleanup()

    def test_default_voice_discovery_never_calls_cit_or_cli(self):
        engine=EmbeddedVoice();studio=VoiceStudio(self.root,None,engine)
        try:
            with patch.object(studio,'cit_request',side_effect=AssertionError('external CIT request')):
                with patch('app.voice_studio',studio),patch('rea_adapter.subprocess.run',side_effect=AssertionError('status launched CLI')):
                    client=app.test_client();result=client.get('/api/tts/providers')
                    self.assertEqual(result.status_code,200)
                    self.assertTrue(result.json['providers']['local']['available'])
                    self.assertNotIn('cit',result.json['providers'])
                    status=client.get('/api/status')
                    self.assertEqual(status.status_code,200)
                    self.assertEqual(status.json['instance'],APP_INSTANCE)
        finally:studio.pool.shutdown()

    def test_ide_preview_bridge_is_explicit_and_rejects_other_origins(self):
        engine=EmbeddedVoice();studio=VoiceStudio(self.root,None,engine)
        try:
            with patch('app.voice_studio',studio):
                client=app.test_client();origin='http://localhost:63343'
                response=client.get('/api/tts/providers',headers={'Origin':origin})
                self.assertEqual(response.headers['Access-Control-Allow-Origin'],origin)
                response=client.options('/api/tts/jobs',headers={'Origin':origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-tibe-client'})
                self.assertEqual(response.status_code,200);self.assertIn('X-Tibe-Client',response.headers['Access-Control-Allow-Headers'])
                for headers in [{'Origin':origin},{'Origin':'https://example.com','X-Tibe-Client':'studio'},{'Origin':'http://localhost:8080','X-Tibe-Client':'studio'}]:
                    self.assertEqual(client.post('/api/tts/jobs',json={},headers=headers).status_code,403)
                with patch.object(studio,'create',return_value={'id':'test-job','state':'queued'}):
                    response=client.post('/api/tts/jobs',json={},headers={'Origin':origin,'X-Tibe-Client':'studio','Sec-Fetch-Site':'cross-site'})
                    self.assertEqual(response.status_code,200);self.assertEqual(response.json['job']['id'],'test-job')
                response=client.get('/api/status',headers={'Origin':'https://example.com'})
                self.assertNotIn('Access-Control-Allow-Origin',response.headers)
        finally:studio.pool.shutdown()

    def test_offline_worker_uses_current_project_after_move(self):
        engine=LocalVoice(self.root);engine.python.parent.mkdir(parents=True);engine.python.touch()
        engine.metadata.write_text(json.dumps({'ready':True,'voices':[{'id':'Giọng Việt'}]}),encoding='utf-8')
        output=self.root/'sample.wav'
        def run(command,**options):
            self.assertEqual(Path(command[1]),self.root/'scripts/local_voice_worker.py')
            self.assertEqual(options['cwd'],self.root)
            self.assertEqual(options['env']['HF_HUB_OFFLINE'],'1')
            self.assertEqual(options['env']['TRANSFORMERS_OFFLINE'],'1')
            self.assertEqual(Path(options['env']['HF_HOME']),self.root/'.runtime/models/huggingface')
            self.assertEqual(json.loads(options['input'])['voice'],'Giọng Việt')
            output.write_bytes(sample())
            return subprocess.CompletedProcess(command,0,'','')
        with patch('local_voice.subprocess.run',side_effect=run):engine.synthesize('Xin chào','Giọng Việt',output)
        self.assertTrue(output.is_file())

    def test_corrupt_or_empty_voice_metadata_is_not_advertised_ready(self):
        engine=LocalVoice(self.root);engine.python.parent.mkdir(parents=True);engine.python.touch()
        for value in ['not json','[]','{"ready":true,"voices":[]}','{"ready":true,"voices":[{}]}']:
            engine.metadata.write_text(value,encoding='utf-8')
            self.assertFalse(engine.status()['available'])

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'),'FFmpeg required')
    def test_local_job_outputs_real_wav_and_persists_without_external_provider(self):
        engine=EmbeddedVoice();studio=VoiceStudio(self.root,None,engine)
        try:
            with patch.object(studio,'cit_request',side_effect=AssertionError('external CIT request')):
                job=studio.create({'provider':'local','voice':'Giọng Việt','text':'Xin chào Việt Nam','speed':1.25})
                state=self.wait(studio,job)
            self.assertEqual(state['state'],'done',state)
            value=state['result'];self.assertEqual(value['provider'],'local');self.assertAlmostEqual(value['duration'],.8,delta=.05)
            with wave.open(str(studio.root/Path(value['audioUrl']).name),'rb') as wav:
                self.assertEqual(wav.getframerate(),48000);self.assertEqual(wav.getnchannels(),1)
            self.assertEqual(engine.calls,[('Xin chào Việt Nam','Giọng Việt')]);self.assertEqual(len(studio.history()),1)
            other=VoiceStudio(self.root,None,engine)
            try:self.assertEqual(other.history()[0],value)
            finally:other.pool.shutdown()
            self.assertEqual(list(studio.root.glob('local_*.wav')),[])
        finally:studio.pool.shutdown()

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'),'FFmpeg required')
    def test_local_failure_does_not_substitute_edge_or_cit(self):
        engine=EmbeddedVoice();engine.fail=True;studio=VoiceStudio(self.root,None,engine)
        try:
            job=studio.create({'provider':'local','voice':'Giọng Việt','text':'Xin chào'})
            state=self.wait(studio,job);self.assertEqual(state['state'],'failed');self.assertIn('local model',state['message']);self.assertEqual(studio.history(),[])
        finally:studio.pool.shutdown()

    def wait(self,studio,job):
        for _ in range(300):
            value=studio.get(job['id'])
            if value['state'] in {'done','failed'}:return value
            time.sleep(.02)
        self.fail('Local voice job timed out')

    def test_unrecognised_shader_is_not_imported_or_executed(self):
        class Resources:
            reports=self.root/'reports'
            def target(inner):return self.root/'CapCut/Apps'
            def status(inner):return {'version':'6.7.0'}
        rea=Resources();rea.reports.mkdir();cache=self.root/'CapCut/User Data/Cache/effect/pack/AmazingFeature_particle/xshader'
        cache.mkdir(parents=True);(cache/'noise.frag').write_text('getNoise Intensity Seed 9331.99 unrecognised code',encoding='utf-8')
        result=CapCutResources(rea).scan();self.assertEqual(result['algorithms'],[])
        self.assertTrue((rea.reports/'capcut-compatible-algorithms.json').is_file())


if __name__=='__main__':unittest.main()
