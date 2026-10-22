import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

from PIL import Image
from flask import Flask

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from omera_hub import OmeraHub, register_omera, CHANNEL
from project_store import ProjectStore


class OmeraTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        for d in ['data/creative/test','data/productions/test','data/assessments','content']:
            (self.root/d).mkdir(parents=True,exist_ok=True)
        self.store=ProjectStore(self.root/'projects')
        self.hub=OmeraHub(self.root,self.store)
        art=self.root/'data/creative/test/room.png'
        Image.new('RGB',(1448,1086),'teal').save(art)
        self.brief={'channel_id':CHANNEL,'slug':'test-story','title':'Tình huống mới','asset_policy':'original_ai_composited','asset_provenance':[{'file':'data/creative/test/room.png','sha256':hashlib.sha256(art.read_bytes()).hexdigest()}],'scenes':[{'visual':'space_a','headline':'TỰ THỬ','narration':'Cùng nhìn nhé.','min_duration':3}], 'sources':['https://example.com']}
        (self.root/'content/test.json').write_text(json.dumps(self.brief),encoding='utf-8')

    def snapshot(self,view=None):
        snap={'channel_id':CHANNEL,'channel_name':'Omera Studio','observed_at':'2026-10-22T13:47:20+07:00','complete':True,'subscribers':11,'estimated_revenue_usd':None,'revenue_status':'not_monetized','videos':[{'video_id':'6I9w-7C7KOY','title':'One','kind':'Shorts','visibility':'public','views':view},{'video_id':'2UyVTySQZ0A','title':'Private','visibility':'private','views':900}]}
        with sqlite3.connect(self.root/'data/studio.sqlite3') as db:
            db.execute('CREATE TABLE channel_reports(channel_id TEXT,snapshot TEXT,last_error TEXT)')
            db.execute('INSERT INTO channel_reports VALUES(?,?,?)',(CHANNEL,json.dumps(snap),''))
        db.close()
        return snap

    def test_missing_data_does_not_invent_counts(self):
        self.assertFalse(self.hub.overview()['connected'])

    def test_null_views_money_and_private_rows_are_preserved(self):
        self.snapshot()
        before=(self.root/'data/studio.sqlite3').read_bytes()
        value=self.hub.overview()
        self.assertEqual(value['summary']['published_count'],1)
        self.assertIsNone(value['summary']['views'])
        self.assertIsNone(value['summary']['estimated_revenue_usd'])
        self.assertEqual(before,(self.root/'data/studio.sqlite3').read_bytes())

    def test_zero_is_valid_and_analytics_is_not_content(self):
        self.snapshot(0)
        for i,(when,n) in enumerate([('2026-10-22T08:00:00+07:00',22),('2026-10-22T14:00:00+07:00',33)]):
            a={'channel_id':CHANNEL,'videos':[{'video_id':'6I9w-7C7KOY','engagement_observed_at':when,'metrics':{'engaged_views':n,'analytics_views':99,'average_percentage_viewed':None}}]}
            (self.root/f'data/assessments/{i}.json').write_text(json.dumps(a),encoding='utf-8')
        data=self.hub.overview()
        self.assertEqual(data['summary']['views'],0)
        self.assertEqual(data['videos'][0]['metrics']['engaged_views'],33)
        self.assertIsNone(data['videos'][0]['metrics']['average_percentage_viewed'])

    def test_editable_project_is_separate_and_has_no_fake_voice(self):
        before=(self.root/'content/test.json').read_bytes()
        p=self.hub.project('test-story')
        self.store.validate(p)
        self.assertEqual([c['track'] for c in p['clips']],['video','text'])
        self.assertTrue(p['media']['omera_0']['url'].startswith('data:image/jpeg;base64,'))
        self.assertEqual(before,(self.root/'content/test.json').read_bytes())
        with self.assertRaises(ValueError): self.hub.project('../../secrets')

    def test_art_hash_or_traversal_is_rejected(self):
        b=self.brief.copy();b['asset_provenance']=[{'file':'../../outside.png','sha256':'x'}]
        (self.root/'content/test.json').write_text(json.dumps(b),encoding='utf-8')
        with self.assertRaises(ValueError): self.hub.project('test-story')
        (self.root/'content/test.json').write_text(json.dumps(self.brief),encoding='utf-8')
        Image.new('RGB',(10,10),'red').save(self.root/'data/creative/test/room.png')
        with self.assertRaises(ValueError): self.hub.project('test-story')

    def test_blueprint_reads_and_creates_a_new_saved_copy(self):
        app=Flask(__name__)
        # Explicit source setting for a fresh test installation.
        base=self.root/'base';(base/'workspace').mkdir(parents=True)
        (base/'workspace/omera-config.json').write_text(json.dumps({'source_root':str(self.root)}),encoding='utf-8')
        register_omera(app,base,self.store)
        c=app.test_client()
        self.assertFalse(c.get('/api/omera/overview').json['connected'])
        result=c.post('/api/omera/project/test-story',json={})
        self.assertEqual(result.status_code,200)
        project=self.store.load(result.json['project_id'])
        self.assertEqual(project['ratio'],'9:16')
        self.assertEqual(c.get('/api/omera/video/not-an-id').status_code,404)


if __name__=='__main__': unittest.main()
