// Regression: invoke the real Text drawer buttons and compositor at the exact
// paused insertion time. Native canvas + small DOM doubles; no browser control.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas,GlobalFonts}=require(process.env.TIBE_CANVAS_MODULE||'@napi-rs/canvas');
const C=require('../assets/js/editor-core.js'),effects=require('../assets/js/editor-effects.js'),looks=require('../assets/js/editor-looks.js');
effects.setCanvasFactory(createCanvas);
if(fs.existsSync('C:/Windows/Fonts/segoeui.ttf'))GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeui.ttf','Segoe UI');
if(fs.existsSync('C:/Windows/Fonts/segoesc.ttf'))GlobalFonts.registerFromPath('C:/Windows/Fonts/segoesc.ttf','Segoe Script');
const elements=new Map(),raf=[];
class Node{
  constructor(){this.children=[];this.dataset={};this.classList={toggle(){}};this.scrollTop=40;this.focused=false;this.selected=false;this.value='';}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  focus(){this.focused=true;}
  select(){this.selected=true;}
}
const el=id=>{if(!elements.has(id))elements.set(id,new Node());return elements.get(id);};
const code=fs.readFileSync(require.resolve('../assets/js/editor.js'),'utf8');
const names=['tile','iconForTile','renderDrawer','addClip','addTextClip','drawCompositeFrame','transitionHoldLocal','drawVideoWithTransition','drawVisual','drawLabel','labelLayout','processedVisual'];
const functions=names.map(name=>{const start=code.indexOf('function '+name+'(');assert.ok(start>=0,name);const next=code.slice(start+1).search(/\n(?:async )?function [A-Za-z]/);assert.ok(next>=0,name);return code.slice(start,start+1+next);}).join('\n');
const canvas=createCanvas(450,800),ctx=canvas.getContext('2d'),notices=[];let history=[];
const context={console,canvas,ctx,C,Math,Uint8ClampedArray,JSON,document:{querySelector:el,querySelectorAll:()=>[],getElementById:el,createElement:tag=>tag==='canvas'?createCanvas(1,1):new Node()},$:el,requestAnimationFrame:fn=>raf.push(fn),
  TibeEffects:effects,TibeLooks:looks,TibeLibrary:{resetCards(){},stopSource(){context.sourceStopped=true;},previewLook:c=>c.filter||'original'},TibeUI:{resetEffectCards(){},effectPreview:(c,time)=>({effect:c.effect||'none',time})},
  visualLayers:new Map(),transitionFrames:{},projectCanvas:{enabled:true,color:'#403944',blur:false},trackState:{text:{hidden:false,locked:false}},media:{},clips:[],currentTime:0,totalDuration:24,exporting:false,isPlaying:false,selectedClipId:null,selectedIds:new Set(),activeTab:'text',inspectorTab:'speed',
  updateSelectionBox(){},prepareMedia(){},toast:message=>notices.push(message),pauseAll(){context.isPlaying=false;},
  mutate(fn){history.push({clips:C.copy(context.clips),trackState:C.copy(context.trackState)});fn();context.totalDuration=Math.max(.1,...context.clips.map(c=>c.start+c.duration));},
  renderInspector(){const input=el('inspTextInput'),clip=context.clips.find(c=>c.id===context.selectedClipId);input.value=clip?.title||'';},
  seekTo(time){context.currentTime=time;context.drawCompositeFrame();},setPercent(){},openVoice(){},loadPresetProject(){},openReaModal(){},newProject(){},addLibraryMedia(){},importSubtitles(){},download(){},formatTime:C.formatTime};
vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../assets/js/icons.js'),'utf8'),context);vm.runInContext(functions,context);
const pixels=()=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
let checks=0;
for(const [rw,rh] of [[9,16],[16,9],[1,1],[4,5]]){
  canvas.width=450;canvas.height=Math.round(450*rh/rw);
  context.activeTab='text';context.renderDrawer();const grid=el('drawerContent').children.at(-1);
  assert.equal(grid.children.length,10,'Text drawer contains Add Text, voice, six styles and SRT actions');
  for(let index=0;index<7;index++){
    context.clips=[];context.currentTime=0;context.isPlaying=true;context.inspectorTab='speed';context.trackState.text={hidden:true,locked:false};history=[];
    context.drawCompositeFrame();const before=new Uint8ClampedArray(pixels());
    grid.children[index===0?0:index+1].onclick();while(raf.length)raf.shift()();
    assert.equal(context.clips.length,1);const clip=context.clips[0];assert.equal(clip.track,'text');assert.equal(clip.anim,'none');assert.equal(context.currentTime,clip.start);assert.equal(context.isPlaying,false);assert.equal(context.inspectorTab,'video');assert.equal(context.selectedClipId,clip.id);assert.ok(context.selectedIds.has(clip.id));assert.equal(context.trackState.text.hidden,false);assert.equal(history.length,1);assert.equal(history[0].trackState.text.hidden,true);
    const after=pixels();let changes=0,minY=Infinity,maxY=-Infinity;for(let i=0;i<after.length;i+=4)if(after[i]!==before[i]||after[i+1]!==before[i+1]||after[i+2]!==before[i+2]){changes++;const y=Math.floor(i/4/canvas.width);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    assert.ok(changes>100,`${rw}:${rh} ${clip.textStyle} must draw visible text at insertion time`);assert.ok(minY>0&&maxY<canvas.height-1,`${rw}:${rh} ${clip.textStyle} must remain inside the frame`);
    assert.equal(el('inspContent').scrollTop,0);assert.equal(el('inspTextInput').value,clip.title);assert.equal(el('inspTextInput').focused,true);assert.equal(el('inspTextInput').selected,true);
    checks++;
  }
  console.log(`PASS all Text buttons render immediately inside ${rw}:${rh}`);
}
context.clips=[];context.currentTime=24;context.trackState.text={hidden:false,locked:false};context.addTextClip('Xin chào\nViệt Nam','heading');assert.equal(context.clips[0].start,24);assert.equal(context.currentTime,24);assert.equal(context.totalDuration,28);assert.deepEqual([...context.labelLayout(context.clips[0]).lines],['Xin chào','Việt Nam']);context.clips[0].title='Nội dung vừa sửa';context.drawCompositeFrame();assert.ok(context.labelLayout(context.clips[0]).lines.join(' ').includes('Nội dung vừa sửa'));console.log('PASS insertion at project end and Vietnamese multiline editing');
const count=context.clips.length;context.trackState.text.locked=true;context.addTextClip();assert.equal(context.clips.length,count);assert.match(notices.at(-1),/khóa/);context.trackState.text.locked=false;context.exporting=true;context.addTextClip();assert.equal(context.clips.length,count);console.log('PASS locked tracks and active export reject insertion');
console.log(checks+' paused text rendering regressions plus editing and insertion guards passed');
