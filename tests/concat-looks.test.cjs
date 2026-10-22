'use strict';
const assert=require('node:assert/strict'),ports=require('../assets/js/concat-looks.js'),looks=require('../assets/js/editor-looks.js');
ports.install(looks);assert.equal(ports.presets.length,16);assert.equal(looks.filters.filter(f=>f.category==='concat').length,16);assert.equal(Object.keys(looks.projectLuts()).length,0);
let samples=0,maxError=0;
for(const preset of ports.presets){const lut=looks.getLuts()[preset.id];assert.equal(lut.size,33);assert.ok(lut.values.every(Number.isFinite));
  for(let i=0;i<40;i++){const c=[(i*71%251)/255,(i*113%253)/255,(i*47%249)/255];const pixel={data:new Uint8ClampedArray([...c.map(x=>x*255),255])};const expected=preset.transform(c).map(x=>Math.min(1,Math.max(0,x))*255);looks.applyLut(pixel,lut);for(let k=0;k<3;k++){const error=Math.abs(pixel.data[k]-expected[k]);maxError=Math.max(error,maxError);assert.ok(error<2.2,preset.id+' interpolation mismatch: '+error);}assert.equal(pixel.data[3],255);samples++;}
  const original={data:new Uint8ClampedArray([101,155,208,123])};looks.applyLut(original,lut,0);assert.deepEqual([...original.data],[101,155,208,123]);
}
const neutral=ports.presets.find(p=>p.id==='lut:concat-silver').transform([.5,.5,.5]);assert.ok(neutral[2]>neutral[0]);
looks.registerLuts({'lut:user-test':{...ports.bake(ports.presets[0],2),builtin:undefined}});assert.ok(looks.projectLuts()['lut:user-test']);
console.log('Concat: 16 shader ports, '+samples+' LUT samples passed; max error '+maxError.toFixed(2)+'/255.');
