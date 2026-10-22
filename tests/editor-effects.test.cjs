const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const path=require('node:path');
const {createCanvas,loadImage}=require(process.env.TIBE_CANVAS_MODULE||'@napi-rs/canvas');
const effects=require('../assets/js/editor-effects.js');
effects.setCanvasFactory(createCanvas);
async function main(){
  const photo=await loadImage(path.join(__dirname,'../assets/demo/coast-hd.png'));
  const source=createCanvas(360,225);source.getContext('2d').drawImage(photo,0,0,360,225);
  const render=(id,time,amount=.72)=>{const canvas=createCanvas(360,225),ctx=canvas.getContext('2d');ctx.translate(180,112.5);effects.draw(ctx,source,{effect:id,time,width:360,height:225,amount});return canvas.toBuffer('image/png');};
  const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
  assert.equal(new Set(effects.catalog.map(e=>e.id)).size,effects.catalog.length);
  assert.ok(effects.catalog.length>=20);
  const original=hash(render('none',.18));let checks=0;
  for(const effect of effects.catalog){
    const a=hash(render(effect.id,.18)),b=hash(render(effect.id,.83));
    const transparent=createCanvas(360,225),transparentContext=transparent.getContext('2d');transparentContext.translate(180,112.5);transparentContext.globalAlpha=0;
    effects.draw(transparentContext,source,{effect:effect.id,time:.83,width:360,height:225,amount:.72});
    assert.equal(transparentContext.globalAlpha,0,effect.id+' must preserve parent opacity');
    assert.ok(transparentContext.getImageData(0,0,360,225).data.every(v=>v===0),effect.id+' must disappear at zero clip opacity');
    assert.equal(a,hash(render(effect.id,.18)),effect.id+' must render deterministically');
    assert.equal(hash(render(effect.id,.18,0)),original,effect.id+' at zero must preserve the source');
    if(effect.id!=='none'){assert.notEqual(a,original,effect.id+' must change actual pixels');assert.notEqual(a,b,effect.id+' must have motion over time');}
    checks++;console.log('PASS actual pixels, deterministic export and animation: '+effect.id);
  }
  const solid=createCanvas(120,80),solidCtx=solid.getContext('2d');solidCtx.fillStyle='rgb(100,150,200)';solidCtx.fillRect(0,0,120,80);
  const split=createCanvas(120,80),splitCtx=split.getContext('2d');splitCtx.translate(60,40);effects.draw(splitCtx,solid,{effect:'rgb_split',time:.5,width:120,height:80,amount:.8});
  assert.deepEqual([...splitCtx.getImageData(60,40,1,1).data],[100,150,200,255],'RGB split must preserve real channels away from edges instead of bleaching the picture');
  console.log(checks+' effect rendering checks and RGB color preservation passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
