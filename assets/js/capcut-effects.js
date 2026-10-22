/* Local shader algorithm adaptations. Native resources stay on the user's machine. */
(function(root){
  'use strict';const entries=new Map(),buffers=new WeakMap();
  const fract=x=>x-Math.floor(x);
  function grain(u,v,seed,intensity){let x=fract(u*9331.99*.1031)+seed,y=fract(v*9331.99*.1031)+seed,z=fract(seed*9331.99*.1031)+seed;const dot=x*(y+33.33)+y*(z+33.33)+z*(x+33.33);x+=dot;y+=dot;z+=dot;return (fract((x+y)*z)-.5)*intensity;}
  function register(report,catalog){
    for(const entry of report.algorithms||[]){
      if(!/^[a-f0-9]{64}$/.test(entry.sha256||''))continue;
      const variants=entry.algorithm==='grain'?[['grain','Hạt phim CapCut','grain',1]]:entry.algorithm==='direction_blur'?[['motion_h','Mờ ngang CapCut','direction_blur',1,0],['motion_v','Mờ dọc CapCut','direction_blur',0,1],['motion_d','Mờ chéo CapCut','direction_blur',.7071,.7071]]:entry.algorithm==='soft_blur'?[['soft_blur','Mờ mềm CapCut','soft_blur',0,1]]:[];
      for(const [key,name,algorithm,x,y] of variants){const id='capcut:'+key;entries.set(id,{...entry,algorithm,x,y});if(!catalog.some(e=>e.id===id))catalog.push({id,name,category:'capcut',description:'Thuật toán từ shader trên máy · đã chuyển sang tibe'});}
    }
  }
  function draw(ctx,source,{effect,amount,time,width,height}){
    const entry=entries.get(effect);if(!entry)return false;const a=Math.min(1,Math.max(0,Number(amount)||0)),w=width,h=height;
    if(entry.algorithm==='grain'){
      if(!a){ctx.drawImage(source,-w/2,-h/2,w,h);return true;}
      let off=buffers.get(ctx.canvas);if(!off){off=root.document.createElement('canvas');buffers.set(ctx.canvas,off);}const density=Math.max(.25,Math.hypot(ctx.getTransform().a,ctx.getTransform().b));off.width=Math.max(2,Math.round(w*density));off.height=Math.max(2,Math.round(h*density));const cx=off.getContext('2d');cx.drawImage(source,0,0,off.width,off.height);const frame=cx.getImageData(0,0,off.width,off.height),seed=fract(Math.floor(time*24)*.013+.17);
      for(let y=0;y<off.height;y++)for(let x=0;x<off.width;x++){const i=(y*off.width+x)*4,noise=grain((x+.5)/off.width,(y+.5)/off.height,seed,.24*a)*255;for(let c=0;c<3;c++)frame.data[i+c]+=noise;}
      cx.putImageData(frame,0,0);ctx.drawImage(off,-w/2,-h/2,w,h);return true;
    }
    if(!a){ctx.drawImage(source,-w/2,-h/2,w,h);return true;}
    const soft=entry.algorithm==='soft_blur',radius=soft?8:7,weights=soft?[.2,.19,.17,.15,.13,.11,.08,.05,.02]:null,total=weights?weights[0]+2*weights.slice(1).reduce((s,v)=>s+v,0):15;
    let off=buffers.get(ctx.canvas);if(!off){off=root.document.createElement('canvas');buffers.set(ctx.canvas,off);}const density=Math.max(.25,Math.hypot(ctx.getTransform().a,ctx.getTransform().b));off.width=Math.max(2,Math.round(w*density));off.height=Math.max(2,Math.round(h*density));const cx=off.getContext('2d');cx.clearRect(0,0,off.width,off.height);cx.globalCompositeOperation='lighter';
    for(let i=-radius;i<=radius;i++){
      cx.globalAlpha=(weights?weights[Math.abs(i)]:1)/total;const dx=i*entry.x*a*4*density,dy=i*(entry.y||0)*a*4*density;
      for(const tx of entry.x?[-1,0,1]:[0])for(const ty of entry.y?[-1,0,1]:[0]){cx.save();cx.translate(dx+tx*off.width,dy+ty*off.height);if(tx<0){cx.translate(off.width,0);cx.scale(-1,1);}if(tx>0){cx.translate(off.width,0);cx.scale(-1,1);}if(ty<0){cx.translate(0,off.height);cx.scale(1,-1);}if(ty>0){cx.translate(0,off.height);cx.scale(1,-1);}cx.drawImage(source,0,0,off.width,off.height);cx.restore();}
    }
    cx.globalAlpha=1;cx.globalCompositeOperation='source-over';ctx.drawImage(off,-w/2,-h/2,w,h);return true;
  }
  async function load(){try{const response=await (root.TibeBackend?.request||root.fetch)('/api/resources/capcut');if(!response.ok)return;const report=await response.json();register(report,root.TibeEffects.catalog);if(typeof activeTab!=='undefined'&&activeTab==='effects')root.renderDrawer();}catch{}}
  const builtins={algorithms:[
    {algorithm:'grain',sha256:'14d41a7144f9269b027f504e6fdc7cb616e3e96fafbcf101fe893f20c7545f05'},
    {algorithm:'direction_blur',sha256:'4d2b7a6c3fb66c6383703e2c6f3eea8616662c0e77d61205a259733077f7cbde'},
    {algorithm:'soft_blur',sha256:'00639277cb74edffe0e106a59a53368c458779fd37546cfe59f3ba15944b1747'}
  ]};
  const api={register,draw,grain,load,builtins};if(typeof module!=='undefined')module.exports=api;else{root.TibeCapCut=api;register(builtins,root.TibeEffects.catalog);}
})(typeof window!=='undefined'?window:globalThis);
