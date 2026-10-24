(function(root){
  'use strict';
  const presets=[
    {id:'shorts',name:'Shorts / Reels',detail:'Video dọc',ratio:'9:16',width:1080,height:1920},
    {id:'youtube',name:'YouTube',detail:'Video ngang',ratio:'16:9',width:1920,height:1080},
    {id:'square',name:'Bài đăng vuông',detail:'Facebook / Instagram',ratio:'1:1',width:1080,height:1080},
    {id:'portrait',name:'Bài đăng dọc',detail:'Khung hình 4:5',ratio:'4:5',width:1080,height:1350}
  ];
  function number(value,fallback,min,max,label){
    const n=value===undefined?fallback:Number(value);
    if(!Number.isFinite(n)||n<min||n>max)throw Error(label+' phải từ '+min+' đến '+max+'.');
    return n;
  }
  // Script kits are editable storyboards. Narration text never implies audio exists.
  function normalizeKit(plan){
    if(plan?.format!=='omera-youtube-kit')return plan;
    if(!Array.isArray(plan.shorts?.scenes))throw Error('Bộ kịch bản thiếu phân cảnh Shorts.');
    let next=0;
    const scenes=plan.shorts.scenes.map((s,i)=>{
      const duration=number(s.duration,3,.5,120,'Thời lượng cảnh '+(i+1));
      if(s.start!==undefined&&Math.abs(Number(s.start)-next)>.001)throw Error('Phân cảnh phải nối liên tục theo thời gian đã ghi.');
      next+=duration;
      const sourceIn=number(s.trim_in,0,0,21600,'Điểm vào tư liệu');
      if(s.trim_out!==undefined&&!(Number(s.trim_out)>sourceIn))throw Error('Điểm ra phải sau điểm vào.');
      return {...s,title:s.id||'Cảnh '+(i+1),text:String(s.ui_overlay||''),sourceIn,duration};
    });
    if(plan.shorts.duration_seconds!==undefined&&Math.abs(Number(plan.shorts.duration_seconds)-next)>.001)throw Error('Tổng phân cảnh khác thời lượng bộ kịch bản.');
    return {name:plan.topic+' · phân cảnh chưa có giọng',ratio:plan.shorts.ratio||'9:16',scenes,
      scriptKit:{topic:plan.topic,metadata:plan.metadata,loop_bridge:plan.shorts.loop_bridge,voice_ready:false,render_ready:false}};
  }
  function parse(input,options={}){
    const text=String(input||'').trim();if(!text)throw Error('Nhập kịch bản hoặc JSON phân cảnh.');
    if(text.length>500000)throw Error('Kịch bản quá dài.');
    if(/^[{[]/.test(text)){
      let value;try{value=JSON.parse(text);}catch{throw Error('JSON chưa đúng định dạng. Kiểm tra dấu phẩy và dấu ngoặc.');}
      return normalizeKit(value);
    }
    return {name:options.name||'Câu chuyện mới',ratio:options.ratio||'9:16',scenes:text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(text=>({text,duration:options.duration||4}))};
  }
  function build(plan,options={}){
    if(plan?.template==='FB_1000Follow_Sprint_Mode'){if(!root.TibeFBSprint)throw Error('Chưa tải FB Sprint engine.');return root.TibeFBSprint.build(plan,options);}
    plan=normalizeKit(plan);
    if(!plan||typeof plan!=='object'||!Array.isArray(plan.scenes)||!plan.scenes.length||plan.scenes.length>300)throw Error('Cần từ 1 đến 300 phân cảnh.');
    const ratio=plan.ratio||options.ratio||'9:16',preset=presets.find(p=>p.ratio===ratio);
    if(!preset)throw Error('Chỉ hỗ trợ tỷ lệ 9:16, 16:9, 1:1 hoặc 4:5.');
    const media=options.media||{},visuals=Object.values(media).filter(m=>['image','video'].includes(m.type));
    const clips=[],warnings=[];let start=0;
    const look=(id,type,fallback)=>{
      id=id||fallback;const ids=options[type];if(ids&&!ids.includes(id))throw Error('Không tìm thấy '+type+': '+id);return id;
    };
    plan.scenes.forEach((scene,index)=>{
      if(!scene||typeof scene!=='object')throw Error('Phân cảnh '+(index+1)+' không hợp lệ.');
      let duration=number(scene.duration,4,.5,120,'Thời lượng cảnh '+(index+1));
      const text=String(scene.text||'').slice(0,2000),title=String(scene.title||'Cảnh '+(index+1)).slice(0,120);
      // A kit must bind an explicit asset, never an unrelated random library item.
      const asset=scene.mediaId?media[scene.mediaId]:(plan.scriptKit?null:visuals[index%Math.max(1,visuals.length)]);
      if(scene.mediaId&&(!asset||!['image','video'].includes(asset.type)))throw Error('Tư liệu hình ảnh không tồn tại: '+scene.mediaId);
      const sourceIn=number(scene.sourceIn,0,0,21600,'Điểm vào tư liệu');
      if(asset?.type==='video'){
        const available=Number(asset.duration)-sourceIn;
        if(!Number.isFinite(available)||available<.5)throw Error('Video '+asset.name+' không còn đủ thời lượng.');
        if(duration>available){duration=available;warnings.push('Cảnh '+(index+1)+': rút còn '+duration.toFixed(1)+' giây theo video gốc.');}
      }
      const effect=look(scene.effect,'effects','none'),filter=look(scene.filter,'filters','original'),transition=look(scene.transition,'transitions',index?'dissolve':'none');
      if(!asset&&!text.trim())throw Error('Cảnh '+(index+1)+' cần tư liệu hoặc văn bản.');
      if(asset){
        const visual={track:'video',mediaId:asset.id,title,start,duration,sourceIn,fit:'cover',effect,filter,transition,transitionDuration:Math.min(.5,duration/3),anim:'none'};
        if(plan.scriptKit){const m=scene.camera_motion||{},base={xOffset:0,yOffset:0,rotation:0,opacity:1,scale:1};
          visual.keyframes=m.type==='fast_ease_out_zoom'?[{time:0,...base,scale:number(m.from,1.18,1,2,'Zoom đầu')},{time:Math.min(duration,number(m.seconds,.6,.1,3,'Thời gian zoom')),...base,scale:number(m.to,1,1,2,'Zoom cuối'),easing:[.16,1,.3,1]},{time:duration,...base}]:[{time:0,...base,scale:1.025,xOffset:number(m.x_from,-2,-100,100,'Pan đầu')},{time:duration,...base,scale:1.05,xOffset:number(m.x_to,2,-100,100,'Pan cuối')}];
        }clips.push(visual);
      }
      if(text.trim())clips.push({track:'text',title:text,start,duration,textStyle:'subtitle',fontSize:30,color:'#ffffff',yOffset:asset?450*preset.height/preset.width*.26:0,anim:'none'});
      start+=duration;if(start>21600)throw Error('Tổng thời lượng không được quá 6 giờ.');
    });
    if(plan.scriptKit)warnings.push('Phân cảnh chưa tạo giọng/SFX hoặc phụ đề đồng bộ. Gắn đúng tư liệu và kiểm tra bản xuất trước khi đăng.');
    if(plan.music){
      const asset=media[plan.music.mediaId];if(!asset||asset.type!=='audio')throw Error('Không tìm thấy tư liệu nhạc.');
      const length=Number(asset.duration);if(!Number.isFinite(length)||length<=0)throw Error('Tư liệu nhạc chưa có thời lượng.');
      const volume=number(plan.music.volume,.35,0,2,'Âm lượng nhạc');
      clips.push({track:'audio',mediaId:asset.id,title:asset.name,start:0,duration:Math.min(start,length),volume,fadeIn:Math.min(.5,start/4),fadeOut:Math.min(1,start/4)});
    }
    return {project:{format:'clipcut-project',version:2,name:String(plan.name||'Câu chuyện mới').slice(0,120),ratio,clips,media,canvas:{enabled:true,color:'#383a50',blur:false},...(plan.scriptKit?{production:{stage:'script_kit_storyboard',...plan.scriptKit,scenes:plan.scenes}}:{})},duration:start,warnings};
  }
  const api={presets,parse,build};root.TibeCreator=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
