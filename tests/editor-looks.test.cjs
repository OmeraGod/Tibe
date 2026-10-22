'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createCanvas}=require(process.env.TIBE_CANVAS_MODULE||'@napi-rs/canvas');
const looks=require('../assets/js/editor-looks.js');
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
const a=createCanvas(240,150),b=createCanvas(240,150);
for(const [canvas,colors] of [[a,['#b64548','#f4d37c']],[b,['#307ea0','#aedab1']]]){const cx=canvas.getContext('2d'),g=cx.createLinearGradient(0,0,240,150);g.addColorStop(0,colors[0]);g.addColorStop(1,colors[1]);cx.fillStyle=g;cx.fillRect(0,0,240,150);cx.fillStyle='#fff8ed';cx.fillRect(canvas===a?18:160,20,45,90);}
const render=(id,p,opacity=1)=>{const canvas=createCanvas(240,150),ctx=canvas.getContext('2d');ctx.globalAlpha=opacity;looks.drawTransition(ctx,a,b,{id,progress:p,width:240,height:150});return canvas;};
const originalA=hash(a.toBuffer('image/png')),originalB=hash(b.toBuffer('image/png'));
check('every transition preserves exact source and destination endpoints',()=>{for(const t of looks.transitions){assert.equal(hash(render(t.id,0).toBuffer('image/png')),t.id==='none'?originalB:originalA,t.id+' start');assert.equal(hash(render(t.id,1).toBuffer('image/png')),originalB,t.id+' end');}});
for(const t of looks.transitions.filter(t=>t.id!=='none'))check('actual animated transition: '+t.id,()=>{const first=hash(render(t.id,.23).toBuffer('image/png')),last=hash(render(t.id,.72).toBuffer('image/png'));assert.notEqual(first,last);assert.equal(first,hash(render(t.id,.23).toBuffer('image/png')));assert.notEqual(first,originalA);assert.notEqual(first,originalB);assert.ok(render(t.id,.72,0).getContext('2d').getImageData(0,0,240,150).data.every(v=>v===0));});
check('all built-in grades change image pixels and zero intensity preserves original',()=>{for(const grade of looks.filters.filter(f=>f.id!=='original')){const out=createCanvas(240,150),cx=out.getContext('2d');cx.filter=looks.cssFor(grade.id,1);cx.drawImage(a,0,0);assert.notEqual(hash(out.toBuffer('image/png')),originalA,grade.id);cx.clearRect(0,0,240,150);cx.filter=looks.cssFor(grade.id,0);cx.drawImage(a,0,0);assert.equal(hash(out.toBuffer('image/png')),originalA,grade.id+' zero');}});
const cube=['TITLE "Invert"','LUT_3D_SIZE 2','DOMAIN_MIN 0 0 0','DOMAIN_MAX 1 1 1'];for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++)cube.push(`${1-x} ${1-y} ${1-z}`);
check('cube parser and trilinear lookup interpolate real 3D colors',()=>{const lut=looks.parseCube(cube.join('\n'));assert.equal(lut.title,'Invert');const frame={data:new Uint8ClampedArray([64,128,192,255,100,120,140,0])};looks.applyLut(frame,lut,1);assert.deepEqual([...frame.data],[191,127,63,255,100,120,140,0]);const half={data:new Uint8ClampedArray([64,128,192,255])};looks.applyLut(half,lut,.5);assert.deepEqual([...half.data],[128,128,128,255]);});
check('malformed and 1D cubes are rejected',()=>{for(const bad of ['LUT_3D_SIZE 3\n0 0 0','LUT_1D_SIZE 2\n0 0 0','LUT_3D_SIZE 1\nNaN 0 0',cube.join('\n').replace('DOMAIN_MAX 1 1 1','DOMAIN_MAX 0 1 1')])assert.throws(()=>looks.parseCube(bad));});
check('imported LUT data round trips inside project JSON',()=>{const lut=looks.parseCube(cube.join('\n'));looks.registerLuts({'lut:test':lut});const copy=JSON.parse(JSON.stringify(looks.getLuts()));assert.deepEqual(copy['lut:test'].values,lut.values);assert.ok(looks.filters.some(f=>f.id==='lut:test'));looks.registerLuts({'lut:bad':{size:2,values:[]}});assert.equal(looks.getLuts()['lut:bad'],undefined);});
console.log(checks+' color and transition checks passed');
