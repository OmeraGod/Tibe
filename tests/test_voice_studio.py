import io
import json
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import time
import unittest
import uuid
import wave
from unittest.mock import patch

ROOT=Path(__file__).resolve().parent.parent
sys.path[:0]=[str(ROOT/'.runtime/python'),str(ROOT)]
from voice_studio import VoiceStudio
from app import app

def audio_bytes():
    output=io.BytesIO()
    with wave.open(output,'wb') as wav:
        wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(48000);wav.writeframes(b'\0\0'*48000)
    return output.getvalue()

class Edge:
    def __init__(self,root):self.root=root;self.calls=[]
    def synthesize_voice(self,text,voice):
        self.calls.append((text,voice));path=self.root/('tts_'+uuid.uuid4().hex+'.mp3');path.write_bytes(audio_bytes());return {'audioUrl':'/workspace/tts/'+path.name}

class CitHandler(BaseHTTPRequestHandler):
    calls=[];fail=False
    def log_message(self,*args):pass
    def do_GET(self):
        value={'status':'ok'} if self.path=='/health' else {'voices':[{'voice_id':'Minh Đức','name':'Minh Đức','gender':'Nam','region':'Bắc','style':'Tin tức'},'Giọng khác']}
        self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(value).encode())
    def do_POST(self):
        body=json.loads(self.rfile.read(int(self.headers['Content-Length'])));self.calls.append((self.path,body));self.send_response(200);self.send_header('Content-Type','application/json' if self.fail else 'audio/wav');self.end_headers();self.wfile.write(b'{"error":"model missing"}' if self.fail else audio_bytes())

@unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'),'FFmpeg required')
class VoiceChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),CitHandler);cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.thread.join()
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.edge=Edge(Path(self.temp.name)/'tts');self.studio=VoiceStudio(self.temp.name,self.edge);CitHandler.calls=[];CitHandler.fail=False
    def tearDown(self):self.studio.pool.shutdown(wait=True);self.temp.cleanup()
    def wait(self,job):
        for _ in range(300):
            state=self.studio.get(job['id'])
            if state['state'] in {'done','failed'}:return state
            time.sleep(.02)
        self.fail('Voice job did not finish')
    def test_cit_discovery_true_names(self):
        data=self.studio.providers(self.server.server_port,include_cit=True);self.assertTrue(data['cit']['available']);self.assertEqual(data['cit']['voices'][0]['id'],'Minh Đức');self.assertEqual(len(data['cit']['voices']),2)
    def test_cit_audio_job_speed_history(self):
        state=self.wait(self.studio.create({'provider':'cit','text':'Xin chào Việt Nam. [nghỉ 1s]','voice':'Minh Đức','speed':1.25,'port':self.server.server_port}));self.assertEqual(state['state'],'done',state)
        value=state['result'];self.assertTrue(value['audioUrl'].endswith('.wav'));self.assertAlmostEqual(value['duration'],.8,delta=.05);self.assertEqual(value['sampleRate'],48000);self.assertEqual(self.edge.calls,[])
        self.assertEqual(CitHandler.calls[0],('/api/tts/generate',{'text':'Xin chào Việt Nam. [nghỉ 1s]','voice_id':'Minh Đức'}));self.assertEqual(self.studio.history()[0],value)
        other=VoiceStudio(self.temp.name,self.edge)
        try:self.assertEqual(other.history()[0],value)
        finally:other.pool.shutdown()
    def test_edge_retained_and_prepared(self):
        state=self.wait(self.studio.create({'provider':'edge','text':'Giọng đọc thử','voice':'vi-VN-HoaiMyNeural','speed':1}));self.assertEqual(state['state'],'done',state);self.assertEqual(len(self.edge.calls),1);self.assertEqual(state['result']['provider'],'edge')
    def test_cit_error_does_not_silently_use_edge(self):
        CitHandler.fail=True;state=self.wait(self.studio.create({'provider':'cit','text':'Đọc thử','voice':'Minh Đức','port':self.server.server_port}));self.assertEqual(state['state'],'failed');self.assertEqual(self.edge.calls,[]);self.assertEqual(self.studio.history(),[])
    def test_validation_and_routes(self):
        for value in [{'text':''},{'provider':'unknown'},{'speed':float('nan')},{'speed':3},{'voice':'not-edge'},{'port':'http://evil.invalid'}]:
            with self.assertRaises(ValueError):self.studio.create({'text':'test','voice':'vi-VN-HoaiMyNeural',**value})
        for port in [1,5050,'https://example.com',True,65536]:
            with self.assertRaises(ValueError):self.studio.port(port)
        with self.assertRaises(ValueError):self.studio.cit_request('/arbitrary')
        client=app.test_client()
        with patch('app.voice_studio',self.studio):
            response=client.get('/api/tts/providers?legacy=1&port='+str(self.server.server_port));self.assertEqual(response.status_code,200);self.assertTrue(response.json['providers']['cit']['available'])
            response=client.post('/api/tts/jobs',json={'provider':'cit','voice':'Minh Đức','text':'Chào bạn','port':self.server.server_port});self.assertEqual(response.status_code,200);job=response.json['job'];self.wait(job)
            self.assertEqual(client.get('/api/tts/jobs/'+job['id']).json['job']['state'],'done');self.assertEqual(len(client.get('/api/tts/history').json['history']),1)
            self.assertEqual(client.post('/api/tts/jobs',json={'text':'x'},headers={'Origin':'https://example.com'}).status_code,403)
    def test_voice_shapes(self):
        self.assertEqual(self.studio.normalize_voices(['A','A',{'id':'B','name':'Bee'}])[1]['name'],'Bee')
        self.assertEqual(self.studio.normalize_voices({'voices':{'A':{'name':'A name'}}})[0]['id'],'A')

if __name__=='__main__':unittest.main()
