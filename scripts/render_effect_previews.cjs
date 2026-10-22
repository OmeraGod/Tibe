/* Offline sample from the same renderer as the editor, not a browser screenshot.
   Requires FFmpeg and @napi-rs/canvas (or TIBE_CANVAS_MODULE). */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {spawn,spawnSync}=require('node:child_process');
const {once}=require('node:events');
const {createCanvas,loadImage,GlobalFonts}=require(process.env.TIBE_CANVAS_MODULE||'@napi-rs/canvas');
const effects=require('../assets/js/editor-effects.js');
const looks=require('../assets/js/editor-looks.js');
const core=require('../assets/js/editor-core.js');
const root=path.resolve(__dirname,'..');
effects.setCanvasFactory(createCanvas);

async function main(){
  const library=process.argv.includes('--library');
  const output=path.resolve((library?process.argv[3]:process.argv[2])||path.join(root,'docs/previews',library?'tibe_Library_Preview.mp4':'tibe_Effects_Preview.mp4'));
  fs.mkdirSync(path.dirname(output),{recursive:true});
  if(fs.existsSync('C:/Windows/Fonts/segoeui.ttf'))GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeui.ttf','Segoe UI');
  const photo=await loadImage(path.join(root,'assets/demo/coast-hd.png'));
  const source=createCanvas(560,350);source.getContext('2d').drawImage(photo,0,0,560,350);
  const photo2=await loadImage(path.join(root,'assets/demo/cliff-hd.png'));
  const source2=createCanvas(560,350);source2.getContext('2d').drawImage(photo2,0,0,560,350);
  const waves=vm.runInNewContext(fs.readFileSync(path.join(root,'assets/js/demo-waveforms.js'),'utf8')+';TIBE_DEMO_WAVES');
  const audio=waves.music1,clip=core.normalize({duration:3,volume:.7,fadeIn:.2,fadeOut:.35});
  const envelope=core.waveformForClip(clip,audio.peaks,audio.duration,450);
  const choices=library?[...['teal_orange','golden_hour','bw_dramatic'].map(id=>({id,type:'filter'})),...['iris','push_left','checker'].map(id=>({id,type:'transition'}))]:['neon_edges','confetti','sunrays','bokeh','glitch','rain'].map(id=>({id,type:'effect'}));
  const canvas=createCanvas(960,720),ctx=canvas.getContext('2d'),fps=24,duration=3;
  const encoder=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-vcodec','png','-r',String(fps),'-i','pipe:0',
    '-i',path.join(root,'assets/demo/sunny-days.wav'),'-t',String(duration),'-c:v','libx264','-preset','fast',
    '-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-af','volume=0.7,afade=t=in:d=0.2,afade=t=out:st=2.65:d=0.35','-movflags','+faststart',output],{windowsHide:true,stdio:['pipe','ignore','pipe']});
  let log='';encoder.stderr.on('data',data=>log+=data);encoder.stdin.on('error',()=>{});
  const finished=new Promise((resolve,reject)=>{encoder.on('error',reject);encoder.on('close',code=>code===0?resolve():reject(Error(log||'FFmpeg failed: '+code)));});
  // Prevent an early process failure from becoming an unhandled rejection.
  finished.catch(()=>{});
  const rounded=(x,y,w,h,r)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);};
  for(let frame=0;frame<fps*duration;frame++){
    const time=frame/fps;
    ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#f7f3ef';ctx.fillRect(0,0,960,720);
    ctx.fillStyle='#383945';ctx.font='bold 34px "Segoe UI"';ctx.fillText('tibe',32,49);
    ctx.fillStyle='#b47b79';ctx.font='13px "Segoe UI"';ctx.fillText(library?'MẪU BỘ LỌC VÀ CHUYỂN CẢNH':'BỘ DỰNG HIỆU ỨNG CHUYỂN ĐỘNG',120,45);
    ctx.fillStyle='#a1949b';ctx.font='12px "Segoe UI"';ctx.textAlign='right';ctx.fillText(library?`${looks.filters.length-1} bộ lọc · ${looks.transitions.length-1} chuyển cảnh`:`6 / ${effects.catalog.length-1} hiệu ứng · cùng bộ xử lý với editor`,928,45);ctx.textAlign='left';
    for(let i=0;i<choices.length;i++){
      const choice=choices[i];
      const x=32+(i%3)*306,y=77+Math.floor(i/3)*244,w=284,h=220;
      ctx.shadowColor='#a38a7430';ctx.shadowBlur=15;ctx.shadowOffsetY=8;ctx.fillStyle='#e4d9ce';rounded(x,y+4,w,h,17);ctx.fill();
      ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.fillStyle='#fffdfb';rounded(x,y,w,h,17);ctx.fill();
      ctx.save();rounded(x+7,y+7,270,169,12);ctx.clip();ctx.translate(x+142,y+91.5);
      if(choice.type==='effect')effects.draw(ctx,source,{width:270,height:169,effect:choice.id,time,amount:.85});
      else if(choice.type==='filter'){ctx.filter=looks.cssFor(choice.id);ctx.drawImage(source,-135,-84.5,270,169);ctx.filter='none';}
      else{ctx.translate(-135,-84.5);looks.drawTransition(ctx,source,source2,{id:choice.id,progress:(time%2)/2,width:270,height:169});}
      ctx.restore();const catalog=choice.type==='effect'?effects.catalog:choice.type==='filter'?looks.filters:looks.transitions;
      ctx.fillStyle='#5b5663';ctx.font='bold 13px "Segoe UI"';ctx.fillText(catalog.find(e=>e.id===choice.id).name,x+13,y+202);
      ctx.fillStyle='#c59a95';ctx.font='10px "Segoe UI"';ctx.textAlign='right';ctx.fillText(choice.type==='filter'?'COLOR':'LIVE',x+w-14,y+202);ctx.textAlign='left';
    }
    ctx.fillStyle='#fffdfa';rounded(32,585,896,101,17);ctx.fill();
    ctx.fillStyle='#7592a2';ctx.font='12px "Segoe UI"';ctx.fillText('Sunny Days · sóng âm từ dữ liệu âm thanh gốc',49,608);
    ctx.fillStyle='#cbdce8';rounded(48,619,864,49,9);ctx.fill();
    ctx.beginPath();envelope.forEach((v,i)=>{const x=51+i/(envelope.length-1)*858,y=643-v*21;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
    for(let i=envelope.length-1;i>=0;i--)ctx.lineTo(51+i/(envelope.length-1)*858,643+envelope[i]*21);
    ctx.closePath();ctx.fillStyle='#799fb7';ctx.fill();
    ctx.strokeStyle='#e7989a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(51+time/duration*858,618);ctx.lineTo(51+time/duration*858,669);ctx.stroke();
    const png=canvas.toBuffer('image/png');if(frame===24)fs.writeFileSync(output.replace(/\.mp4$/i,'.png'),png);
    if(!encoder.stdin.write(png))await once(encoder.stdin,'drain');
  }
  encoder.stdin.end();await finished;
  const gif=output.replace(/\.mp4$/i,'.gif');
  const result=spawnSync('ffmpeg',['-v','error','-y','-i',output,'-vf','fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',gif],{windowsHide:true,encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr||'GIF encoding failed');
  console.log('Rendered '+duration+' seconds / '+fps*duration+' frames: '+output);
  console.log('Animated sample: '+gif);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
