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
  function parse(input,options={}){
    const text=String(input||'').trim();if(!text)throw Error('Nhập kịch bản hoặc JSON phân cảnh.');
    if(text.length>500000)throw Error('Kịch bản quá dài.');
    if(/^[{[]/.test(text)){
      try{return JSON.parse(text);}catch{throw Error('JSON chưa đúng định dạng. Kiểm tra dấu phẩy và dấu ngoặc.');}
    }
    return {name:options.name||'Câu chuyện mới',ratio:options.ratio||'9:16',scenes:text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(text=>({text,duration:options.duration||4}))};
  }
  function build(plan,options={}){
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
      const asset=scene.mediaId?media[scene.mediaId]:visuals[index%Math.max(1,visuals.length)];
      if(scene.mediaId&&(!asset||!['image','video'].includes(asset.type)))throw Error('Tư liệu hình ảnh không tồn tại: '+scene.mediaId);
      const sourceIn=number(scene.sourceIn,0,0,21600,'Điểm vào tư liệu');
      if(asset?.type==='video'){
        const available=Number(asset.duration)-sourceIn;
        if(!Number.isFinite(available)||available<.5)throw Error('Video '+asset.name+' không còn đủ thời lượng.');
        if(duration>available){duration=available;warnings.push('Cảnh '+(index+1)+': rút còn '+duration.toFixed(1)+' giây theo video gốc.');}
      }
      const effect=look(scene.effect,'effects','none'),filter=look(scene.filter,'filters','original'),transition=look(scene.transition,'transitions',index?'dissolve':'none');
      if(!asset&&!text.trim())throw Error('Cảnh '+(index+1)+' cần tư liệu hoặc văn bản.');
      if(asset)clips.push({track:'video',mediaId:asset.id,title,start,duration,sourceIn,fit:'cover',effect,filter,transition,transitionDuration:Math.min(.5,duration/3),anim:'none'});
      if(text.trim())clips.push({track:'text',title:text,start,duration,textStyle:'subtitle',fontSize:30,color:'#ffffff',yOffset:asset?450*preset.height/preset.width*.26:0,anim:'none'});
      start+=duration;if(start>21600)throw Error('Tổng thời lượng không được quá 6 giờ.');
    });
    if(plan.music){
      const asset=media[plan.music.mediaId];if(!asset||asset.type!=='audio')throw Error('Không tìm thấy tư liệu nhạc.');
      const length=Number(asset.duration);if(!Number.isFinite(length)||length<=0)throw Error('Tư liệu nhạc chưa có thời lượng.');
      const volume=number(plan.music.volume,.35,0,2,'Âm lượng nhạc');
      clips.push({track:'audio',mediaId:asset.id,title:asset.name,start:0,duration:Math.min(start,length),volume,fadeIn:Math.min(.5,start/4),fadeOut:Math.min(1,start/4)});
    }
    return {project:{format:'clipcut-project',version:2,name:String(plan.name||'Câu chuyện mới').slice(0,120),ratio,clips,media,canvas:{enabled:true,color:'#383a50',blur:false}},duration:start,warnings};
  }
  const api={presets,parse,build};root.TibeCreator=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
