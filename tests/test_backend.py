import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import unittest
import zipfile
import array
import tempfile
import hashlib
from unittest.mock import patch

ROOT=Path(__file__).resolve().parent.parent
sys.path[:0]=[str(ROOT/'.runtime/python'),str(ROOT)]
from app import app, EXPORTS_DIR, UPLOADS_DIR, render_store, rea_engine
from PIL import Image


class BackendChecks(unittest.TestCase):
    def setUp(self):
        self.client=app.test_client()

    def test_page_and_assets(self):
        for path in ['/', '/assets/js/editor.js', '/assets/js/editor-core.js', '/assets/css/editor.css']:
            with self.client.get(path) as response:
                self.assertEqual(response.status_code,200)

    def test_cross_origin_mutation_and_host(self):
        self.assertEqual(self.client.post('/api/upload',headers={'Origin':'https://example.com'}).status_code,403)
        self.assertEqual(self.client.get('/',headers={'Host':'example.com'}).status_code,403)
        self.assertEqual(self.client.get('/assets/../../app.py').status_code,404)

    def test_invalid_input(self):
        self.assertEqual(self.client.post('/api/upload').status_code,400)
        self.assertEqual(self.client.post('/api/upload',data={'file':(io.BytesIO(b'bad'),'bad.exe')}).status_code,400)
        self.assertEqual(self.client.post('/api/export/convert_mp4').status_code,400)
        self.assertEqual(self.client.post('/api/tts/synthesize',json={'text':''}).status_code,400)

    def test_local_lut_only_reads_supported_files_inside_capcut_resources(self):
        with tempfile.TemporaryDirectory(dir=EXPORTS_DIR) as temporary:
            target=Path(temporary)/'Apps';version=target/'1.2.3';root=version/'Resources';root.mkdir(parents=True)
            (version/'CapCut.exe').write_bytes(b'fixture')
            cube=b'LUT_3D_SIZE 2\n'+b'0 0 0\n'*8
            (root/'grade.cube').write_bytes(cube);(root/'duplicate.cube').write_bytes(cube)
            (root/'unsupported.cube').write_bytes(b'LUT_1D_SIZE 256\n');(root/'unrelated.lua').write_text('never execute',encoding='utf-8')
            with patch.object(rea_engine,'target',return_value=target):
                response=self.client.get('/api/rea/luts')
            self.assertEqual(response.status_code,200);self.assertEqual(len(response.json['luts']),1)
            lut=response.json['luts'][0];self.assertEqual(lut['sha256'],hashlib.sha256(cube).hexdigest());self.assertEqual(lut['cube'],cube.decode())
            self.assertEqual(response.json['skipped'],1);self.assertEqual(response.json['version'],'1.2.3')
            self.assertFalse(Path(lut['source']['relativePath']).is_absolute())

    @unittest.skipUnless((ROOT/'node_modules/rea-agents/dist/artifacts/inventory/ArtifactInventory.js').is_file(),'REA required')
    def test_real_rea_material_inventory_without_running_target(self):
        with tempfile.TemporaryDirectory(dir=EXPORTS_DIR) as temporary:
            target=Path(temporary)/'Apps';version=target/'1.2.3';effect=version/'Resources/oobe/effect';effect.mkdir(parents=True)
            (version/'CapCut.exe').write_bytes(b'not an executable')
            (effect/'example.lua').write_text('error("must never run")',encoding='utf-8')
            with patch.object(rea_engine,'target',return_value=target):
                response=self.client.post('/api/rea/materials',json={})
            self.assertEqual(response.status_code,200,response.json)
            data=response.json;self.assertTrue(data['evidence']['readOnly']);self.assertEqual(data['evidence']['reaVersion'],'6.7.0')
            self.assertEqual(data['evidence']['reports'][0]['operation'],'inventory_artifact')
            self.assertTrue(data['evidence']['reports'][0]['inventory']['nodes'])
            self.assertEqual(data['lutCount'],0)
            (ROOT/data['reportUrl'].lstrip('/')).unlink()

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'),'FFmpeg required')
    def test_video_upload_and_real_mp4_with_audio(self):
        source=EXPORTS_DIR/'qa-input.webm'
        subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','testsrc2=size=320x240:rate=30',
                        '-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','2','-c:v','libvpx-vp9','-c:a','libopus',str(source)],check=True)
        response=self.client.post('/api/upload',data={'file':(io.BytesIO(source.read_bytes()),'qa.webm')})
        self.assertEqual(response.status_code,200,response.json)
        self.assertEqual(response.json['mediaType'],'video')
        media_url=response.json['url']
        result=self.client.post('/api/export/convert_mp4',data={'video':(io.BytesIO(source.read_bytes()),'qa.webm'),'fps':'30','duration':'2'})
        self.assertEqual(result.status_code,200)
        output=EXPORTS_DIR/'qa-backend.mp4';output.write_bytes(result.data);result.close()
        probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(output)]))
        self.assertEqual({s['codec_type'] for s in probe['streams']},{'audio','video'})
        self.assertEqual(next(s for s in probe['streams'] if s['codec_type']=='video')['codec_name'],'h264')
        self.assertLess(abs(float(probe['format']['duration'])-2),.04)
        self.assertLess(float(next(s for s in probe['streams'] if s['codec_type']=='audio')['start_time']),.03)
        fixture={'format':'clipcut-project','version':2,'name':'QA Video + Audio','ratio':'16:9',
                 'media':{'qa':{'id':'qa','name':'QA generated video','type':'video','url':media_url,'duration':2},
                          'qa-photo':{'id':'qa-photo','name':'Coast','type':'image','url':'assets/demo/coast.webp','duration':2}},
                 'clips':[{'id':'qa-v1','track':'video','title':'First second','mediaId':'qa','start':0,'duration':1,'sourceIn':0,'filter':'cream','volume':.6},
                          {'id':'qa-v2','track':'video','title':'Second second','mediaId':'qa','start':1,'duration':1,'sourceIn':1,'transition':'dissolve','volume':.6},
                          {'id':'qa-overlay','track':'overlay','title':'Overlay','mediaId':'qa-photo','start':0,'duration':2,'scale':.5,'xOffset':120,'yOffset':35,'mask':'circle'},
                          {'id':'qa-text','track':'text','title':'ClipCut • kiểm tra âm thanh','start':0,'duration':2,'fontSize':18,'yOffset':-60,'textStyle':'subtitle'}]}
        (EXPORTS_DIR/'qa-project.clipcut').write_text(json.dumps(fixture,ensure_ascii=False),encoding='utf-8')

    @unittest.skipUnless(shutil.which('ffmpeg'),'FFmpeg required')
    def test_silent_video_conversion(self):
        source=EXPORTS_DIR/'qa-silent.webm'
        subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','color=c=pink:s=160x120:r=24',
                        '-t','0.5','-c:v','libvpx-vp9',str(source)],check=True)
        with self.client.post('/api/export/convert_mp4',data={'video':(io.BytesIO(source.read_bytes()),'qa.webm'),'fps':'24','duration':'.5'}) as response:
            self.assertEqual(response.status_code,200,response.json if response.is_json else '')

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'),'FFmpeg required')
    def test_deterministic_frame_export_and_audio_mix(self):
        source=UPLOADS_DIR/'qa-tone.wav'
        subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','sine=frequency=550:sample_rate=48000','-t','1',str(source)],check=True)
        project={'media':{'sound':{'type':'audio','url':'/workspace/uploads/qa-tone.wav'}},
                 'clips':[{'mediaId':'sound','track':'audio','duration':.5,'speed':2,'volume':.6,'fadeOut':.1}]}
        started=self.client.post('/api/render/start',json={'project':project,'width':320,'height':240,'fps':24,'duration':.5})
        self.assertEqual(started.status_code,200,started.json)
        job=started.json['jobId']
        self.assertEqual(started.json['frames'],12)
        frames=[]
        for i in range(12):
            data=io.BytesIO();Image.new('RGB',(320,240),(255,120+i*8,120)).save(data,format='JPEG');data.seek(0);frames.append((data,'frame.jpg'))
        response=self.client.post(f'/api/render/{job}/frames',data={'start':'0','frames':frames})
        self.assertEqual(response.status_code,200,response.json)
        with self.client.post(f'/api/render/{job}/finish') as finished:
            self.assertEqual(finished.status_code,200,finished.json if finished.is_json else '')
            result=EXPORTS_DIR/'qa-deterministic.mp4';result.write_bytes(finished.data)
        probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(result)]))
        video=next(s for s in probe['streams'] if s['codec_type']=='video')
        self.assertEqual(video['nb_frames'],'12')
        self.assertEqual(video['r_frame_rate'],'24/1')
        self.assertIn('audio',[s['codec_type'] for s in probe['streams']])
        self.assertLess(abs(float(probe['format']['duration'])-.5),.04)
        self.assertNotIn(job,render_store.jobs)

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'),'FFmpeg required')
    def test_frame_export_rejects_bad_sequence_and_cancels(self):
        response=self.client.post('/api/render/start',json={'project':{'clips':[],'media':{}},'width':320,'height':240,'fps':30,'duration':1})
        self.assertEqual(response.status_code,200,response.json)
        job=response.json['jobId'];folder=render_store.get(job).folder
        self.assertEqual(self.client.post(f'/api/render/{job}/frames',data={'start':'1'}).status_code,400)
        self.assertEqual(self.client.post(f'/api/render/{job}/finish').status_code,400)
        self.assertNotIn(job,render_store.jobs)
        self.assertFalse(folder.exists())
        self.assertEqual(self.client.post(f'/api/render/{job}/cancel').status_code,200)

    def test_frame_export_rejects_external_media(self):
        response=self.client.post('/api/render/start',json={'project':{'clips':[{'track':'audio','mediaId':'x'}],'media':{'x':{'type':'audio','url':'https://example.com/x.mp3'}}},'width':320,'height':240,'fps':30,'duration':1})
        self.assertEqual(response.status_code,400,response.json)


class UpgradeChecks(unittest.TestCase):
    def setUp(self):
        self.client=app.test_client()

    def test_capcut_draft_package_registration_and_text(self):
        project={'format':'clipcut-project','name':'Draft QA','ratio':'9:16','media':{'photo':{'name':'Coast','type':'image','url':'assets/demo/coast.webp','duration':4}},
                 'clips':[{'id':'p','track':'video','mediaId':'photo','duration':2,'start':0,'speed':2,'sourceIn':1,'xOffset':20,'keyframes':[{'time':0,'scale':1},{'time':1,'scale':1.2}]},
                          {'id':'t','track':'text','title':'Xin chào 🌸','duration':2,'start':0,'textStyle':'karaoke'}]}
        with self.client.post('/api/export/capcut_draft',json={'project':project}) as result:
            self.assertEqual(result.status_code,200,result.json if result.is_json else '')
            with zipfile.ZipFile(io.BytesIO(result.data)) as bundle:
                prefix=bundle.namelist()[0].split('/')[0]+'/'
                draft=json.loads(bundle.read(prefix+'draft_content.json'))
                meta=json.loads(bundle.read(prefix+'draft_meta_info.json'))
                report=json.loads(bundle.read(prefix+'compatibility.json'))
                self.assertFalse(report['nativeOpenVerified'])
                self.assertTrue(report['warnings'])
                self.assertEqual(draft['duration'],2000000)
                material=draft['materials']['videos'][0]
                self.assertEqual(material['local_material_id'],meta['draft_materials'][0]['value'][0]['id'])
                self.assertTrue(Path(material['path']).exists())
                self.assertIn(prefix+'assets/'+Path(material['path']).name,bundle.namelist())
                segment=draft['tracks'][0]['segments'][0]
                self.assertEqual(segment['source_timerange'],{'start':1000000,'duration':4000000})
                self.assertTrue(segment['common_keyframes'])
                content=json.loads(draft['materials']['texts'][0]['content'])
                self.assertEqual(content['text'],'Xin chào 🌸')
                self.assertEqual(content['styles'][0]['range'],[0,11])

    def test_capcut_draft_rejects_external_and_invalid_projects(self):
        for payload in [{},{'project':{'format':'clipcut-project','clips':[],'media':{}}},{'project':{'format':'clipcut-project','clips':[None],'media':{}}},
                        {'project':{'format':'clipcut-project','clips':[{'track':'video','mediaId':'x'}],'media':{'x':{'type':'video','url':'https://example.com/private.mp4'}}}}]:
            response=self.client.post('/api/export/capcut_draft',json=payload)
            self.assertEqual(response.status_code,400,response.json)

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'),'FFmpeg required')
    def test_voice_effect_curve_and_ducking_real_audio(self):
        tone=UPLOADS_DIR/'qa-v4-tone.wav'
        subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','sine=frequency=550:sample_rate=48000','-t','3',str(tone)],check=True)
        def render(effect='none',curve='none',duck=False):
            media={'tone':{'type':'audio','url':'/workspace/uploads/qa-v4-tone.wav'}}
            clips=[{'id':'bed','mediaId':'tone','track':'audio','duration':.5,'volume':.6,'voiceEffect':effect,'speedCurve':curve,'curveSpan':.5,'ducking':duck}]
            if duck:clips.append({'id':'voice','mediaId':'tone','track':'audio','start':0,'duration':.5,'audioRole':'voice','volume':.00001})
            start=self.client.post('/api/render/start',json={'project':{'media':media,'clips':clips},'width':160,'height':160,'fps':24,'duration':.5})
            self.assertEqual(start.status_code,200,start.json);job=start.json['jobId']
            frames=[]
            for _ in range(12):
                data=io.BytesIO();Image.new('RGB',(160,160),'pink').save(data,format='JPEG');data.seek(0);frames.append((data,'frame.jpg'))
            self.assertEqual(self.client.post(f'/api/render/{job}/frames',data={'start':'0','frames':frames}).status_code,200)
            with self.client.post(f'/api/render/{job}/finish') as response:
                self.assertEqual(response.status_code,200,response.json if response.is_json else '')
                path=EXPORTS_DIR/f'qa-v4-{effect}-{curve}-{duck}.mp4';path.write_bytes(response.data)
            probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json',str(path)]))
            self.assertLess(abs(float(probe['format']['duration'])-.5),.04)
            samples=array.array('f');samples.frombytes(subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-vn','-f','f32le','-ac','1','-ar','48000','pipe:1']))
            self.assertGreater(len(samples),20000)
            return sum(v*v for v in samples)/len(samples)
        baseline=render()
        self.assertGreater(baseline,.0001)
        self.assertLess(render(duck=True),baseline*.15)
        for effect in ['deep','high','echo','radio']:
            self.assertGreater(render(effect=effect),.00001,effect)
        for curve in ['montage','hero','bullet','jump_cut']:
            self.assertGreater(render(curve=curve),.00001,curve)


if __name__=='__main__': unittest.main(verbosity=2)
