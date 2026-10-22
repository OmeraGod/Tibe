'use strict';
const assert=require('node:assert/strict'),creator=require('../assets/js/creator-core.js');
const media={photo:{id:'photo',name:'Ảnh',type:'image',duration:4},movie:{id:'movie',name:'Video',type:'video',duration:3},song:{id:'song',name:'Nhạc',type:'audio',duration:8}};
const options={media,effects:['none','snowfall'],filters:['original'],transitions:['none','dissolve']};let checks=0;
for(const preset of creator.presets){const plan=creator.parse('Xin chào Việt Nam\nCâu chuyện của tôi',{ratio:preset.ratio});const {project,duration}=creator.build(plan,options);assert.equal(project.ratio,preset.ratio);assert.equal(project.clips.filter(c=>c.track==='text').length,2);assert.ok(duration>0);assert.ok(Math.abs(project.clips.find(c=>c.track==='text').yOffset)<450*preset.height/preset.width/2);checks++;}
const plain=creator.build(creator.parse('Chỉ có chữ'),{media:{}});assert.equal(plain.project.clips.length,1);assert.equal(plain.project.clips[0].yOffset,0);
const music=creator.build({name:'Dựng thử',ratio:'16:9',scenes:[{text:'Một',mediaId:'movie',duration:8,effect:'snowfall'},{text:'Hai',mediaId:'photo',duration:6}],music:{mediaId:'song',volume:.25}},options);assert.equal(music.duration,9);assert.equal(music.warnings.length,1);assert.equal(music.project.clips.at(-1).duration,8);assert.equal(music.project.clips.at(-1).volume,.25);
for(const plan of [{scenes:[]},{ratio:'2:1',scenes:[{text:'a'}]},{scenes:[{text:'a',duration:Infinity}]},{scenes:[{text:'a',mediaId:'gone'}]},{scenes:[{text:'a',effect:'unknown'}]},{scenes:[{text:'a',filter:'unknown'}]},{scenes:[{text:'a',transition:'unknown'}]},{scenes:[{text:'a'}],music:{mediaId:'photo'}},{scenes:[{mediaId:'movie',sourceIn:5}]}]){assert.throws(()=>creator.build(plan,options));checks++;}
assert.throws(()=>creator.build({scenes:[{}]},{media:{}}));
assert.throws(()=>creator.parse('{broken'));assert.throws(()=>creator.parse(' '));assert.throws(()=>creator.build({scenes:Array.from({length:301},()=>({text:'a'}))}));
assert.equal(media.movie.duration,3);assert.equal(creator.parse('{"scenes":[{"text":"Hi"}]}').scenes[0].text,'Hi');
console.log('Creator: '+(checks+8)+' format, scene, bounds, media and music checks passed.');
