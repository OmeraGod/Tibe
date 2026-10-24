/* Original FB teaching template. No reach, originality or follower guarantees. */
(function(root){'use strict';
const MODE='FB_1000Follow_Sprint_Mode',VERSION=1;
const clone=x=>JSON.parse(JSON.stringify(x));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function finite(v,min,max,label){const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error(label+' không hợp lệ.');return n;}
function text(v,max,label){if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(label+' bị thiếu hoặc quá dài.');return v.trim();}
function fps(v=30){if(v===59.94||v==='59.94'||v==='60000/1001')return{value:60000/1001,ratio:'60000/1001'};const n=Number(v);if(![24,30,60].includes(n))throw Error('FPS hỗ trợ: 24, 30, 59.94 hoặc 60.');return{value:n,ratio:String(n)};}
function validate(plan){
 if(!plan||plan.format!=='tibe-fb-sprint-kit'||plan.template!==MODE||plan.version!==VERSION)throw Error('Không đúng bộ FB Sprint phiên bản 1.');
 if(plan.duration!==35||plan.ratio!=='9:16')throw Error('FB Sprint dùng 35 giây, canvas 1080 × 1920.');
 text(plan.id,80,'Mã tập');text(plan.name,120,'Tên tập');fps(plan.output?.fps);
 if(!['stacked','side-by-side'].includes(plan.hook?.layout))throw Error('Chọn bố cục chia đôi màn hình.');
 for(const key of ['question','badLabel','goodLabel'])text(plan.hook[key],110,'Nhãn mở đầu');
 finite(plan.hook.fontSize,64,88,'Cỡ chữ Hook');
 if(plan.gift?.followRequired!==false||plan.gift?.autoSend!==false||plan.gift?.delivery!=='public-comment-image')throw Error('Sơ đồ cần có đường lấy công khai; mẫu này không tự gửi tin nhắn hoặc khóa bằng follow.');
 text(plan.gift.headline,150,'Tên sơ đồ');text(plan.gift.keyword,20,'Từ khóa');
 if(plan.affiliate?.url&&!/^https:\/\/(?:s\.shopee\.vn|shopee\.vn)\/[A-Za-z0-9/?&=_%.-]+$/.test(plan.affiliate.url))throw Error('Link sản phẩm cần là URL Shopee HTTPS.');
 if(!Array.isArray(plan.scenes)||plan.scenes.length!==9)throw Error('Cần đủ 9 cảnh của template.');
 const spans=[[0,3],[3,6],[6,9],[9,13],[13,15.5],[15.5,19.5],[19.5,23.5],[23.5,28],[28,35]];
 plan.scenes.forEach((s,i)=>{if(s.start!==spans[i][0]||s.end!==spans[i][1])throw Error('Cảnh '+(i+1)+' sai mốc thời gian.');text(s.overlay,180,'Chữ cảnh');text(s.voice,250,'Lời đọc cảnh');});
 return plan;
}
function asset(plan,role,library,min,type){
 const b=plan.bindings?.[role],m=library[b?.mediaId];
 if(!m||!['image','video','audio'].includes(m.type)||(type&&m.type!==type))throw Error('Thiếu tư liệu '+role+(type?' ('+type+')':'' )+'. Chọn tệp đúng trong Media.');
 if(role==='before'||role==='after'){if(!['image','video'].includes(m.type)||b.realPeople!==true||b.rightsConfirmed!==true)throw Error('Xác nhận cảnh '+role+' là ảnh/video người thật và được phép sử dụng.');}
 if(role==='device'){if(b.realUse!==true||b.rightsConfirmed!==true||m.type!=='video')throw Error('Cần video thiết bị thao tác thật, được phép dùng; không dùng ảnh shop như cảnh đã thử.');}
 const sourceIn=finite(b.sourceIn??0,0,21600,'Điểm vào '+role);
 if(m.type!=='image'&&finite(m.duration,0,21600,'Thời lượng '+role)-sourceIn<min-.001)throw Error('Tư liệu '+role+' cần còn tối thiểu '+min+' giây.');
 if(!m.url)throw Error('Tư liệu '+role+' chưa có URL hoặc chưa đóng gói.');
 return{m,sourceIn};
}
function contentIdentity(plan){
 // Render FPS, color grading, grain and metadata intentionally do not change this identity.
 return JSON.stringify({template:MODE,id:plan.id,hook:plan.hook.question,story:plan.scenes?.map(s=>s.voice),bindings:['before','after','device','gift'].map(r=>({role:r,id:plan.bindings?.[r]?.mediaId,sourceIn:plan.bindings?.[r]?.sourceIn??0})),affiliate:plan.affiliate?.url??null});
}
async function fingerprint(plan){const raw=new TextEncoder().encode(contentIdentity(plan));const bytes=await root.crypto.subtle.digest('SHA-256',raw);return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
function build(plan,options={}){
 validate(plan);
 const library={...(options.media||{}),...(plan.bundledMedia||{})};
 const before=asset(plan,'before',library,13),after=asset(plan,'after',library,13),device=asset(plan,'device',library,7,'video'),gift=asset(plan,'gift',library,0,'image');
 if(before.m.id===after.m.id&&before.sourceIn===after.sourceIn)throw Error('Cặp trước/sau đang là cùng tư liệu và điểm vào. Chọn hai cảnh so sánh khác nhau.');
 if(plan.sourceAudioDemo&&[before,after].some(a=>a.m.type!=='video'||plan.bindings[a===before?'before':'after'].audioConfirmed!==true))throw Error('Tập J-Cut cần hai video A/B có âm thanh thật đã kiểm tra; không dùng ảnh tĩnh.');
 const used={},clips=[];let n=0;const add=c=>clips.push({id:plan.id+'_'+(++n),transition:'none',effect:'none',filter:'original',anim:'none',...c});
 const take=(role,start,end,viewport='full',sourceOffset=0)=>{const a={before,after,device,gift}[role];used[a.m.id]=clone(a.m);add({track:'video',title:role,mediaId:a.m.id,start,duration:end-start,sourceIn:a.sourceIn+sourceOffset,speed:1,volume:0,sprintVisual:{mode:MODE,viewport,layout:plan.hook.layout,snap:start===0}});};
 take('before',0,3,'before');take('after',0,3,'after');
 take('before',3,6,'full',plan.sourceAudioDemo?0:3);if(plan.sourceAudioDemo)Object.assign(clips.at(-1),{volume:.8,requiredSourceAudio:true});
 take(plan.sourceAudioDemo?'after':'before',6,9,'full',plan.sourceAudioDemo?0:6);if(plan.sourceAudioDemo)Object.assign(clips.at(-1),{volume:.8,requiredSourceAudio:true});take('after',9,13,'full',9);
 take('after',13,15.5,'full',0);
 take('gift',15.5,19.5);take('after',19.5,23.5,'full',3);take('gift',23.5,28);
 take('device',28,35,'upper');
 const stageKinds=['hook','cause','cause','cause','follow','solution','solution','solution','dual'];
 plan.scenes.forEach((s,i)=>{
  const g={kind:stageKinds[i],mode:MODE,layout:plan.hook.layout,question:plan.hook.question,fontSize:plan.hook.fontSize,badLabel:plan.hook.badLabel,goodLabel:plan.hook.goodLabel,overlay:s.overlay,caption:s.voice,headline:plan.gift.headline,keyword:plan.gift.keyword,affiliate:!!plan.affiliate?.url,productName:plan.affiliate?.productName||'Phụ kiện trong video',followLabel:'+ Theo dõi Omera Studio',followNotice:'ĐỒ HỌA NHẮC THEO DÕI',giftText:'Sơ đồ miễn phí ở bình luận đầu.',messageText:'Cần bản ảnh? Nhắn '+plan.gift.keyword+' cho Trang.'};
  add({track:'overlay',title:s.overlay,start:s.start,duration:s.end-s.start,sprintGraphic:g,sourceIn:0});
  if(plan.sourceAudioDemo&&[1,2].includes(i))return; // Listen to original A/B, never narrate over the demonstration.
  const audio=library[s.voiceMediaId];
  if(!audio||audio.type!=='audio'||!audio.url||!Number.isFinite(Number(audio.duration))||audio.duration<=0||audio.duration>s.end-s.start-.04)throw Error('Thiếu / lời đọc quá dài ở cảnh '+(i+1)+'. Tạo giọng rồi gắn voiceMediaId đúng thời lượng.');
  used[audio.id]=clone(audio);add({track:'audio',mediaId:audio.id,title:s.voice,start:s.start+.02,duration:audio.duration,sourceIn:0,volume:1,audioRole:'voice'});
 });
 for(const [role,start,max] of [['shutter',0,.6],['bell',13,.8]]){const a=asset(plan,role,library,0,'audio');if(!Number.isFinite(Number(a.m.duration))||a.m.duration<=0)throw Error('Thiếu SFX '+role);used[a.m.id]=clone(a.m);add({track:'audio',mediaId:a.m.id,title:role,start,duration:Math.min(max,a.m.duration),sourceIn:0,volume:.3});}
 const f=fps(plan.output?.fps);
 return{duration:35,warnings:['Tên Sprint là tên template, không bảo đảm 1.000 follow.','Xác nhận trước/sau chỉ đổi yếu tố đang hướng dẫn. Phần thiết bị cần quay đúng sản phẩm.','Đăng ảnh sơ đồ vào bình luận công khai; chỉ trả lời riêng khi người xem chủ động yêu cầu.',...(plan.affiliate?.url?[]:['Chưa có link sản phẩm đã kiểm tra: không hứa gửi link hoặc gắn thẻ sản phẩm.'])],project:{format:'clipcut-project',version:2,name:plan.name,ratio:'9:16',media:used,clips,canvas:{enabled:true,color:'#ffffff',blur:false},production:{stage:'fb-sprint-bound-media',sprint:{mode:MODE,version:VERSION,plan:clone(plan),contentIdentity:contentIdentity(plan),output:{fps:f.value,fpsRatio:f.ratio,stripSourceMetadata:true,randomize:false},giftDelivery:'public-comment-image',publishReady:false,requiresManualReview:['Check first frame, human subjects, product matching, narration and cheat-sheet comment.']}}}};
}
function preflight(project){
 const p=project?.production?.sprint;if(!p)return[];
 const validated=build(p.plan,{media:project.media});
 for(const clip of validated.project.clips){if(clip.mediaId&&!project.media?.[clip.mediaId])throw Error('Thiếu tư liệu trong dự án đã đóng gói: '+clip.mediaId);if(clip.requiredSourceAudio){const actual=project.clips.find(c=>c.id===clip.id);if(!actual?.requiredSourceAudio||actual.volume<=0)throw Error('Bật âm thanh gốc A/B của tập J-Cut.');}}
 if(project.clips.length!==validated.project.clips.length)throw Error('Timeline Sprint có lớp thêm hoặc bị thiếu. Tạo lại từ cấu hình đã chỉnh trước khi xuất.');
 for(const c of validated.project.clips){const actual=project.clips.find(x=>x.id===c.id);if(!actual||actual.track!==c.track||actual.hidden||actual.muted||(c.track==='audio'&&actual.volume<=0)||actual.opacity===0||Math.abs((actual.speed??1)-1)>.001||Math.abs(actual.start-c.start)>.001||Math.abs(actual.duration-c.duration)>.001||actual.mediaId!==c.mediaId||Math.abs((actual.sourceIn||0)-(c.sourceIn||0))>.001||JSON.stringify(actual.sprintVisual)!==JSON.stringify(c.sprintVisual)||JSON.stringify(actual.sprintGraphic)!==JSON.stringify(c.sprintGraphic))throw Error('Timeline Sprint đã đổi / thiếu lớp: '+c.title+'. Tạo lại từ cấu hình đã kiểm tra trước khi xuất.');}
 if(project.trackState?.video?.hidden||project.trackState?.overlay?.hidden||project.trackState?.audio?.hidden||project.trackState?.audio?.muted)throw Error('Bật các track hình, đồ họa và âm thanh của Sprint trước khi xuất.');
 if(project.ratio!=='9:16')throw Error('Sprint cần khung hình 9:16.');
 return validated.warnings;
}
function viewport(which,layout){if(which==='upper')return{x:0,y:0,w:1080,h:830};if(which==='full')return{x:0,y:0,w:1080,h:1920};if(layout==='side-by-side')return{x:which==='before'?0:540,y:0,w:540,h:1920};return{x:0,y:which==='before'?0:960,w:1080,h:960};}
function snap(time){const p=clamp(time/.35,0,1);return 1+.2*Math.pow(1-p,3);}
function drawVisual(ctx,c,time,source,w,h){const v=c.sprintVisual,r=viewport(v.viewport,v.layout);ctx.save();ctx.scale(w/1080,h/1920);ctx.translate(-540,-960);ctx.beginPath();ctx.rect(r.x,r.y,r.w,r.h);ctx.clip();const sw=source?.videoWidth||source?.naturalWidth,sh=source?.videoHeight||source?.naturalHeight;if(sw&&sh){const zoom=v.snap?snap(time):1;const contain=c.title==='gift';const k=(contain?Math.min(r.w/sw,r.h/sh):Math.max(r.w/sw,r.h/sh))*zoom;ctx.fillStyle='#fff';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.drawImage(source,r.x+(r.w-sw*k)/2,r.y+(r.h-sh*k)/2,sw*k,sh*k);}else{ctx.fillStyle='#fff';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.fillStyle='#922';ctx.font='bold 50px Segoe UI';ctx.fillText('THIẾU TƯ LIỆU — CHƯA SẴN SÀNG XUẤT',60,500);}ctx.restore();}
function wrapped(ctx,str,x,y,width,size,color='#0d1110',align='center',maxLines=4){ctx.fillStyle=color;ctx.font=`700 ${size}px Segoe UI,Arial`;ctx.textAlign=align;ctx.textBaseline='top';const lines=[];for(const word of str.split(/\s+/)){const i=lines.length-1;if(i<0||ctx.measureText(lines[i]+' '+word).width>width)lines.push(word);else lines[i]+=' '+word;}if(lines.length>maxLines)throw Error('Chữ quá dài cho vùng hiển thị: '+str);lines.forEach((s,i)=>ctx.fillText(s,x,y+i*size*1.18));return lines.length*size*1.18;}
function box(ctx,x,y,w,h,color,r=20){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function drawGraphic(ctx,c,time,w,h){const g=c.sprintGraphic;ctx.save();ctx.scale(w/1080,h/1920);ctx.translate(-540,-960);
 if(g.kind==='hook'){
  const side=g.layout==='side-by-side';box(ctx,side?20:50,side?180:170,side?495:980,155,'#c92f35');wrapped(ctx,g.badLabel,side?267:540,side?204:194,side?450:930,side?42:54,'#fff','center',2);
  box(ctx,side?560:50,side?180:1120,side?495:980,155,'#7CE8C6');wrapped(ctx,g.goodLabel,side?807:540,side?204:1144,side?450:930,side?42:54,'#0d1110','center',2);
  const bannerY=side?810:830;box(ctx,50,bannerY,900,250,'#fff');wrapped(ctx,g.question,500,bannerY+35,840,g.fontSize,'#0d1110','center',3);
 }else if(g.kind==='follow'){
  const p=clamp(time/.22,0,1),scale=.88+.12*(1-Math.pow(1-p,3));ctx.save();ctx.translate(500,1000);ctx.scale(scale,scale);ctx.translate(-500,-1000);box(ctx,60,825,880,295,'#7CE8C6');wrapped(ctx,g.followLabel,500,870,810,64,'#0d1110','center',2);wrapped(ctx,'Mỗi tập một mẹo quay / dựng',500,1040,800,37,'#173d2d','center',1);ctx.restore();wrapped(ctx,g.followNotice,500,1170,840,25,'#fff','center',1);
 }else if(g.kind==='dual'){
  box(ctx,0,830,1080,1090,'#fff',0);let y=900; y+=wrapped(ctx,g.headline,500,y,870,57,'#0d1110','center',3)+32; y+=wrapped(ctx,g.giftText,500,y,860,43,'#0d1110','center',2)+23; y+=wrapped(ctx,g.messageText,500,y,850,38,'#29453b','center',2)+28;box(ctx,80,y,840,100,'#7CE8C6');wrapped(ctx,'Theo dõi để xem tập tiếp theo',500,y+23,800,40,'#0d1110','center',1);wrapped(ctx,g.affiliate?'Có liên kết tiếp thị · Omera có thể nhận hoa hồng.':'Link thiết bị: chỉ thêm sau khi kiểm tra đúng sản phẩm.',500,1635,870,27,'#344b40','center',2);
 }else{
  box(ctx,55,210,905,190,'#ffffffed');wrapped(ctx,g.overlay,507,240,830,57,'#0d1110','center',2);
  if(g.kind==='solution'&&c.title.includes('LƯỚI')){ctx.strokeStyle='#7CE8C6';ctx.lineWidth=4;for(const x of [360,720]){ctx.beginPath();ctx.moveTo(x,440);ctx.lineTo(x,1500);ctx.stroke();}for(const y of [790,1140]){ctx.beginPath();ctx.moveTo(60,y);ctx.lineTo(960,y);ctx.stroke();}}
 }
 if(g.kind!=='dual'&&g.kind!=='hook'){box(ctx,60,1485,900,200,'#ffffffed');wrapped(ctx,g.caption||g.overlay,510,1510,830,37,'#0d1110','center',3);}
 if(g.kind==='hook'){box(ctx,60,1720,750,80,'#0d1110cc');wrapped(ctx,'Omera Studio · So sánh trước / sau',435,1741,700,32,'#fff','center',1);}ctx.restore();}
const api={MODE,VERSION,validate,build,preflight,contentIdentity,fingerprint,fps,viewport,snap,drawVisual,drawGraphic};
root.TibeFBSprint=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
