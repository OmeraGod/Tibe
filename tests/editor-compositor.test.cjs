// Execute the editor's actual compositor against native canvas test images.
// This is renderer integration testing, not browser or UI validation.
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createCanvas}=require(process.env.TIBE_CANVAS_MODULE||'@napi-rs/canvas');
const C=require('../assets/js/editor-core.js'),effects=require('../assets/js/editor-effects.js'),looks=require('../assets/js/editor-looks.js');
effects.setCanvasFactory(createCanvas);
const code=fs.readFileSync(require.resolve('../assets/js/editor.js'),'utf8');
const names=['drawCompositeFrame','transitionHoldLocal','drawVideoWithTransition','drawVisual','drawLabel','processedVisual'];
const functions=names.map(name=>{const start=code.indexOf('function '+name+'(');assert.ok(start>=0,name);const next=code.slice(start+1).search(/\n(?:async )?function [A-Za-z]/);assert.ok(next>=0);return code.slice(start,start+1+next);}).join('\n');
const canvas=createCanvas(450,254),ctx=canvas.getContext('2d');
const sources=['#d88f7a','#7eb7c9'].map((color,i)=>{const source=createCanvas(450,254),cx=source.getContext('2d');cx.fillStyle=color;cx.fillRect(0,0,450,254);cx.fillStyle=i?'#ffdf91':'#e4ecda';cx.fillRect(i?290:35,36,90,180);source.naturalWidth=450;source.naturalHeight=254;source.src='fixture'+i;return source;});
const context={console,canvas,ctx,C,Math,Uint8ClampedArray,JSON,TibeEffects:effects,TibeLooks:looks,TibeLibrary:{previewLook:c=>c.filter||'original'},TibeUI:{effectPreview:(c,time)=>({effect:c.effect||'none',time})},document:{createElement:()=>createCanvas(1,1)},visualLayers:new Map(),transitionFrames:{},projectCanvas:{enabled:true,color:'#fff5ef',blur:false},trackState:{},media:{a:{type:'image'},b:{type:'image'}},loadImage:m=>sources[m===context.media.a?0:1],clips:[],currentTime:0,updateSelectionBox(){}};
vm.createContext(context);vm.runInContext(functions,context);
const hash=()=>crypto.createHash('sha256').update(canvas.toBuffer('image/png')).digest('hex');
const render=time=>{context.currentTime=time;context.drawCompositeFrame();return hash();};
for(const transition of looks.transitions){
 context.clips=[C.normalize({id:'a',track:'video',mediaId:'a',start:0,duration:1,filter:'cream'}),C.normalize({id:'b',track:'video',mediaId:'b',start:1,duration:1,filter:'ocean',effect:'sparkles',transition:transition.id,transitionDuration:.5})];
 const early=render(1.13),later=render(1.36);assert.equal(early,render(1.13),transition.id+' export must be deterministic');assert.notEqual(early,later,transition.id+' must advance effect/transition time');assert.equal(context.ctx.getTransform().a,1,transition.id+' must restore canvas state');
 assert.equal(context.transitionHoldLocal(context.clips[0]),transition.id==='none'?null:.99999);console.log('PASS integrated compositor: '+transition.id);
}
context.clips=[C.normalize({id:'color',track:'video',mediaId:'a',duration:3,filter:'noir',filterAmount:0})];const unchanged=render(.5);context.clips[0].filter='original';assert.equal(unchanged,render(.5));context.clips[0].filter='noir';context.clips[0].filterAmount=1;assert.notEqual(unchanged,render(.5));
const cube=['LUT_3D_SIZE 2'];for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++)cube.push(`${1-x} ${1-y} ${1-z}`);
looks.registerLuts({'lut:fixture':looks.parseCube(cube.join('\n'))});context.clips[0].filter='lut:fixture';assert.notEqual(unchanged,render(.5));const inverted=hash();assert.equal(inverted,render(.5));context.clips[0].filterAmount=0;assert.equal(unchanged,render(.5));
console.log('28 transition compositor checks, color strength and imported LUT integration passed');
