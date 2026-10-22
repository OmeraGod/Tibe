// Media lifecycle tests with explicit test doubles; no browser automation.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ids=new Map(),created=[],listeners=new Map();
class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parts=new Map();this.isConnected=false;this.classList={add(){},remove(){},toggle(){}};this.dataset={};this.events=new Map();this.paused=true;this.duration=24;this.currentTime=0;this.playCalls=0;this.pauseCalls=0;this.value=0;}
  set innerHTML(text){this.html=text;for(const match of text.matchAll(/id="([^"]+)"/g)){const child=new Node('span');child.id=match[1];this.append(child);}}
  get innerHTML(){return this.html;}
  append(child){child.isConnected=true;this.children.push(child);if(child.id)ids.set(child.id,child);}
  querySelector(selector){if(!this.parts.has(selector))this.parts.set(selector,new Node('div'));return this.parts.get(selector);}
  setAttribute(name,value){this[name]=value;}
  removeAttribute(name){delete this[name];}
  remove(){this.isConnected=false;ids.delete(this.id);for(const child of this.children)child.remove();}
  addEventListener(name,fn){if(!this.events.has(name))this.events.set(name,[]);this.events.get(name).push(fn);}
  emit(name){for(const fn of this.events.get(name)||[])fn();}
  async play(){this.playCalls++;this.paused=false;this.emit('play');}
  pause(){this.pauseCalls++;this.paused=true;this.emit('pause');}
  load(){}
}
const document={body:new Node('body'),createElement(tag){const node=new Node(tag);if(['video','audio'].includes(tag))created.push(node);return node;},getElementById:id=>ids.get(id)||null,querySelectorAll:()=>[],addEventListener:(name,fn)=>listeners.set(name,fn)};
let pendingResolve=null,pauseCount=0,timeline=[{id:'untouched',start:3,duration:6}],seek=7,exporting=false;
const sandbox={document,console,performance:{now:()=>0},location:{protocol:'http:'},media:{a:{id:'a',name:'Audio',type:'audio',duration:24},v:{id:'v',name:'Video',type:'video',duration:12},slow:{id:'slow',name:'Pending',type:'video',duration:8}},icon:id=>id,
  pauseAll:()=>pauseCount++,updatePlayheadUI(){},resolveUrl:m=>m.id==='slow'?new Promise(resolve=>pendingResolve=resolve):Promise.resolve(m.id+'.wav'),formatTime:String,toast(){},selected:()=>null,ClipCore:require('../assets/js/editor-core.js'),TibeLooks:require('../assets/js/editor-looks.js')};
Object.defineProperty(sandbox,'exporting',{get:()=>exporting});sandbox.window=sandbox;sandbox.addEventListener=(name,fn)=>listeners.set(name,fn);
vm.runInNewContext(fs.readFileSync(require.resolve('../assets/js/editor-library.js'),'utf8'),sandbox);
const library=sandbox.TibeLibrary;
async function main(){
  await library.playSource('a');const audio=created.at(-1);assert.equal(audio.paused,false);assert.equal(pauseCount,1);assert.equal(ids.get('sourcePreview').isConnected,true);
  await library.playSource('a');assert.equal(audio.paused,true);await library.playSource('a');assert.equal(audio.paused,false);console.log('PASS source play toggles pause/resume without creating duplicate media');
  await library.playSource('v');const video=created.at(-1);assert.equal(audio.paused,true);assert.equal(audio.src,undefined);assert.equal(video.paused,false);assert.equal(pauseCount,2);assert.equal(seek,7);assert.deepEqual(timeline,[{id:'untouched',start:3,duration:6}]);console.log('PASS switching sources releases previous audio and leaves project timeline untouched');
  video.currentTime=5;video.emit('timeupdate');assert.equal(ids.get('sourceSeek').value,5);ids.get('sourceSeek').value=9;ids.get('sourceSeek').oninput({target:{value:9}});assert.equal(video.currentTime,9);console.log('PASS source transport seeks the source media');
  const loading=library.playSource('slow');assert.ok(pendingResolve);library.stopSource();pendingResolve('late.mp4');await loading;const stale=created.at(-1);assert.equal(stale.playCalls,0);assert.equal(ids.has('sourcePreview'),false);console.log('PASS closing during an asynchronous load cannot restart stale playback');
  exporting=true;const before=created.length;await library.playSource('v');assert.equal(created.length,before);exporting=false;console.log('PASS source playback cannot start during export');
  library.start();await library.playSource('a');const active=created.at(-1);document.hidden=true;listeners.get('visibilitychange')();assert.equal(active.paused,true);library.stopSource();console.log('PASS backgrounding and closing stop source audio');
  console.log('6 source preview lifecycle checks passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
