(function(root){
  'use strict';
  const catalog=[
    ['none','Không hiệu ứng','all','Nguyên bản'],['film','Hạt phim','retro','Hạt sáng chuyển động'],
    ['glow','Ánh sáng mềm','light','Bloom dịu theo nhịp'],['shake','Rung máy','motion','Rung nhẹ khung hình'],
    ['blur','Làm mờ','lens','Mờ mềm có chuyển động'],['pulse','Nhịp zoom','motion','Phóng nhẹ theo nhịp'],
    ['flash','Chớp sáng','light','Nháy trắng mượt'],['rgb_split','Tách màu RGB','party','Viền đỏ và xanh lệch màu'],
    ['glitch','Nhiễu kỹ thuật số','party','Các dải hình dịch chuyển'],['light_leak','Rò sáng','light','Vệt nắng đi qua khung'],
    ['sparkles','Lấp lánh','light','Những tia sáng nhấp nháy'],['snowfall','Tuyết rơi','nature','Bông tuyết chuyển động'],
    ['rain','Mưa nhẹ','nature','Các vệt mưa rơi'],['scanlines','Băng VHS','retro','Sọc quét màn hình'],
    ['vignette','Viền điện ảnh','lens','Viền tối thở nhẹ'],['dream_haze','Sương mộng','lens','Sương sáng lướt qua'],
    ['zoom_blur','Zoom chuyển động','motion','Dư ảnh phóng tỏa'],['mirror','Gương đôi','party','Hai nửa ảnh đối xứng'],
    ['pixelate','Pixel động','party','Các khối điểm ảnh'],['ripple','Gợn sóng','nature','Mặt hình uốn theo sóng'],
    ['warm_film','Phim nắng','retro','Sắc phim vàng và hạt'],['cinema','Khung điện ảnh','lens','Hai dải đen và độ tương phản'],
    ['prism','Lăng kính','light','Các lớp phản chiếu màu'],['floating_hearts','Tim bay','party','Những trái tim nổi lên'],
    ['orbit','Lắc nghiêng','motion','Khung hình nghiêng theo nhịp'],['tilt_shift','Tilt Shift','lens','Mờ viền trên và dưới'],
    ['double_exposure','Phơi sáng đôi','lens','Hai lớp ảnh trôi nhẹ'],['echo_trail','Dư ảnh','motion','Các lớp ảnh kéo đuôi'],
    ['neon_edges','Viền neon','party','Tách nét ảnh thành ánh neon'],['posterize','Áp phích','party','Giảm bậc màu có chuyển động'],
    ['duotone','Hai tông màu','party','Đổi ảnh sang hai dải màu'],['halftone','Chấm in','retro','Lớp chấm in trôi trên ảnh'],
    ['disco','Đèn disco','party','Các quầng màu xoay chuyển'],['spotlight','Đèn sân khấu','light','Vùng sáng di chuyển'],
    ['bokeh','Bokeh','light','Đốm sáng tròn bay nhẹ'],['confetti','Pháo giấy','party','Giấy màu xoay và rơi'],
    ['bubbles','Bong bóng','nature','Những vòng tròn nổi lên'],['rainbow','Cầu vồng','light','Dải sắc màu lướt qua'],
    ['sunrays','Tia nắng','light','Tia sáng xoay trên khung'],['dust','Bụi nắng','retro','Bụi nhỏ trong ánh vàng'],
    ['old_movie','Phim cũ','retro','Phim bạc màu với vết xước']
  ].map(([id,name,category,description])=>({id,name,category,description}));
  const extraCatalog=[["starfield", "Bầu trời sao", "nature", "Các ngôi sao trôi và lấp lánh"], ["meteors", "Mưa sao băng", "nature", "Tia sao băng lướt chéo"], ["fireflies", "Đom đóm", "nature", "Đốm sáng vàng bay trong đêm"], ["autumn_leaves", "Lá thu bay", "nature", "Lá vàng xoay và rơi"], ["sakura_petals", "Cánh hoa rơi", "nature", "Cánh hoa hồng bay theo gió"], ["aurora", "Cực quang", "light", "Sóng sáng xanh tím chuyển động"], ["light_sweep", "Ánh sáng lướt", "light", "Vệt sáng chéo quét qua ảnh"], ["heartbeat", "Nhịp tim", "motion", "Hai nhịp phóng khung liên tiếp"], ["strobe", "Nhịp đèn", "party", "Lớp sáng thay đổi theo nhịp"], ["speed_lines", "Tia tốc độ", "motion", "Các tia tỏa nhanh từ tâm"], ["radar_scan", "Radar", "party", "Vệt quét tròn màu xanh"], ["film_frame", "Khung phim động", "retro", "Viền và lỗ phim chuyển động"], ["projector", "Máy chiếu cổ", "retro", "Hình phim rung và ánh máy chiếu"], ["tunnel_zoom", "Đường hầm zoom", "motion", "Các lớp khung hình hút vào tâm"], ["chromatic_wave", "Sóng sắc màu", "party", "Những dải màu gợn qua khung"], ["kaleido", "Kính vạn hoa", "lens", "Các mảnh ảnh xoay đối xứng"], ["watercolor", "Màu nước", "lens", "Màu dịu và lớp giấy chuyển sáng"], ["heat_wave", "Sóng nhiệt", "nature", "Khung hình uốn bởi hơi nóng"], ["frosted_glass", "Kính phủ sương", "lens", "Sương lạnh chuyển động ở viền"], ["digital_rain", "Mưa mã số", "party", "Các cột ký tự phát sáng"], ["camera_drift", "Máy quay trôi", "motion", "Chuyển động máy quay lượn nhẹ"], ["lightning", "Tia sét", "nature", "Tia sáng phân nhánh chuyển động"], ["retro_sprocket", "Phim cuộn", "retro", "Viền cuộn phim chạy hai bên"], ["ribbon", "Dải lụa sáng", "light", "Dải sáng uốn mềm qua khung"]];
  catalog.push(...extraCatalog.map(([id,name,category,description])=>({id,name,category,description})));const extraIds=new Set(extraCatalog.map(e=>e[0]));
  let factory=null;
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  const random=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  const buffers=new WeakMap();
  function setCanvasFactory(fn){factory=fn;}
  function buffer(owner,key,w,h){let entry=buffers.get(owner);if(!entry){entry={};buffers.set(owner,entry);}let c=entry[key];if(!c){c=factory?factory(w,h):root.document.createElement('canvas');entry[key]=c;}if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;return c;}
  function draw(ctx,source,options={}){
    const value=Number(options.amount??.7),w=options.width||450,h=options.height||450,t=Number(options.time)||0,a=clamp(Number.isFinite(value)?value:.7,0,1),id=options.effect||'none';
    ctx.save();const parentAlpha=ctx.globalAlpha;if(parentAlpha<=0){ctx.restore();return;}ctx.beginPath();ctx.rect(-w/2,-h/2,w,h);ctx.clip();
    const base=(scale=1,dx=0,dy=0)=>ctx.drawImage(source,-w*scale/2+dx,-h*scale/2+dy,w*scale,h*scale);
    const density=Math.max(.2,Math.hypot(ctx.getTransform().a,ctx.getTransform().b));
    if(a===0||id==='none'){base();ctx.restore();return;}
    if(id.startsWith('capcut:')&&root.TibeCapCut?.draw(ctx,source,{effect:id,amount:a,time:t,width:w,height:h})){ctx.restore();return;}
    if(extraIds.has(id)){drawExtra(ctx,source,{id,w,h,t,a,parentAlpha,density});ctx.restore();return;}
    if(id==='shake'){base(1+.08*a,Math.sin(t*39)*w*.012*a,Math.cos(t*31)*h*.009*a);}
    else if(id==='pulse'){base(1+a*.065*(1+Math.sin(t*5.1))/2);}
    else if(id==='blur'){ctx.filter=`blur(${(1.5+Math.sin(t*2)*.5)*4*a*density}px)`;base(1.04);ctx.filter='none';}
    else if(id==='orbit'){ctx.save();ctx.rotate(Math.sin(t*2.7)*.045*a);base(1.12);ctx.restore();}
    else if(id==='old_movie'){ctx.filter=`grayscale(${.85*a}) sepia(${.4*a}) contrast(1.12)`;base(1.025,Math.sin(t*27)*w*.003*a,Math.cos(t*19)*h*.003*a);ctx.filter='none';}
    else if(['neon_edges','posterize','duotone'].includes(id)){
      const pw=256,ph=Math.max(2,Math.round(pw*h/w)),off=buffer(ctx.canvas,'pixel_fx',pw,ph),oc=off.getContext('2d');oc.clearRect(0,0,pw,ph);oc.drawImage(source,0,0,pw,ph);const frame=oc.getImageData(0,0,pw,ph),data=frame.data,original=new Uint8ClampedArray(data),levels=4+Math.floor((Math.sin(t*2)+1)*2);
      for(let y=0;y<ph;y++)for(let x=0;x<pw;x++){const i=(y*pw+x)*4;if(id==='neon_edges'){const right=(y*pw+Math.min(pw-1,x+1))*4,down=(Math.min(ph-1,y+1)*pw+x)*4;let edge=0;for(let c=0;c<3;c++)edge+=Math.abs(original[i+c]-original[right+c])+Math.abs(original[i+c]-original[down+c]);const v=Math.min(255,edge*2.2);data[i]=v*(.5+.4*Math.sin(t*2));data[i+1]=v*.8;data[i+2]=v;}
        else if(id==='posterize'){for(let c=0;c<3;c++)data[i+c]=Math.round(original[i+c]/255*levels)/levels*255;}
        else{const lum=(original[i]*.2126+original[i+1]*.7152+original[i+2]*.0722)/255,shift=(Math.sin(t*1.5)+1)*.5;data[i]=30+lum*(190+25*shift);data[i+1]=35+lum*(150-60*shift);data[i+2]=90+lum*(85+60*shift);}
      }oc.putImageData(frame,0,0);base();ctx.save();ctx.globalAlpha=parentAlpha*a;ctx.drawImage(off,-w/2,-h/2,w,h);ctx.restore();
    }
    else if(id==='pixelate'){
      const size=Math.max(4,Math.round(12+(1-a)*80+Math.sin(t*2)*4)),off=buffer(ctx.canvas,'pixels',size,Math.max(2,Math.round(size*h/w))),oc=off.getContext('2d');oc.clearRect(0,0,off.width,off.height);oc.drawImage(source,0,0,off.width,off.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(off,-w/2,-h/2,w,h);
    }else if(id==='ripple'){
      base();
      for(let i=0;i<48;i++){const sy=Math.floor(source.height*i/48),sh=Math.ceil(source.height/48),dy=-h/2+h*i/48,dx=Math.sin(i*.43+t*4)*w*.014*a;ctx.drawImage(source,0,sy,source.width,Math.min(sh,source.height-sy),-w/2+dx,dy,w,h/48+1);}
    }else if(id==='mirror'){
      ctx.save();ctx.beginPath();ctx.rect(-w/2,-h/2,w/2,h);ctx.clip();base(1.02+Math.sin(t)*.02*a);ctx.restore();ctx.save();ctx.beginPath();ctx.rect(0,-h/2,w/2,h);ctx.clip();ctx.scale(-1,1);base(1.02+Math.sin(t)*.02*a);ctx.restore();
    }else{
      if(id==='glow')ctx.filter=`brightness(${1+.1*a}) saturate(.94)`;
      if(id==='warm_film')ctx.filter=`sepia(${.3*a}) saturate(${1-.2*a}) contrast(1.05)`;
      if(id==='cinema')ctx.filter=`contrast(${1+.15*a}) saturate(${1-.16*a})`;
      if(!['rgb_split','prism'].includes(id))base(id==='cinema'?1+.012*a*(1+Math.sin(t))/2:1);ctx.filter='none';
      if(id==='glow'||id==='dream_haze'){
        ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=parentAlpha*(.13+.06*Math.sin(t*2))*a;ctx.filter=`blur(${12*a*density}px)`;base(1.07);ctx.restore();
      }
      if(id==='zoom_blur'){
        ctx.save();for(let i=1;i<=7;i++){ctx.globalAlpha=parentAlpha*a*.055;const k=1+i*.012*(.6+.4*Math.sin(t*3));base(k);}ctx.restore();
      }
      if(id==='rgb_split'||id==='prism'){
        const off=buffer(ctx.canvas,'tint',source.width,source.height),oc=off.getContext('2d'),mixed=buffer(ctx.canvas,'rgb',source.width,source.height),mc=mixed.getContext('2d');
        const shift=w*(id==='prism'?.045:.012)*a*(.7+.3*Math.sin(t*5));
        mc.globalCompositeOperation='source-over';mc.clearRect(0,0,mixed.width,mixed.height);mc.fillStyle='#000';mc.fillRect(0,0,mixed.width,mixed.height);
        // Isolate real color channels, then recombine them at different offsets.
        // A solid-color source-in tint would wash out the photograph instead.
        for(const [color,dx] of [['#ff0000',-shift],['#00ff00',0],['#0000ff',shift]]){oc.globalCompositeOperation='source-over';oc.clearRect(0,0,off.width,off.height);oc.drawImage(source,0,0);oc.globalCompositeOperation='multiply';oc.fillStyle=color;oc.fillRect(0,0,off.width,off.height);oc.globalCompositeOperation='destination-in';oc.drawImage(source,0,0);mc.globalCompositeOperation='screen';mc.drawImage(off,dx/w*source.width,0);}
        mc.globalCompositeOperation='destination-in';mc.drawImage(source,0,0);mc.globalCompositeOperation='source-over';ctx.drawImage(mixed,-w/2,-h/2,w,h);
      }
      if(id==='glitch'){
        for(let i=0;i<7;i++){const n=Math.floor(t*12)+i*19,sy=Math.floor(random(n)*source.height*.94),sh=Math.max(1,Math.floor(source.height*(.01+random(n+1)*.04))),dx=(random(n+2)-.5)*w*.16*a;ctx.drawImage(source,0,sy,source.width,Math.min(sh,source.height-sy),-w/2+dx,-h/2+sy/source.height*h,w,sh/source.height*h);}
        ctx.fillStyle=`rgba(76,215,225,${.12*a})`;ctx.fillRect(-w/2,-h/2+((t*.7)%1)*h,w,h*.007);
      }
    }
    if(id==='film'||id==='warm_film'){
      ctx.save();for(let i=0;i<110;i++){const n=i+Math.floor(t*16)*313;ctx.fillStyle=i%2?`rgba(255,249,221,${.25*a})`:`rgba(32,24,35,${.19*a})`;ctx.fillRect(-w/2+random(n)*w,-h/2+random(n+5)*h,w*.003,h*.002);}ctx.restore();
    }
    if(id==='flash'){ctx.fillStyle=`rgba(255,250,240,${Math.pow(Math.max(0,Math.sin(t*4.5)),12)*a*.6})`;ctx.fillRect(-w/2,-h/2,w,h);}
    if(id==='light_leak'||id==='dream_haze'){
      const x=-w*.8+((t*.17)%1)*w*1.6,g=ctx.createRadialGradient(x,h*.2,w*.02,x,h*.2,w*.8);g.addColorStop(0,id==='light_leak'?`rgba(255,191,121,${a*.55})`:`rgba(255,246,233,${a*.45})`);g.addColorStop(.45,`rgba(255,145,169,${a*.15})`);g.addColorStop(1,'transparent');ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle=g;ctx.fillRect(-w/2,-h/2,w,h);ctx.restore();
    }
    if(id==='scanlines'){ctx.save();ctx.globalAlpha=parentAlpha*a*.19;ctx.fillStyle='#152031';for(let y=-h/2+((t*15)%5);y<h/2;y+=5)ctx.fillRect(-w/2,y,w,1);ctx.fillStyle='#fff6df';ctx.globalAlpha=parentAlpha*a*.12;ctx.fillRect(-w/2,-h/2+(t*.2%1)*h,w,h*.04);ctx.restore();}
    if(id==='vignette'){const g=ctx.createRadialGradient(0,0,w*.12,0,0,Math.hypot(w,h)/2);g.addColorStop(0,'transparent');g.addColorStop(1,`rgba(23,15,30,${a*(.6+.1*Math.sin(t*2))})`);ctx.fillStyle=g;ctx.fillRect(-w/2,-h/2,w,h);}
    if(id==='cinema'){ctx.fillStyle=`rgba(13,14,20,${a})`;ctx.fillRect(-w/2,-h/2,w,h*.11);ctx.fillRect(-w/2,h*.39,w,h*.11);}
    if(id==='tilt_shift'){ctx.save();ctx.filter=`blur(${5*a*density}px)`;ctx.beginPath();const band=h*(.16+.025*Math.sin(t*2));ctx.rect(-w/2,-h/2,w,band);ctx.rect(-w/2,h/2-band,w,band);ctx.clip();base(1.03);ctx.restore();}
    if(id==='double_exposure'||id==='echo_trail'){ctx.save();ctx.globalCompositeOperation='screen';const count=id==='double_exposure'?1:4;for(let i=1;i<=count;i++){ctx.globalAlpha=parentAlpha*a*(id==='double_exposure'?.24:.09);base(1+i*.01,Math.sin(t*2-i*.25)*w*.035*i*a,Math.cos(t*1.7-i*.2)*h*.012*i*a);}ctx.restore();}
    if(id==='halftone'){ctx.save();ctx.fillStyle='#292338';ctx.globalAlpha=parentAlpha*a*.3;const step=w/50;for(let y=-h/2;y<h/2;y+=step)for(let x=-w/2;x<w/2;x+=step){ctx.beginPath();ctx.arc(x+Math.sin(t)*step*.4,y,step*.18,0,Math.PI*2);ctx.fill();}ctx.restore();}
    if(id==='spotlight'){const px=Math.sin(t*1.4)*w*.24,py=Math.cos(t*1.1)*h*.18,g=ctx.createRadialGradient(px,py,w*.1,px,py,Math.hypot(w,h)*.7);g.addColorStop(0,'transparent');g.addColorStop(.5,`rgba(23,18,38,${.38*a})`);g.addColorStop(1,`rgba(23,18,38,${.8*a})`);ctx.fillStyle=g;ctx.fillRect(-w/2,-h/2,w,h);}
    if(id==='disco'||id==='bokeh'){ctx.save();ctx.globalCompositeOperation='screen';for(let i=0;i<(id==='bokeh'?16:5);i++){const px=-w/2+((random(i+2)+Math.sin(t*.4+i)*.15+1)%1)*w,py=-h/2+((random(i+12)+t*(id==='bokeh'?.035:.09))%1)*h,r=w*(id==='bokeh'?.035:.35),g=ctx.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,`hsla(${(i*67+t*30)%360},80%,78%,${a*(id==='bokeh'?.5:.38)})`);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(px-r,py-r,r*2,r*2);}ctx.restore();}
    if(id==='rainbow'){const g=ctx.createLinearGradient(-w/2+Math.sin(t)*w*.3,-h/2,w/2,h/2);['#f57a88','#ffdb8f','#a4d7bb','#91c9e5','#b4a5df'].forEach((color,i)=>g.addColorStop(i/4,color));ctx.save();ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=parentAlpha*a*.55;ctx.fillStyle=g;ctx.fillRect(-w/2,-h/2,w,h);ctx.restore();}
    if(id==='sunrays'){ctx.save();ctx.translate(-w*.28,-h*.36);ctx.rotate(t*.13);ctx.fillStyle='#fff7cc';ctx.globalAlpha=parentAlpha*a*.1;for(let i=0;i<12;i++){ctx.rotate(Math.PI/6);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(w*2,-w*.12);ctx.lineTo(w*2,w*.12);ctx.closePath();ctx.fill();}ctx.restore();}
    if(id==='confetti'||id==='bubbles'||id==='dust'){ctx.save();const count=id==='dust'?65:28;for(let i=0;i<count;i++){const px=-w/2+random(i+3)*w+Math.sin(t+i)*w*.012,py=-h/2+((random(i+7)+(id==='confetti'?t:-t)*(.04+random(i+9)*.09)+100)%1)*h,size=w*(id==='dust'?.0015:.008+random(i+18)*.007);ctx.save();ctx.translate(px,py);ctx.rotate(t+i);ctx.globalAlpha=parentAlpha*a*(.25+random(i+14)*.5);ctx.fillStyle=id==='dust'?'#ffe1a2':['#f5a2b4','#fbd773','#a5d4d1','#b5aeec'][i%4];if(id==='bubbles'){ctx.strokeStyle='#fff9f0';ctx.lineWidth=Math.max(.8,w*.002);ctx.beginPath();ctx.arc(0,0,size*1.9,0,Math.PI*2);ctx.stroke();}else if(id==='dust'){ctx.beginPath();ctx.arc(0,0,size,0,Math.PI*2);ctx.fill();}else ctx.fillRect(-size,-size/2,size*2,size);ctx.restore();}ctx.restore();}
    if(id==='old_movie'){ctx.save();ctx.globalAlpha=parentAlpha*a*.22;ctx.fillStyle='#fff4c9';for(let i=0;i<4;i++)ctx.fillRect(-w/2+((random(i+Math.floor(t*8))+t*.02)%1)*w,-h/2,w*.002,h);ctx.restore();}
    if(['sparkles','snowfall','rain','floating_hearts'].includes(id)){
      ctx.save();ctx.lineCap='round';
      const count=id==='sparkles'?22:id==='floating_hearts'?14:36;
      for(let i=0;i<count;i++){
        const speed=.08+random(i+31)*.16,px=-w/2+random(i+7)*w;
        let py=-h/2+((random(i+17)+t*speed)%1)*h;
        if(id==='floating_hearts')py=h/2-((random(i+17)+t*speed)%1)*h;
        const size=(.005+random(i+48)*.01)*w;
        ctx.globalAlpha=parentAlpha*a*(.3+random(i+57)*.6);
        if(id==='rain'){ctx.strokeStyle='#ddedff';ctx.lineWidth=Math.max(.7,w*.002);ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-w*.012,py+h*.035);ctx.stroke();}
        else if(id==='snowfall'){ctx.fillStyle='#fffdf9';ctx.beginPath();ctx.arc(px+Math.sin(t+i)*w*.008,py,size*.45,0,Math.PI*2);ctx.fill();}
        else if(id==='floating_hearts'){ctx.save();ctx.translate(px+Math.sin(t+i)*w*.018,py);ctx.scale(size/12,size/12);ctx.fillStyle=i%2?'#ffd6d4':'#f8a9b9';ctx.beginPath();ctx.moveTo(0,7);ctx.bezierCurveTo(-17,-4,-7,-15,0,-6);ctx.bezierCurveTo(7,-15,17,-4,0,7);ctx.fill();ctx.restore();}
        else{ctx.globalAlpha*=Math.pow((Math.sin(t*3+i*5)+1)/2,2);ctx.strokeStyle='#fff4cd';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(px-size,py);ctx.lineTo(px+size,py);ctx.moveTo(px,py-size);ctx.lineTo(px,py+size);ctx.stroke();}
      }ctx.restore();
    }
    ctx.restore();
  }
  function drawExtra(ctx,source,{id,w,h,t,a,parentAlpha,density}){
    const base=(k=1,dx=0,dy=0)=>ctx.drawImage(source,-w*k/2+dx,-h*k/2+dy,w*k,h*k),alpha=n=>{ctx.globalAlpha=parentAlpha*n*a;};
    if(id==='heartbeat'){const phase=(t*1.3)%1,k=Math.exp(-(((phase-.12)/.055)**2))+.6*Math.exp(-(((phase-.32)/.07)**2));base(1+.09*a*k);return;}
    if(id==='camera_drift'){ctx.rotate(Math.sin(t*.7)*.025*a);base(1.13,Math.sin(t*.9)*w*.03*a,Math.cos(t*.73)*h*.025*a);return;}
    if(id==='projector'){ctx.filter=`grayscale(${.9*a}) sepia(${.32*a}) brightness(${1+Math.sin(t*31)*.04*a})`;base(1.025,Math.sin(t*37)*w*.004*a,Math.cos(t*29)*h*.004*a);ctx.filter='none';}
    else if(id==='watercolor'){ctx.filter=`saturate(${1-.35*a}) contrast(${1-.15*a}) brightness(${1+.08*a})`;base();ctx.filter='none';}
    else base();
    ctx.save();
    if(['starfield','meteors','fireflies','autumn_leaves','sakura_petals'].includes(id)){
      const count=id==='starfield'?75:id==='meteors'?12:38;ctx.shadowBlur=id==='fireflies'?9*density:0;ctx.shadowColor='#fff6a4';
      for(let i=0;i<count;i++){const seed=i+11,x=((random(seed)*1.4+t*(id==='meteors'?.38:id==='fireflies'?.025:.045))%1.4-.7)*w,y=((random(seed+90)*1.5+t*(id==='meteors'?.42:id==='starfield'?.025:.065))%1.5-.75)*h,r=(1+random(seed+31)*4)*Math.min(w,h)/350;alpha(.3+.6*(.5+.5*Math.sin(t*(1+random(seed))+i)));ctx.save();ctx.translate(x,y);ctx.rotate(t*(.5+random(i+4))+i);ctx.fillStyle=id==='autumn_leaves'?['#e6ad51','#d88549','#eabf62'][i%3]:id==='sakura_petals'?'#ffb5d1':id==='fireflies'?'#fff1a0':'#ffffff';ctx.beginPath();if(id==='meteors'){ctx.strokeStyle='#ffffff';ctx.lineWidth=r/2;ctx.moveTo(-r*9,-r*9);ctx.lineTo(r,r);ctx.stroke();}else if(id==='autumn_leaves'||id==='sakura_petals'){ctx.ellipse(0,0,r*1.7,r*.8,0,0,Math.PI*2);ctx.fill();}else{ctx.arc(0,0,r*.6,0,Math.PI*2);ctx.fill();}ctx.restore();}
    }else if(['aurora','ribbon','chromatic_wave'].includes(id)){
      ctx.globalCompositeOperation='screen';const colors=id==='aurora'?['#44deb2','#9a71fa','#63bde9']:id==='ribbon'?['#ffd7bb','#f8b8c8','#fff2c6']:['#ff869c','#85c6ff','#bca0ff'];
      for(let band=0;band<3;band++){ctx.beginPath();for(let x=0;x<=w;x+=w/60){const y=Math.sin(x/w*5+t*1.1+band)*h*.15+band*h*.16-h*.2;if(!x)ctx.moveTo(x-w/2,y);else ctx.lineTo(x-w/2,y);}for(let x=w;x>=0;x-=w/60){const y=Math.sin(x/w*5+t*1.1+band)*h*.15+band*h*.16-h*.2+h*.13;ctx.lineTo(x-w/2,y);}ctx.closePath();alpha(.2);ctx.fillStyle=colors[band];ctx.filter=`blur(${7*density}px)`;ctx.fill();}ctx.filter='none';
    }else if(id==='heat_wave'){for(let i=0;i<60;i++){const sy=source.height*i/60,sh=Math.min(source.height-sy,source.height/60+1),dx=Math.sin(i*.27+t*4)*w*.018*a;ctx.drawImage(source,0,sy,source.width,sh,-w/2+dx,-h/2+h*i/60,w,h/60+1);}}
    else if(id==='kaleido'){alpha(1);ctx.translate(0,0);for(let i=0;i<6;i++){ctx.save();ctx.rotate(i*Math.PI/3+t*.18*a);ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,Math.hypot(w,h),0,Math.PI/3);ctx.closePath();ctx.clip();if(i%2)ctx.scale(-1,1);base(1.1);ctx.restore();}}
    else if(id==='light_sweep'){ctx.rotate(-.35);const x=Math.sin(t*1.4)*w*.65,g=ctx.createLinearGradient(x-w*.18,0,x+w*.18,0);g.addColorStop(0,'#ffffff00');g.addColorStop(.5,'#fff3db');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.globalCompositeOperation='screen';alpha(.38);ctx.fillRect(-w,-h,w*2,h*2);}
    else if(id==='strobe'){ctx.fillStyle='#fff7ef';alpha(.12*(.5+.5*Math.sin(t*9)));ctx.fillRect(-w/2,-h/2,w,h);}
    else if(id==='speed_lines'){ctx.strokeStyle='#fff8ea';ctx.lineWidth=Math.max(1,w/500);for(let i=0;i<48;i++){const theta=i*Math.PI/24+.1*Math.sin(t*2),k=.18+((random(i)*.7+t*.5)%1)*.5;alpha(.3);ctx.beginPath();ctx.moveTo(Math.cos(theta)*w*k,Math.sin(theta)*h*k);ctx.lineTo(Math.cos(theta)*w,Math.sin(theta)*h);ctx.stroke();}}
    else if(id==='radar_scan'){ctx.rotate(t*1.5);alpha(.22);const g=ctx.createLinearGradient(0,0,w/2,0);g.addColorStop(0,'#72ffce00');g.addColorStop(1,'#72ffce');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,Math.hypot(w,h),-.4,0);ctx.closePath();ctx.fill();ctx.strokeStyle='#72ffce';ctx.lineWidth=w/300;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(w,0);ctx.stroke();}
    else if(id==='film_frame'||id==='retro_sprocket'){alpha(.9);ctx.fillStyle='#22202b';const sw=w*(id==='film_frame'?.045:.065);ctx.fillRect(-w/2,-h/2,sw,h);ctx.fillRect(w/2-sw,-h/2,sw,h);ctx.fillStyle='#fff4e0';const step=h/11;for(let i=-1;i<13;i++){const y=-h/2+i*step+(t*.5%1)*step;ctx.fillRect(-w/2+sw*.2,y,sw*.6,step*.48);ctx.fillRect(w/2-sw*.8,y,sw*.6,step*.48);}}
    else if(id==='tunnel_zoom'){for(let i=1;i<=5;i++){ctx.save();const k=.25+((i/5+t*.16)%1)*.8;ctx.beginPath();ctx.rect(-w*k/2,-h*k/2,w*k,h*k);ctx.clip();alpha(.13);base(k);ctx.restore();}}
    else if(id==='digital_rain'){ctx.font=`${Math.max(9,w/35)}px monospace`;ctx.fillStyle='#81ffbe';const size=w/24;for(let col=0;col<24;col++){const head=((random(col+50)+t*.2)%1.5)*h-h*.7;for(let row=0;row<8;row++){alpha(.55*(1-row/9));ctx.fillText(String((col*7+row*3+Math.floor(t*8))%2),-w/2+col*size,head-row*size);}}}
    else if(id==='lightning'){ctx.strokeStyle='#e2ebff';ctx.shadowColor='#9daeff';ctx.shadowBlur=9*density;ctx.lineWidth=w/220;alpha(.45+.4*Math.sin(t*13)**2);ctx.beginPath();for(let i=0;i<14;i++){const x=Math.sin(i*17+Math.floor(t*5))*w*.1,y=-h/2+i*h/13;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
    if(['frosted_glass','watercolor','projector'].includes(id)){const x=Math.sin(t*.7)*w*.1,y=Math.cos(t*.8)*h*.1,g=ctx.createRadialGradient(x,y,Math.min(w,h)*.15,0,0,Math.hypot(w,h)*.6);g.addColorStop(0,'#ffffff00');g.addColorStop(1,id==='frosted_glass'?'#d8efff':'#fff2d9');ctx.fillStyle=g;alpha(id==='frosted_glass'?.7:.25);ctx.fillRect(-w/2,-h/2,w,h);}
    ctx.restore();
  }
  const api={catalog,draw,setCanvasFactory};
  if(typeof module!=='undefined')module.exports=api;else root.TibeEffects=api;
})(typeof window==='undefined'?globalThis:window);
