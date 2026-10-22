import copy
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parent.parent
sys.path[:0]=[str(ROOT/'.runtime/python'),str(ROOT)]
from project_store import ProjectStore
from concat_audio import ConcatAudio, expression
from app import app

PROJECT={'format':'clipcut-project','version':2,'name':'Video Việt Nam','ratio':'9:16','clips':[{'id':'t1','track':'text','title':'Xin chào','start':0,'duration':3}],'media':{}}

class ProjectChecks(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.store=ProjectStore(Path(self.temp.name)/'projects')
    def tearDown(self): self.temp.cleanup()
    def test_roundtrip_and_update(self):
        first=self.store.save({'project':PROJECT});self.assertEqual(self.store.load(first['id'])['name'],PROJECT['name']);self.assertEqual(len(self.store.list()),1)
        changed={**PROJECT,'name':'Video thứ hai'};self.store.save({'project':changed},first['id']);self.assertEqual(self.store.list()[0]['name'],'Video thứ hai')
        self.assertTrue((self.store.root/first['id']/'project.clipcut').is_file());self.assertEqual(len(self.store.list()),1)
    def test_invalid_and_outside_paths(self):
        for project_id in ['../../escape','A'*32,'',None]:
            with self.assertRaises(ValueError): self.store.load(project_id)
        for edit in [{'ratio':'2:1'},{'clips':[{'track':'audio','start':0,'duration':float('nan')}]},{'clips':[{'track':'text','start':0,'duration':-1}]},{'media':{'x':{'type':'audio','url':'C:/secret.wav'}}}]:
            with self.assertRaises(ValueError): self.store.save({'project':{**PROJECT,**edit}})
        self.assertEqual(self.store.list(),[])
    def test_self_contained_media_and_missing_reference(self):
        value=copy.deepcopy(PROJECT);value['media']={'music':{'id':'music','type':'audio','url':'data:audio/wav;base64,UklGRg=='}};value['clips'].append({'track':'audio','start':0,'duration':1,'mediaId':'music'})
        result=self.store.save({'project':value});self.assertEqual(self.store.load(result['id'])['media'],value['media'])
        value['clips'][1]['mediaId']='missing'
        with self.assertRaises(ValueError): self.store.save({'project':value})
    def test_routes_and_origin(self):
        client=app.test_client()
        with patch('app.project_store',self.store):
            result=client.post('/api/projects',json={'project':PROJECT});self.assertEqual(result.status_code,200);pid=result.json['project']['id']
            self.assertEqual(client.get('/api/projects').json['projects'][0]['id'],pid)
            self.assertEqual(client.get('/api/projects/'+pid).json['project']['name'],PROJECT['name'])
            self.assertEqual(client.put('/api/projects/'+pid,json={'project':{**PROJECT,'name':'Sửa tên'}}).status_code,200)
            self.assertEqual(client.put('/api/projects/'+pid,json={'project':PROJECT},headers={'Origin':'https://outside.invalid'}).status_code,403)
            self.assertEqual(client.get('/api/projects/not-a-project').status_code,400)

class ConcatChecks(unittest.TestCase):
    def setUp(self): self.engine=ConcatAudio(ROOT)
    def test_all_package_templates_and_ranges(self):
        self.assertEqual(len(self.engine.catalogue()),25)
        for effect in self.engine.catalogue():
            for boundary in ['min','default','max']:
                params={p['key']:p[boundary] for p in effect['params']};chain=self.engine.chain(effect['id'],params);self.assertNotIn('{',chain);self.assertNotIn('nan',chain)
            with self.assertRaises(ValueError):self.engine.chain(effect['id'],{'__unknown':1})
        self.assertEqual(self.engine.chain('concat.denoise'),'afftdn=nf=-35.0:nr=21.0')
        self.assertEqual(self.engine.chain('concat.loudness'),'loudnorm=I=-23.0:TP=-1.5:LRA=11')
    def test_expression_is_not_code_execution(self):
        self.assertAlmostEqual(expression('pow(2, pitch / 12)',{'pitch':12}),2)
        self.assertEqual(expression('if(pitch > 0, pitch, 3)',{'pitch':0}),3)
        for text in ['__import__("os")','values.__class__','[1][0]','open("file")']:
            with self.assertRaises(ValueError):expression(text,{})
        for url in ['file:///C:/secret.wav','http://example.com/audio.wav','/workspace/projects/secret','/workspace/uploads/../../secret.wav']:
            with self.assertRaises(ValueError):self.engine.source(url)
    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'),'FFmpeg required')
    def test_25_real_audio_renders(self):
        with tempfile.TemporaryDirectory() as folder:
            output=Path(folder);self.engine.output=output
            source=output/'source.wav'
            subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=0.5','-ac','2',str(source)],check=True,capture_output=True)
            for effect in self.engine.catalogue():
                with self.subTest(effect=effect['id']),patch.object(self.engine,'source',return_value=(source,False)):
                    result=self.engine.process({'url':'test','effect':effect['id'],'preview':True});file=output/Path(result['url']).name
                    self.assertGreater(file.stat().st_size,1000)
                    probe=subprocess.run(['ffprobe','-v','error','-show_streams','-of','json',str(file)],capture_output=True,text=True,check=True)
                    stream=json.loads(probe.stdout)['streams'][0];self.assertEqual(stream['codec_name'],'pcm_s16le');self.assertEqual(stream['sample_rate'],'48000');self.assertEqual(stream['channels'],2)
    def test_catalogue_route(self):
        result=app.test_client().get('/api/concat/audio');self.assertEqual(result.status_code,200);self.assertEqual(len(result.json['effects']),25)
        self.assertEqual(app.test_client().post('/api/concat/audio',json={'effect':'not-real','url':'assets/demo/sunny-days.wav'}).status_code,400)

if __name__=='__main__':unittest.main()
