(function(root){
  'use strict';
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  // Original tibe grades. Local .cube LUTs retain their own source metadata.
  const filters=[
    ['original','Nguyên bản','all',1,1,1,0,0,0],
    ['cream','Cream','portrait',1.05,.98,.86,.16,0,0],['blush','Blush','portrait',1.03,1,1.14,.15,-10,0],
    ['breeze','Breeze','travel',1.03,1.04,1.08,0,10,0],['dream','Dream','portrait',1.08,.91,.92,.2,0,0],
    ['lomo','Lomo','retro',1,1.24,1.28,.1,0,0],['noir','Monochrome','mono',1,1.12,1,0,0,1],
    ['teal_orange','Teal & Orange','cinema',1.01,1.2,1.15,.19,-14,0],['cinema_cool','Cinema Cool','cinema',.98,1.2,.83,.07,13,0],
    ['golden_hour','Golden Hour','travel',1.06,1.09,1.2,.33,-6,0],['matte_film','Matte Film','retro',1.08,.83,.75,.24,0,0],
    ['porcelain','Porcelain','portrait',1.12,.91,.72,.07,-5,0],['rose_milk','Rose Milk','portrait',1.08,.96,.93,.25,-19,0],
    ['soft_peach','Soft Peach','portrait',1.09,.95,1.06,.29,-9,0],['clean','Clean','portrait',1.05,1.06,.98,0,0,0],
    ['olive','Olive','travel',1.02,1.03,.83,.36,18,0],['ocean','Ocean','travel',1.03,1.16,1.3,.02,16,0],
    ['alpine','Alpine','travel',1.08,1.14,.82,.04,12,0],['tropical','Tropical','travel',1.04,1.12,1.43,.08,-4,0],
    ['sunset','Sunset','travel',1.04,1.15,1.25,.4,-17,0],['amber','Amber','cinema',.99,1.2,.91,.48,-5,0],
    ['steel','Steel','cinema',.94,1.27,.58,.08,17,0],['blockbuster','Blockbuster','cinema',.97,1.34,1.12,.12,-13,0],
    ['faded_denim','Faded Denim','retro',1.06,.85,.71,.21,23,0],['polaroid','Polaroid','retro',1.1,.92,1.1,.28,-7,0],
    ['vintage_70','Vintage 70','retro',1.03,.93,.76,.56,5,0],['sepia','Sepia','retro',1.04,1.05,.65,.9,0,0],
    ['bw_soft','B&W Soft','mono',1.12,.85,1,0,0,1],['bw_dramatic','B&W Drama','mono',.97,1.7,1,0,0,1],
    ['bw_silver','Silver','mono',1.12,1.21,1,0,0,1],['coffee','Coffee','food',.97,1.2,.86,.51,-5,0],
    ['fresh_food','Fresh','food',1.1,1.13,1.31,.05,-2,0],['caramel','Caramel','food',1.05,1.16,1.06,.43,-9,0],
    ['matcha','Matcha','food',1.05,.98,.92,.29,29,0],['night_city','Night City','cinema',.94,1.39,1.24,.05,21,0],
    ['lavender','Lavender','portrait',1.07,.97,.84,.11,-25,0],['desert','Desert','travel',1.06,1.12,.72,.46,-2,0]
  ].map(([id,name,category,b,c,s,se,h,g])=>({id,name,category,b,c,s,se,h,g}));
  filters.push(...[["sakura", "Sakura", "portrait", 1.08, 0.93, 1.04, 0.15, -28, 0], ["peach_skin", "Peach Skin", "portrait", 1.11, 0.94, 0.96, 0.21, -12, 0], ["milk_tea", "Milk Tea", "portrait", 1.12, 0.88, 0.67, 0.31, -4, 0], ["soft_mint", "Soft Mint", "portrait", 1.09, 0.92, 0.79, 0.08, 20, 0], ["k_clear", "K Clear", "portrait", 1.13, 1.02, 0.88, 0.03, -3, 0], ["pink_glow", "Pink Glow", "portrait", 1.08, 1.06, 1.22, 0.13, -31, 0], ["studio_neutral", "Studio Neutral", "portrait", 1.03, 1.08, 0.91, 0, 2, 0], ["soft_lilac", "Soft Lilac", "portrait", 1.1, 0.89, 0.92, 0.06, -39, 0], ["arctic", "Arctic", "travel", 1.12, 1.11, 0.72, 0.06, 27, 0], ["lagoon", "Lagoon", "travel", 1.04, 1.18, 1.37, 0.04, 29, 0], ["jade", "Jade", "travel", 0.99, 1.15, 1.05, 0.24, 36, 0], ["savanna", "Savanna", "travel", 1.06, 1.2, 1.01, 0.45, 9, 0], ["pacific", "Pacific", "travel", 1.03, 1.23, 1.09, 0.01, 35, 0], ["sahara", "Sahara", "travel", 1.13, 1.08, 0.81, 0.62, -12, 0], ["blue_hour", "Blue Hour", "travel", 0.93, 1.11, 1.08, 0.09, 41, 0], ["forest_fog", "Forest Fog", "travel", 1.09, 0.82, 0.61, 0.18, 33, 0], ["copper", "Copper", "cinema", 0.98, 1.24, 1.03, 0.62, -18, 0], ["midnight_blue", "Midnight Blue", "cinema", 0.87, 1.29, 0.86, 0.12, 49, 0], ["crimson", "Crimson", "cinema", 0.99, 1.21, 1.19, 0.22, -44, 0], ["neo_tokyo", "Neo Tokyo", "cinema", 0.96, 1.43, 1.5, 0.02, -27, 0], ["sci_noir", "Sci Noir", "cinema", 0.91, 1.36, 0.7, 0.08, 65, 0], ["analog_cinema", "Analog Cinema", "cinema", 1.04, 1.15, 0.76, 0.32, 5, 0], ["silver_screen", "Silver Screen", "cinema", 1.02, 1.4, 0.58, 0.11, 14, 0], ["warm_documentary", "Warm Documentary", "cinema", 1.05, 1.09, 0.93, 0.19, -2, 0], ["disposable", "Disposable", "retro", 1.12, 1.13, 1.12, 0.36, 12, 0], ["instant_fade", "Instant Fade", "retro", 1.18, 0.77, 0.81, 0.23, -17, 0], ["retro_90", "Retro 90", "retro", 1.02, 1.08, 0.89, 0.28, 24, 0], ["amber_fade", "Amber Fade", "retro", 1.11, 0.83, 0.62, 0.7, -9, 0], ["cool_print", "Cool Print", "retro", 1.08, 0.96, 0.82, 0.05, 44, 0], ["warm_paper", "Warm Paper", "retro", 1.18, 0.86, 0.59, 0.79, 3, 0], ["bakery", "Bakery", "food", 1.13, 1.09, 1.12, 0.27, -16, 0], ["berry", "Berry", "food", 1.07, 1.19, 1.4, 0.06, -20, 0], ["citrus", "Citrus", "food", 1.14, 1.16, 1.45, 0.15, 8, 0], ["espresso", "Espresso", "food", 0.9, 1.32, 0.74, 0.65, -8, 0], ["minimal_food", "Minimal Food", "food", 1.17, 0.98, 0.76, 0.08, 1, 0], ["green_market", "Green Market", "food", 1.08, 1.15, 1.31, 0.14, 17, 0], ["bw_charcoal", "Charcoal", "mono", 0.88, 1.85, 1, 0, 0, 1], ["bw_high_key", "High Key", "mono", 1.3, 0.99, 1, 0, 0, 1], ["bw_matte", "Matte Mono", "mono", 1.15, 0.7, 1, 0, 0, 1], ["bw_press", "Press", "mono", 1.07, 1.5, 1, 0, 0, 1]].map(([id,name,category,b,c,s,se,h,g])=>({id,name,category,b,c,s,se,h,g})));
  const localLuts=new Map();
  function cssFor(id,amount=1){const f=filters.find(x=>x.id===id)||filters[0],a=clamp(Number(amount)||0,0,1);if(f.id==='original'||f.lut)return 'none';return `brightness(${1+(f.b-1)*a}) contrast(${1+(f.c-1)*a}) saturate(${1+(f.s-1)*a}) sepia(${f.se*a}) hue-rotate(${f.h*a}deg) grayscale(${f.g*a})`;}
  function parseCube(text,title='LUT đã nhập'){
    let size=0,domainMin=[0,0,0],domainMax=[1,1,1],values=[];
    if(typeof text!=='string'||text.length>16*1024*1024)throw Error('LUT vượt giới hạn 16 MB.');
    for(const raw of text.split(/\r?\n/)){const line=raw.split('#')[0].trim();if(!line)continue;const parts=line.split(/\s+/),key=parts[0];
      if(key==='TITLE'){title=line.slice(5).trim().replace(/^"|"$/g,'');continue;}
      if(key==='LUT_1D_SIZE')throw Error('Chỉ hỗ trợ LUT 3D .cube.');
      if(key==='LUT_3D_SIZE'){size=Number(parts[1]);continue;}
      if(key==='DOMAIN_MIN'){domainMin=parts.slice(1).map(Number);continue;}if(key==='DOMAIN_MAX'){domainMax=parts.slice(1).map(Number);continue;}
      if(parts.length!==3||parts.some(v=>!Number.isFinite(Number(v))))throw Error('Dòng dữ liệu LUT không hợp lệ.');values.push(...parts.map(v=>Number(Number(v).toFixed(6))));
    }
    if(!Number.isInteger(size)||size<2||size>65||values.length!==size**3*3)throw Error('Kích thước hoặc số điểm LUT không hợp lệ.');
    if(domainMin.length!==3||domainMax.length!==3||domainMin.some((n,i)=>!Number.isFinite(n)||!Number.isFinite(domainMax[i])||domainMax[i]<=n))throw Error('Miền màu LUT không hợp lệ.');
    return {title:String(title).slice(0,100),size,domainMin,domainMax,values};
  }
  function registerLuts(entries={}){for(const [id,lut] of Object.entries(entries)){if(!id.startsWith('lut:')||!lut||!Number.isInteger(lut.size)||lut.size<2||lut.size>65||!Array.isArray(lut.values)||lut.values.length!==lut.size**3*3||lut.values.some(n=>!Number.isFinite(n)))continue;if(!Array.isArray(lut.domainMin)||!Array.isArray(lut.domainMax)||lut.domainMin.length!==3||lut.domainMax.length!==3||lut.domainMin.some((n,i)=>!Number.isFinite(n)||!Number.isFinite(lut.domainMax[i])||!(lut.domainMax[i]>n)))continue;const clean={...lut,title:String(lut.title||'LUT đã nhập').slice(0,100)};localLuts.set(id,clean);if(!filters.some(f=>f.id===id))filters.push({id,name:clean.title,category:'local',lut:true});}}
  function getLuts(){return Object.fromEntries(localLuts);}
  function projectLuts(){return Object.fromEntries([...localLuts].filter(([id])=>!id.startsWith('lut:concat-')));}
  function applyLut(frame,lut,amount=1){if(!lut)return frame;const a=clamp(Number(amount)||0,0,1);if(!a)return frame;const n=lut.size,v=lut.values,d=frame.data;
    for(let p=0;p<d.length;p+=4){if(!d[p+3])continue;const f=[0,1,2].map(k=>clamp((d[p+k]/255-lut.domainMin[k])/(lut.domainMax[k]-lut.domainMin[k]),0,1)*(n-1)),lo=f.map(Math.floor),hi=lo.map(x=>Math.min(n-1,x+1)),u=f.map((x,i)=>x-lo[i]);
      for(let channel=0;channel<3;channel++){let value=0;for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){const weight=(x?u[0]:1-u[0])*(y?u[1]:1-u[1])*(z?u[2]:1-u[2]),index=(((z?hi[2]:lo[2])*n+(y?hi[1]:lo[1]))*n+(x?hi[0]:lo[0]))*3+channel;value+=v[index]*weight;}d[p+channel]=d[p+channel]*(1-a)+clamp(value,0,1)*255*a;}
    }return frame;
  }
  const transitions=[['none','Cắt thẳng','basic'],['dissolve','Hòa tan','basic'],['wipe','Quét trái','wipe'],['wipe_right','Quét phải','wipe'],['wipe_up','Quét lên','wipe'],['wipe_down','Quét xuống','wipe'],['slide_left','Trượt trái','slide'],['slide_right','Trượt phải','slide'],['slide_up','Trượt lên','slide'],['slide_down','Trượt xuống','slide'],['push_left','Đẩy trái','slide'],['push_right','Đẩy phải','slide'],['zoom_in','Zoom vào','camera'],['zoom_out','Zoom ra','camera'],['spin','Xoay khung','camera'],['blur_cross','Mờ giao thoa','camera'],['iris','Mở tròn','wipe'],['diamond','Mở kim cương','wipe'],['blinds','Rèm dọc','wipe'],['checker','Ô bàn cờ','wipe'],['split_open','Tách giữa','wipe'],['split_close','Khép hai bên','wipe'],['flash_white','Chớp trắng','light'],['fade_black','Qua màu đen','light'],['glitch_wipe','Nhiễu quét','creative'],['pixel_dissolve','Khối ngẫu nhiên','creative'],['clock','Quét đồng hồ','wipe'],['bounce','Nảy khung','camera']].map(([id,name,category])=>({id,name,category}));
  function drawTransition(ctx,previous,next,{id='dissolve',progress=0,width=450,height=253}={}){
    const w=width,h=height,p=clamp(progress,0,1),q=p*p*(3-2*p),draw=(source,x=0,y=0,sw=w,sh=h)=>ctx.drawImage(source,x,y,sw,sh);
    ctx.save();const parentAlpha=ctx.globalAlpha;ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
    if(id==='none'||p>=1){draw(next);ctx.restore();return;}if(p<=0){draw(previous);ctx.restore();return;}
    if(id.startsWith('gl:')&&root.TibeGLTransitions?.draw(ctx,previous,next,{id,progress:p,width:w,height:h})){ctx.restore();return;}
    draw(previous);const fade=()=>{ctx.globalAlpha=parentAlpha*q;draw(next);};
    if(id==='dissolve'||id==='fade')fade();
    else if(id.startsWith('slide_')||id.startsWith('push_')){let x=0,y=0;if(id.endsWith('left'))x=w*(1-q);if(id.endsWith('right'))x=-w*(1-q);if(id.endsWith('up'))y=h*(1-q);if(id.endsWith('down'))y=-h*(1-q);if(id.startsWith('push_')){ctx.clearRect(0,0,w,h);draw(previous,id.endsWith('left')?-w*q:w*q,0);}draw(next,x,y);}
    else if(id==='zoom_in'||id==='zoom_out'||id==='bounce'||id==='spin'){
      ctx.translate(w/2,h/2);if(id==='spin')ctx.rotate((1-q)*Math.PI*.6);const scale=id==='zoom_out'?1+(1-q)*1.6:id==='bounce'?.2+.8*q+.16*Math.sin(q*Math.PI):.4+.6*q;ctx.scale(scale,scale);ctx.globalAlpha=parentAlpha*q;draw(next,-w/2,-h/2);
    }else if(id==='blur_cross'){ctx.filter=`blur(${Math.sin(p*Math.PI)*12}px)`;fade();}
    else if(id==='flash_white'||id==='fade_black'){ctx.clearRect(0,0,w,h);draw(p<.5?previous:next);ctx.fillStyle=id==='flash_white'?'#fffaf3':'#111019';ctx.globalAlpha=parentAlpha*Math.sin(p*Math.PI)**2;ctx.fillRect(0,0,w,h);}
    else{
      ctx.beginPath();
      if(id==='wipe'||id==='wipe_left')ctx.rect(0,0,w*q,h);else if(id==='wipe_right')ctx.rect(w*(1-q),0,w*q,h);else if(id==='wipe_up')ctx.rect(0,h*(1-q),w,h*q);else if(id==='wipe_down')ctx.rect(0,0,w,h*q);
      else if(id==='iris')ctx.arc(w/2,h/2,Math.hypot(w,h)/2*q,0,Math.PI*2);
      else if(id==='diamond'){const d=(w+h)*q;ctx.moveTo(w/2,h/2-d);ctx.lineTo(w/2+d,h/2);ctx.lineTo(w/2,h/2+d);ctx.lineTo(w/2-d,h/2);ctx.closePath();}
      else if(id==='clock'){ctx.moveTo(w/2,h/2);ctx.arc(w/2,h/2,Math.hypot(w,h),-Math.PI/2,-Math.PI/2+Math.PI*2*q);ctx.closePath();}
      else if(id==='blinds'){for(let i=0;i<12;i++)ctx.rect(i*w/12,0,w/12*q,h);}
      else if(id==='split_open')ctx.rect(w/2*(1-q),0,w*q,h);
      else if(id==='split_close'){ctx.rect(0,0,w*q/2,h);ctx.rect(w*(1-q/2),0,w*q/2,h);}
      else if(id==='checker'||id==='pixel_dissolve'){for(let y=0;y<8;y++)for(let x=0;x<12;x++){if(id==='checker'){const k=clamp(q*2-((x+y)%2),0,1);ctx.rect(x*w/12,y*h/8,w/12*k+.1,h/8*k+.1);}else if(((x*31+y*17)%97)/97<q)ctx.rect(x*w/12,y*h/8,w/12+.2,h/8+.2);}}
      else if(id==='glitch_wipe'){for(let y=0;y<16;y++)ctx.rect(0,y*h/16,w*clamp(q+Math.sin(y*11+p*17)*.12*Math.sin(p*Math.PI),0,1),h/16+.2);}
      else{fade();ctx.restore();return;}
      ctx.clip();draw(next);
    }ctx.restore();
  }
  const api={filters,cssFor,parseCube,registerLuts,getLuts,projectLuts,applyLut,transitions,drawTransition};
  if(typeof module!=='undefined')module.exports=api;else root.TibeLooks=api;
})(typeof window==='undefined'?globalThis:window);
