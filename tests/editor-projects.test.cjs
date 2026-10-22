'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),C=require('../assets/js/editor-core.js');
const elements=new Map(),notices=[];const el=id=>{if(!elements.has(id))elements.set(id,{disabled:false,value:'Video mới',hidden:false,addEventListener(){}});return elements.get(id);};
const original={format:'clipcut-project',version:2,name:'Dự án cũ',libraryId:'a'.repeat(32),ratio:'16:9',clips:[{id:'old',track:'video',mediaId:'image',start:0,duration:4}],media:{image:{id:'image',type:'image',url:'assets/demo/coast-hd.png'}},trackState:{audio:{locked:true}}};
const context={console,C,JSON,Math,Set,AbortSignal,window:null,document:{querySelector:()=>({value:'9:16'}),querySelectorAll:()=>[]},$:el,TibeCreator:require('../assets/js/creator-core.js'),TibeLooks:require('../assets/js/editor-looks.js'),TibeEffects:require('../assets/js/editor-effects.js'),exporting:false,backend:{},history:[],future:[{}],currentTime:3,trackState:{audio:{locked:true}},selectedClipId:'old',selectedIds:new Set(['old']),clips:C.copy(original.clips),media:C.copy(original.media),ratio:original.ratio,projectName:original.name,currentProjectId:original.libraryId,
  snapshot(){return C.copy({format:'clipcut-project',version:2,clips:context.clips,media:context.media,ratio:context.ratio,name:context.projectName,libraryId:context.currentProjectId,trackState:context.trackState});},
  applyProject(p){context.clips=C.copy(p.clips);context.media=C.copy(p.media);context.ratio=p.ratio;context.projectName=p.name;context.currentProjectId=p.libraryId||null;context.trackState=p.trackState||{};},
  mutate(fn){context.history.push(context.snapshot());fn();},pauseAll(){},seekTo(time){context.currentTime=time;},refresh(){},saveSoon(){},closeDialog(){},selectRail(){},toast:m=>notices.push(m),TibeLibrary:{stopSource(){},stopLookPreview(){}},icon:()=>'',escapeHTML:s=>String(s),formatTime:C.formatTime};context.window=context;
vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../assets/js/editor-projects.js'),'utf8'),context);
context.TibeProjects.clearTimeline();assert.equal(context.clips.length,0);assert.equal(context.media.image.id,'image');assert.equal(context.currentTime,0);assert.equal(context.currentProjectId,original.libraryId);assert.equal(context.history.length,1);assert.equal(context.history[0].clips.length,1);assert.match(notices.at(-1),/Ctrl\+Z/);
context.applyProject(context.history.pop());context.exporting=true;context.TibeProjects.clearTimeline();assert.equal(context.clips.length,1);context.exporting=false;
el('creatorName').value='Shorts mới';context.TibeProjects.create();assert.equal(context.clips.length,0);assert.deepEqual(Object.keys(context.media),[]);assert.equal(context.currentProjectId,null);assert.equal(context.ratio,'9:16');assert.equal(context.projectName,'Shorts mới');assert.equal(context.selectedIds.size,0);assert.equal(context.future.length,0);assert.equal(context.history.at(-1).libraryId,original.libraryId);
context.applyProject(context.history.pop());assert.equal(context.clips[0].id,'old');assert.equal(context.currentProjectId,original.libraryId);
const page=fs.readFileSync(require.resolve('../templates/index.html'),'utf8');assert.ok(!page.includes('avatar-button'));assert.ok(page.includes('id="timelineEmpty"'));assert.ok(page.includes('TibeProjects.clearTimeline()'));assert.equal(page,fs.readFileSync(require.resolve('../ClipCut_Studio_Standalone.html'),'utf8'));
console.log('Projects: clear keeps media and ID; new resets format/media/ID; undo restores previous project; pages stay synchronized.');
// A delayed save must update the original folder, never the project opened meanwhile.
(async()=>{
  context.applyProject(original);let finish;context.portableProject=()=>new Promise(resolve=>{finish=()=>resolve(C.copy(original));});const savedUrls=[];
  context.fetch=async(url,options)=>{savedUrls.push(url);return {ok:true,json:async()=>({ok:true,project:{id:original.libraryId},projects:[]})};};
  const saving=context.TibeProjects.save();context.applyProject({...original,libraryId:'b'.repeat(32),name:'Dự án khác'});finish();await saving;
  assert.equal(savedUrls[0],'/api/projects/'+original.libraryId);assert.equal(context.currentProjectId,'b'.repeat(32));assert.equal(el('saveFolderButton').disabled,false);
  console.log('Projects: saving while switching projects keeps folder identities separate.');
})().catch(e=>{console.error(e);process.exitCode=1;});
