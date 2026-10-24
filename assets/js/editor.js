'use strict';
window.addEventListener('unhandledrejection',event=>{console.error(event.reason);const status=document.getElementById('previewStatus');if(status)status.textContent='Lỗi: '+(event.reason?.message||'Không thể hoàn tất thao tác');});
const appFetch=(...args)=>(window.TibeBackend?.request||window.fetch)(...args);
const C = ClipCore, $ = id => document.getElementById(id);
let pxPerSec = 52, currentTime = 5.5, totalDuration = 24, isPlaying = false, selectedClipId = 'v1';
let clips = [], media = {}, ratio = '9:16', projectName = 'Summer Vibes', activeTab = 'media', inspectorTab = 'video', currentProjectId = null;
let snap = true, monitorMuted = false, exporting = false, lastFrame = 0, exportJob = null, saveTimer;
const history = [], future = [], instances = new Map(), images = new Map(), files = new Map();
const canvas = $('previewCanvas'), ctx = canvas.getContext('2d'), tracks = ['video','overlay','text','sticker','audio'];
let selectedIds = new Set(), trackState = {}, mediaFilter = 'all', mediaSearch = '', selectedAssetId = null;
let canvasZoom = 1, showGuides = false, playOrigin = 0, playStartedAt = 0, clipboardClips = [];
let pointerActive=false,mediaRefreshPending=false,mediaDrawerPending=false,mediaRefreshScheduled=false;
const baseTrackHeights = {video:48,overlay:32,text:32,sticker:26,audio:66};
const demoMode = new URLSearchParams(location.search).get('demo') === '1';
let projectProduction={};
let projectCanvas={enabled:true,color:'#ffe4d0',blur:false};
const stickerImages=new Map(),visualLayers=new Map();
let audioContext, monitor, mixDestination, backend = null, database = null, saveVersion = 0;
const demoNames = ['palms','portrait-vertical','coast','plant','cat','cliff'];
const titles = ['Tropical Palms','Golden Portrait','Amalfi Coast','Minimal Leaf','Cozy Afternoon','Sunset Cliff'];
function defaultProject() {
  const m = {};
  demoNames.forEach((name,i)=> { m['demo'+i] = {id:'demo'+i,name:titles[i],type:'image',url:'assets/demo/'+({coast:'coast-hd.png',cliff:'cliff-hd.png'}[name]||name+'.webp'),duration:4}; });
  m.music1 = {id:'music1',name:'Sunny Days · Original',type:'audio',url:'assets/demo/sunny-days.wav',duration:24};
  m.music2 = {id:'music2',name:'Ocean Breeze · Original',type:'audio',url:'assets/demo/ocean-breeze.wav',duration:24};
  for(const id of ['music1','music2'])if(typeof TIBE_DEMO_WAVES!=='undefined'&&TIBE_DEMO_WAVES[id])m[id].peaks=TIBE_DEMO_WAVES[id].peaks.slice();
  const starts = [0,3.5,8.3,12.8,16.6,20], ends = [3.5,8.3,12.8,16.6,20,24];
  const list = starts.map((s,i)=>C.normalize({id:'v'+i,track:'video',title:titles[i],mediaId:'demo'+i,start:s,duration:ends[i]-s,transition:i?'dissolve':'none',transitionDuration:.5,anim:'ken_burns',filter:'cream',adjust:{brightness:10,contrast:5,saturation:8}}));
  list.push(C.normalize({id:'t1',track:'text',title:'Good\nVibes',start:2,duration:5.2,xOffset:35,yOffset:-220,rotation:-8,fontSize:61,textStyle:'script',color:'#ffffff'}),
    C.normalize({id:'t2',track:'text',title:'Summer Moments',start:8.3,duration:4.5,yOffset:230,fontSize:35,textStyle:'subtitle'}),
    C.normalize({id:'t3',track:'text',title:'Create. Edit. Share.',start:20,duration:3.8,yOffset:240,fontSize:32,textStyle:'subtitle'}),
    C.normalize({id:'s1',track:'sticker',title:'Cherry blossom',stickerId:'flower',start:3,duration:6,xOffset:140,yOffset:80,scale:1.2}),
    C.normalize({id:'s2',track:'sticker',title:'White heart',stickerId:'outlineHeart',start:4,duration:5,xOffset:120,yOffset:-65,scale:1.5,color:'#ffb6ab'}),
    C.normalize({id:'a1',track:'audio',title:m.music1.name,mediaId:'music1',start:0,duration:16.8,volume:.55,fadeIn:1,fadeOut:1.5}),
    C.normalize({id:'a2',track:'audio',title:m.music2.name,mediaId:'music2',start:17,duration:7,volume:.5,fadeIn:.8,fadeOut:1.5}));
  return {format:'clipcut-project',version:2,name:'Summer Vibes',ratio:'9:16',clips:list,media:m};
}
function snapshot() { return {format:'clipcut-project',version:2,name:projectName,libraryId:currentProjectId,ratio,production:C.copy(projectProduction),luts:TibeLooks.projectLuts(),selection:[...selectedIds],trackState:C.copy(trackState),canvas:C.copy(projectCanvas),clips:C.copy(clips),media:C.copy(media)}; }
function applyProject(p) {
  TibeLibrary.stopSource();TibeLibrary.stopLookPreview();TibeLooks.registerLuts(p?.luts||{});
  if (!p || p.format !== 'clipcut-project' || !Array.isArray(p.clips) || !p.media || p.clips.length>3000) throw Error('Tệp dự án tibe không hợp lệ.');
  for (const item of Object.values(p.media)) {
    if (!item || !['image','video','audio'].includes(item.type)) throw Error('Loại tư liệu không hợp lệ.');
    const sharper={'assets/demo/cliff.webp':'assets/demo/cliff-hd.png','assets/demo/coast.webp':'assets/demo/coast-hd.png'};
    if(sharper[item.url]){item.url=sharper[item.url];delete item.thumbnail;}
    if (item.url && !/^(assets\/(?:demo|sfx)\/[\w.-]+|\/workspace\/(uploads|tts)\/[\w.-]+|data:(image|video|audio)\/[^,]+,[\s\S]+)$/.test(item.url)) throw Error('Đường dẫn tư liệu không được hỗ trợ.');
    if(item.thumbnail&&!/^(assets\/(?:demo|sfx)\/[\w.-]+|data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+)$/.test(item.thumbnail))delete item.thumbnail;
  }
  projectProduction=p.production&&typeof p.production==='object'&&!Array.isArray(p.production)?C.copy(p.production):{};
  projectCanvas={enabled:p.canvas?.enabled!==false,color:/^#[0-9a-f]{6}$/i.test(p.canvas?.color)?p.canvas.color:'#ffe4d0',blur:!!p.canvas?.blur};visualLayers.clear();
  pauseAll(); instances.forEach(m=>{ m.el.removeAttribute('src'); m.el.load(); m.source?.disconnect(); m.gain?.disconnect(); }); instances.clear(); images.clear();
  trackState = Object.fromEntries(tracks.map(track=>[track,{hidden:!!p.trackState?.[track]?.hidden,locked:!!p.trackState?.[track]?.locked,muted:!!p.trackState?.[track]?.muted}]));
  const seen=new Set();clips = p.clips.filter(c=>c&&tracks.includes(c.track)).map(c=>{const clip=C.normalize(c);if(seen.has(clip.id))clip.id=C.uid();seen.add(clip.id);return clip;}); media=C.copy(p.media);window.OmeraEditor?.syncHelpers(clips,projectProduction.omera,media); ratio=['9:16','16:9','1:1','4:5'].includes(p.ratio)?p.ratio:'9:16';
  currentProjectId=/^[a-f0-9]{32}$/.test(p.libraryId||'')?p.libraryId:null;
  projectName=String(p.name||'Video chưa đặt tên').slice(0,120); selectedClipId=clips.find(c=>c.id===p.selection?.[0])?.id||clips.find(c=>c.id===selectedClipId)?.id||clips[0]?.id||null;
  selectedIds=new Set(Array.isArray(p.selection)?p.selection.filter(id=>clips.some(c=>c.id===id)):selectedClipId?[selectedClipId]:[]);setCanvasSize();refresh();prepareMedia();
}
function mutate(fn, key) {
  if(exporting) return;
  const now=performance.now();
  if(!key || mutate.lastKey!==key || now-mutate.lastTime>650) {history.push(snapshot()); if(history.length>80) history.shift();}
  mutate.lastKey=key; mutate.lastTime=now; future.length=0; fn(); changed();
}
function changed() { window.OmeraEditor?.syncHelpers(clips,projectProduction.omera,media);for(const id of visualLayers.keys())if(!clips.some(c=>c.id===id))visualLayers.delete(id);reconcileSelection();updateTotalDuration(); renderTimeline(); updatePlayheadUI(); updateSelectionBox(); saveSoon(); }
function refresh() { reconcileSelection();updateTotalDuration(); renderRuler(); renderTimeline(); renderInspector(); renderDrawer(); updatePlayheadUI(); $('projectName').textContent=projectName; $('ratioSelect').value=ratio;TibeUI.syncSelects(); }
function undoAction() { if(!history.length||exporting)return;mutate.lastKey=null; future.push(snapshot()); const p=history.pop(); applyProject(p); saveSoon(); }
function redoAction() { if(!future.length||exporting)return;mutate.lastKey=null; history.push(snapshot()); applyProject(future.pop()); saveSoon(); }
function toast(message) { $('toast').textContent=message; $('toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('toast').classList.remove('visible'),4500); }
async function openDB() {
  if(!window.indexedDB) return null;
  return new Promise((resolve,reject)=>{ const r=indexedDB.open('clipcut-studio-v2',1); r.onupgradeneeded=()=>r.result.createObjectStore('files'); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
}
function storeFile(id,file) { if(!database)return Promise.reject(Error('Trình duyệt không lưu được tư liệu.')); return new Promise((res,rej)=>{const tx=database.transaction('files','readwrite');tx.objectStore('files').put(file,id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);}); }
function readFile(id) { return new Promise(resolve=>{if(!database)return resolve(null);const r=database.transaction('files').objectStore('files').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);}); }
async function resolveUrl(m) {
  if(m.url)return window.TibeBackend?.url?.(m.url)||m.url;
  if(m.runtimeUrl)return m.runtimeUrl;
  if(!files.has(m.id)){const file=await readFile(m.id);if(file)files.set(m.id,file);}
  if(files.has(m.id)){m.runtimeUrl ||= URL.createObjectURL(files.get(m.id));return m.runtimeUrl;}
  throw Error('Không tìm thấy tư liệu “'+m.name+'”. Hãy nhập lại tệp dự án đã đóng gói.');
}
function saveSoon() {
  if(demoMode){$('saveStatus').textContent='Bản mẫu · Lưu để giữ lại';return;}
  $('saveStatus').textContent='Đang lưu bản nháp…'; const version=++saveVersion;
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>{ try {const p=snapshot();Object.values(p.media).forEach(m=>delete m.runtimeUrl);localStorage.setItem('clipcut-autosave-v2',JSON.stringify(p));if(version===saveVersion)$('saveStatus').textContent='Đã lưu bản nháp';}catch{ $('saveStatus').textContent=currentProjectId?'Đã mở thư mục · bấm Lưu khi sửa':'Nháp lớn · hãy lưu tệp dự án';} },400);
}
const selected=()=>clips.find(c=>c.id===selectedClipId);
function updateTotalDuration(){ totalDuration=Math.max(.1,...clips.map(c=>c.start+c.duration)); currentTime=C.clamp(currentTime,0,totalDuration);renderRuler(); }
const formatTime=C.formatTime;
function renderRuler(){
  const ruler=$('tlRuler'),width=Math.max($('tlScroll').clientWidth,(totalDuration+2)*pxPerSec);
  ruler.replaceChildren();ruler.style.width=width+'px';
  const step=pxPerSec>=100?.5:pxPerSec>=45?2:pxPerSec>=18?5:10;
  for(let n=0;n<=Math.ceil(width/pxPerSec/step);n++){
    const s=n*step,tick=document.createElement('span');tick.className='ruler-tick';tick.style.left=s*pxPerSec+5+'px';tick.textContent=step<1?formatTime(s):formatTime(s).slice(0,-2);ruler.append(tick);
    for(let j=1;j<4;j++){const minor=document.createElement('span');minor.className='ruler-tick minor';minor.style.left=(s+step*j/4)*pxPerSec+'px';ruler.append(minor);}
  }
}
function renderTimeline(){
  const width=Math.max($('tlScroll').clientWidth,(totalDuration+2)*pxPerSec);
  const trackNames={video:'Video chính',overlay:'Lớp phủ',text:'Văn bản',sticker:'Nhãn dán',audio:'Âm thanh'};
  const trackIcons={video:'video',overlay:'layers',text:'text',sticker:'stickers',audio:'audio'};
  tracks.forEach(track=>{
    const lane=$('lane-'+track),state=trackState[track]||{},packed=C.packRows(clips.filter(c=>c.track===track&&!c.omeraHelper)),rowHeight=baseTrackHeights[track];
    lane.replaceChildren();lane.style.width=width+'px';lane.style.height=Math.max(44,packed.rows*rowHeight+6)+'px';lane.classList.toggle('track-locked',!!state.locked);
    const header=document.querySelector('.tl-track-label[data-track="'+track+'"]');header.style.height=lane.style.height;
    const unusedTrack=!clips.some(c=>c.track===track&&!c.omeraHelper)&&!['video','audio'].includes(track);lane.hidden=unusedTrack;header.hidden=unusedTrack;
    header.innerHTML=`<span class="track-icon">${icon(trackIcons[track])}</span><span class="track-name">${trackNames[track]}</span><span class="track-actions"><button class="${state.hidden?'active':''}" title="${state.hidden?'Hiện':'Ẩn'} track" onclick="toggleTrack('${track}','hidden')">${icon(state.hidden?'eyeOff':'eye')}</button><button class="${state.locked?'active':''}" title="${state.locked?'Mở khóa':'Khóa'} track" onclick="toggleTrack('${track}','locked')">${icon(state.locked?'lock':'unlock')}</button>${['video','overlay','audio'].includes(track)?`<button class="${state.muted?'active':''}" title="Bật/tắt âm thanh track" onclick="toggleTrack('${track}','muted')">${icon(state.muted?'mute':'volume')}</button>`:''}</span>`;
    for(const c of clips.filter(c=>c.track===track)){
      const el=document.createElement('div');const row=packed.positions.get(c.id);
      el.className='tl-clip tl-'+track+(selectedIds.has(c.id)?' selected':'')+(c.hidden||state.hidden?' clip-hidden':'');
      el.dataset.clipId=c.id;el.setAttribute('role','button');el.tabIndex=0;el.setAttribute('aria-label',c.title+' · '+formatTime(c.start));
      el.style.left=c.start*pxPerSec+'px';el.style.top=(5+row*rowHeight)+'px';el.style.width=Math.max(4,c.duration*pxPerSec)+'px';el.style.height=(rowHeight-5)+'px';
      const m=media[c.mediaId],poster=m?.thumbnail||((m?.type==='image')?(m.url||m.runtimeUrl):null);
      if(poster){const strip=document.createElement('div');strip.className='clip-thumbnails';strip.style.backgroundImage='url("'+(window.TibeBackend?.url?.(poster)||poster).replace(/["\\\n\r]/g,'')+'")';el.append(strip);}
      const label=document.createElement('span');label.className='clip-label';label.innerHTML=icon(trackIcons[track]);const name=document.createElement('span');name.textContent=c.title;label.append(name);el.append(label);
      if(c.speed!==1){const speed=document.createElement('span');speed.className='clip-speed';speed.textContent=c.speed+'×';el.append(speed);}
      if(track==='audio')el.append(TibeUI.waveformElement(c,m,Math.max(4,c.duration*pxPerSec)));
      for(const side of ['left','right']){const grip=document.createElement('i');grip.className='clip-grip '+side;grip.dataset.side=side;el.append(grip);}
      for(const k of c.keyframes||[]){const diamond=document.createElement('button');diamond.className='keyframe-dot';diamond.style.left=Math.max(3,k.time*pxPerSec-2)+'px';diamond.title='Keyframe · '+formatTime(k.time);diamond.onpointerdown=e=>e.stopPropagation();diamond.onclick=e=>{e.stopPropagation();selectClip(c.id);seekTo(c.start+k.time);renderInspector();};el.append(diamond);}
      el.onpointerdown=e=>beginClipDrag(e,c,el);el.oncontextmenu=e=>openClipMenu(e,c);el.onkeydown=e=>{if(e.key==='Enter'){selectClip(c.id);seekTo(c.start);}};lane.append(el);
      if(track==='video'&&c.transition&&c.transition!=='none'&&c.start>0){const badge=document.createElement('button');badge.className='tl-transition-badge';badge.style.left=c.start*pxPerSec-8+'px';badge.style.top=(row*rowHeight+rowHeight-9)+'px';badge.innerHTML=icon('transitions');badge.title='Chuyển cảnh: '+c.transition;badge.onclick=()=>{selectClip(c.id);selectRail('transitions');};lane.append(badge);}
    }
  });
  $('clipCount').textContent=clips.length+' clip';$('selectedCount').textContent=selectedIds.size?selectedIds.size+' clip':'Chưa chọn';
  document.querySelectorAll('[data-undo]').forEach(b=>b.disabled=!history.length);
  document.querySelectorAll('[data-redo]').forEach(b=>b.disabled=!future.length);
  document.querySelectorAll('[data-needs-clip]').forEach(b=>b.disabled=!clips.some(c=>selectedIds.has(c.id)&&!trackState[c.track]?.locked));
  $('projectDuration').textContent=formatTime(clips.length?totalDuration:0)+' tổng thời lượng';
  document.querySelector('.timeline-area').classList.toggle('timeline-empty',!clips.length);
  if($('timelineEmpty'))$('timelineEmpty').hidden=!!clips.length;
  if($('clearTimelineButton'))$('clearTimelineButton').disabled=!clips.length||exporting;
  TibeUI.syncEffectSelection();
  TibeLibrary.syncSelection();
}
function beginClipDrag(e,c,el){
  if(exporting||e.button!==0)return;e.preventDefault();e.stopPropagation();
  if(trackState[c.track]?.locked)return toast('Track đang khóa. Bấm ổ khóa để chỉnh sửa.');
  const additive=e.shiftKey||e.ctrlKey||e.metaKey;
  if(additive){selectClip(c.id,true);return;}
  if(!selectedIds.has(c.id))selectClip(c.id);else{selectedClipId=c.id;renderInspector();}
  const before=snapshot(),original=C.copy(c),startX=e.clientX,side=e.target.dataset.side;
  const moving=clips.filter(x=>selectedIds.has(x.id)&&!trackState[x.track]?.locked),originals=new Map(moving.map(x=>[x.id,C.copy(x)]));
  const startScroll=$('tlScroll').scrollLeft;let moved=false;
  const move=ev=>{
    const delta=(ev.clientX-startX+$('tlScroll').scrollLeft-startScroll)/pxPerSec;if(Math.abs(ev.clientX-startX)<3&&!moved)return;moved=true;
    if(side){const m=media[c.mediaId],source=m&&m.type!=='image'?m.duration:Infinity;Object.assign(c,C.resize(original,side==='left'?delta:0,side==='right'?delta:0,source));}
    else{
      const edges=[currentTime,...clips.filter(x=>!selectedIds.has(x.id)).flatMap(x=>[x.start,x.start+x.duration])];
      const target=snap?C.snapPosition(original.start+delta,original.duration,edges,7/pxPerSec):{start:Math.max(0,original.start+delta),edge:null};
      const shift=Math.max(target.start-original.start,-Math.min(...moving.map(x=>originals.get(x.id).start)));
      moving.forEach(x=>x.start=originals.get(x.id).start+shift);
      $('snapLine').hidden=target.edge===null;if(target.edge!==null)$('snapLine').style.left=target.edge*pxPerSec+'px';
    }
    updateTotalDuration();renderTimeline();updatePlayheadUI();updateSelectionBox();
    const rect=$('tlScroll').getBoundingClientRect();if(ev.clientX>rect.right-35)$('tlScroll').scrollLeft+=10;else if(ev.clientX<rect.left+25)$('tlScroll').scrollLeft-=10;
  };
  const up=()=>{window.removeEventListener('pointermove',move);$('snapLine').hidden=true;if(moved){history.push(before);future.length=0;renderInspector();changed();syncMedia(true);}else{seekTo(C.clamp(currentTime,c.start,c.start+c.duration-.001));renderInspector();}};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});
}
function selectClip(id,additive=false){
  TibeLibrary.stopLookPreview();
  if(additive){if(selectedIds.has(id))selectedIds.delete(id);else selectedIds.add(id);selectedClipId=selectedIds.has(id)?id:[...selectedIds].at(-1)||null;}
  else{selectedClipId=id;selectedIds=new Set(id?[id]:[]);}
  renderTimeline();renderInspector();updateSelectionBox();
}
function updateActiveClip(prop,value){
  const c=selected();if(!c)return;if(trackState[c.track]?.locked)return toast('Track đang khóa.');
  const transforms=['xOffset','yOffset','scale','rotation','opacity'];
  mutate(()=>{
    if(transforms.includes(prop)&&c.keyframes?.length){const time=C.clamp(currentTime-c.start,0,c.duration),effective=C.transform(c,time);const existing=c.keyframes.find(k=>Math.abs(k.time-time)<.025);if(existing)existing[prop]=value;else c.keyframes.push({time,...effective,[prop]:value});}
    else c[prop]=value;
  },c.id+prop);
  updateSelectionBox();
}
function scrubTimeline(e){
  if(exporting||e.button!==0)return;e.preventDefault();
  const rect=$('tlScroll').getBoundingClientRect();
  const seek=ev=>seekTo((ev.clientX-rect.left+$('tlScroll').scrollLeft)/pxPerSec);
  seek(e);const move=ev=>seek(ev),up=()=>{window.removeEventListener('pointermove',move);renderInspector();};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});
}
function updatePlayheadUI(){
  $('playhead').style.left=currentTime*pxPerSec+'px';$('timecodeText').textContent=formatTime(currentTime)+' / '+formatTime(clips.length?totalDuration:0);
  $('btnPlayPause').innerHTML=icon(isPlaying?'pause':'play');$('btnPlayPause').classList.toggle('playing',isPlaying);
  if(isPlaying&&!exporting){const x=currentTime*pxPerSec,scroll=$('tlScroll');if(x>scroll.scrollLeft+scroll.clientWidth-55||x<scroll.scrollLeft)scroll.scrollLeft=Math.max(0,x-scroll.clientWidth*.35);}
  if(exporting&&exportJob&&!exportJob.deterministic){$('exportProgress').value=currentTime/totalDuration*100;$('exportMessage').textContent='Đang dựng '+Math.round(currentTime/totalDuration*100)+'% · '+formatTime(currentTime);}
}
function seekTo(t){
  currentTime=C.clamp(t,0,Math.max(0,totalDuration-.000001));if(isPlaying){playOrigin=currentTime;playStartedAt=performance.now();}
  syncMedia(true);drawCompositeFrame();updatePlayheadUI();
}
function pauseAll(){isPlaying=false;instances.forEach(m=>m.el.pause());}
async function setupAudio(){
  if(!audioContext){audioContext=new(window.AudioContext||window.webkitAudioContext)();monitor=audioContext.createGain();monitor.connect(audioContext.destination);mixDestination=audioContext.createMediaStreamDestination();const silence=audioContext.createConstantSource();silence.offset.value=0;silence.connect(mixDestination);silence.start();}
  await audioContext.resume();monitor.gain.value=monitorMuted?0:1;
  instances.forEach(m=>connectAudio(m));
}
function connectAudio(m){if(!audioContext||m.source)return;try{m.source=audioContext.createMediaElementSource(m.el);m.gain=audioContext.createGain();m.source.connect(m.gain);m.gain.connect(monitor);m.gain.connect(mixDestination);m.el.muted=false;}catch(error){toast('Không thể trộn âm thanh: '+error.message);}}
async function getInstance(c){
  if(instances.has(c.id)){const item=instances.get(c.id);return item.promise?await item.promise:item;}
  const m=media[c.mediaId];if(!m||m.type==='image')return null;
  const item={el:document.createElement(m.type),loading:true,target:null};instances.set(c.id,item);item.el.crossOrigin='anonymous';item.el.preload='auto';item.el.playsInline=true;item.el.muted=!audioContext;
  item.promise=(async()=>{
    try{
      const url=await resolveUrl(m);
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('Tư liệu tải quá lâu: '+m.name)),20000);
        item.el.onloadeddata=()=>{clearTimeout(timer);resolve();};item.el.onerror=()=>{clearTimeout(timer);reject(Error('Không đọc được '+m.name));};item.el.src=url;
      });
      item.loading=false;connectAudio(item);
      item.el.addEventListener('seeked',()=>{if(item.target!==null&&Math.abs(item.el.currentTime-item.target)>.03)queueSeek(item,item.target,true);else if(!isPlaying)drawCompositeFrame();});
      return item;
    }catch(error){item.error=error.message;item.loading=false;throw error;}
  })();
  return await item.promise;
}
function prepareMedia(){clips.forEach(c=>{const m=media[c.mediaId];if(m?.type==='image')loadImage(m);else if(m){getInstance(c).catch(e=>toast(e.message));if(m.type==='video')buildThumbnail(m);if(c.track==='audio'||m.type==='audio')buildWaveform(m);}});}
function loadImage(m){if(images.has(m.id))return images.get(m.id);const im=new Image();im.crossOrigin='anonymous';images.set(m.id,im);resolveUrl(m).then(url=>{im.src=url;}).catch(e=>toast(e.message));return im;}
function syncMedia(force=false){
  instances.forEach((item,id)=>{
    const c=clips.find(c=>c.id===id),el=item.el;
    if(!c){el.pause();item.source?.disconnect();item.gain?.disconnect();instances.delete(id);return;}
    if(item.loading||item.error)return;
    const active=currentTime>=c.start&&currentTime<c.start+c.duration&&!c.hidden&&!trackState[c.track]?.hidden;
    if(active){
      const t=C.sourceTime(c,currentTime-c.start);queueSeek(item,t,force);
      el.playbackRate=C.clamp(C.rateAt(c,currentTime-c.start),.0625,16);configureVoice(item,c.voiceEffect||'none');const envelope=Math.max(0,Math.min(1,c.fadeIn?(currentTime-c.start)/c.fadeIn:1,c.fadeOut?(c.start+c.duration-currentTime)/c.fadeOut:1));
      const vol=(c.muted||trackState[c.track]?.muted)?0:C.clamp((c.volume??1)*envelope*duckGain(c,currentTime),0,2);
      if(item.gain)item.gain.gain.setTargetAtTime(vol,audioContext.currentTime,.008);else el.volume=C.clamp(vol,0,1);
      if(isPlaying&&el.paused)el.play().catch(error=>{if(error.name!=='AbortError')$('previewStatus').textContent='Không thể phát nguồn âm thanh/video';});else if(!isPlaying&&!el.paused)el.pause();
    }else{el.pause();const hold=transitionHoldLocal(c);if(hold!==null)queueSeek(item,C.sourceTime(c,hold),force);if(item.gain)item.gain.gain.value=0;}
  });
}
async function togglePlay(){
  window.TibeVoice?.stop();window.TibeConcat?.stop();
  TibeLibrary.stopSource();TibeLibrary.stopLookPreview();
  if(exporting)return;if(!clips.length)return toast('Thêm tư liệu vào timeline để bắt đầu.');
  if(isPlaying){pauseAll();updatePlayheadUI();return;}
  try{
    await setupAudio();$('previewStatus').textContent='Đang chuẩn bị…';
    await Promise.all(clips.filter(c=>media[c.mediaId]&&media[c.mediaId].type!=='image'&&currentTime>=c.start&&currentTime<c.start+c.duration).map(c=>getInstance(c)));
    if(currentTime>=totalDuration-.02)currentTime=0;
    playOrigin=currentTime;playStartedAt=performance.now();isPlaying=true;syncMedia(true);$('previewStatus').textContent='Xem trước · 30 fps';
  }catch(error){toast(error.message);$('previewStatus').textContent='Không đọc được tư liệu';}
  updatePlayheadUI();
}
function renderLoop(now){
  if(isPlaying){currentTime=playOrigin+(now-playStartedAt)/1000;
    if(currentTime>=totalDuration){currentTime=Math.max(0,totalDuration-.000001);pauseAll();drawCompositeFrame();if(exportJob?.recorder?.state==='recording'){exportJob.stream?.getVideoTracks()[0]?.requestFrame?.();requestAnimationFrame(()=>{if(exportJob?.recorder?.state==='recording')exportJob.recorder.stop();});}}
    syncMedia();updatePlayheadUI();
  }
  drawCompositeFrame();TibeUI.animatePreviews(now);TibeLibrary.animate(now);requestAnimationFrame(renderLoop);
}
function drawCompositeFrame(){
  const w=canvas.width,h=canvas.height;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);
  if(projectCanvas.enabled){ctx.fillStyle=projectCanvas.color;ctx.fillRect(0,0,w,h);}
  if(typeof projectProduction!=='undefined'&&projectProduction.omera&&window.OmeraEditor){
    if(!trackState.video?.hidden)window.OmeraEditor.draw(ctx,projectProduction.omera,clips,media,currentTime);
    ctx.scale(w/450,w/450);
    const shown=c=>!c.hidden&&!trackState[c.track]?.hidden&&currentTime>=c.start&&currentTime<c.start+c.duration;
    clips.filter(c=>c.track==='video'&&!c.omeraSceneId&&shown(c)).forEach(c=>drawVisual(c));
    clips.filter(c=>c.track==='overlay'&&!c.omeraHelper&&shown(c)).forEach(c=>drawVisual(c));
    clips.filter(c=>(c.track==='text'||c.track==='sticker')&&shown(c)).forEach(drawLabel);
    ctx.restore();updateSelectionBox();return;
  }
  ctx.scale(w/450,w/450);
  const visible=c=>!c.hidden&&!trackState[c.track]?.hidden&&currentTime>=c.start&&currentTime<c.start+c.duration;
  const base=clips.filter(c=>c.track==='video').sort((a,b)=>a.start-b.start),active=base.filter(visible);
  if(projectCanvas.enabled&&projectCanvas.blur&&active.length){const c=active.at(-1),m=media[c.mediaId],source=m?.type==='image'?loadImage(m):instances.get(c.id)?.el,sw=source?.naturalWidth||source?.videoWidth,sh=source?.naturalHeight||source?.videoHeight;if(sw&&sh){const H=450*h/w,k=Math.max(450/sw,H/sh)*1.1;ctx.save();ctx.filter='blur(18px) brightness(.85)';ctx.drawImage(source,(450-sw*k)/2,(H-sh*k)/2,sw*k,sh*k);ctx.restore();}}
  active.forEach(c=>drawVideoWithTransition(c,base,visible));
  clips.filter(c=>c.track==='overlay'&&visible(c)).forEach(c=>drawVisual(c));clips.filter(c=>(c.track==='text'||c.track==='sticker')&&visible(c)).forEach(drawLabel);ctx.restore();updateSelectionBox();
}
function transitionHoldLocal(c){if(c.track!=='video'||c.hidden||trackState.video?.hidden)return null;const next=clips.find(n=>n.track==='video'&&!n.hidden&&Math.abs(n.start-c.start-c.duration)<.06&&n.transition&&n.transition!=='none'&&currentTime>=n.start&&currentTime<n.start+Math.min(n.duration,n.transitionDuration||.5));return next?Math.max(0,c.duration-.00001):null;}
const transitionFrames={};
function drawVideoWithTransition(c,base,visible){
  const progress=(currentTime-c.start)/Math.min(c.duration,c.transitionDuration||.5);if(!c.transition||c.transition==='none'||progress>=1){drawVisual(c);return;}
  const w=canvas.width,h=canvas.height,copy=name=>{const off=transitionFrames[name]||(transitionFrames[name]=document.createElement('canvas'));if(off.width!==w)off.width=w;if(off.height!==h)off.height=h;const oc=off.getContext('2d');oc.clearRect(0,0,w,h);oc.drawImage(canvas,0,0);return off;};
  const under=copy('under'),previous=base.filter(p=>p.start<c.start&&Math.abs(p.start+p.duration-c.start)<.06).pop();
  if(previous&&!previous.hidden&&!visible(previous))drawVisual(previous,1,previous.duration-.00001);
  const before=copy('before');ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='copy';ctx.drawImage(under,0,0);ctx.restore();drawVisual(c);const after=copy('after');
  ctx.clearRect(0,0,450,450*h/w);TibeLooks.drawTransition(ctx,before,after,{id:c.transition,progress,width:450,height:450*h/w});
}
function drawVisual(c,alpha=1,localOverride){
  const H=450*canvas.height/canvas.width,local=localOverride??currentTime-c.start,t=C.transform(c,local),m=media[c.mediaId];ctx.save();ctx.globalAlpha=alpha*t.opacity;ctx.globalCompositeOperation=['screen','multiply','overlay','darken','lighten'].includes(c.blend)?c.blend:'source-over';
  let x=t.xOffset,y=t.yOffset,scale=t.scale;const preview=TibeUI.effectPreview(c,local),fx=preview.effect;
  if(c.anim==='ken_burns')scale*=1+(local+(c.animationOffset||0))*.013;if(c.anim==='zoom_in')scale*=.8+.2*Math.min(1,local/.5);if(c.anim==='slide_up')y+=80*(1-Math.min(1,local/.5));if(c.anim==='fade')ctx.globalAlpha*=Math.max(0,Math.min(1,local/.5,(c.duration-local)/.5));
  ctx.translate(225+x,H/2+y);ctx.rotate(t.rotation*Math.PI/180);ctx.scale(scale*(c.flipX?-1:1),scale*(c.flipY?-1:1));
  const dw=c.track==='overlay'?210:450,dh=c.track==='overlay'?Math.min(260,H*.6):H;
  const source=m?.type==='image'?loadImage(m):instances.get(c.id)?.el,sw=source?.videoWidth||source?.naturalWidth,sh=source?.videoHeight||source?.naturalHeight;
  if(c.sprintVisual&&window.TibeFBSprint)TibeFBSprint.drawVisual(ctx,c,local,source,450,H);
  else if(c.sprintGraphic&&window.TibeFBSprint)TibeFBSprint.drawGraphic(ctx,c,local,450,H);
  else if(c.motionGraphic&&typeof OmeraRadio!=='undefined')OmeraRadio.draw(ctx,c,local,dw,dh);
  else if(source&&sw&&sh){const layer=processedVisual(c,source,sw,sh,dw,dh);TibeEffects.draw(ctx,layer,{effect:fx,time:preview.time,width:dw,height:dh,amount:c.effectAmount??.7});}
  else if(!m){const g=ctx.createLinearGradient(-225,-400,225,400);g.addColorStop(0,c.bg1||'#e7b7a6');g.addColorStop(1,c.bg2||'#aebfda');ctx.fillStyle=g;ctx.fillRect(-dw/2,-dh/2,dw,dh);}
  ctx.restore();
}
function drawLabel(c){
  const local=currentTime-c.start,t=C.transform(c,local),layout=labelLayout(c),{size,lines,width,height}=layout;ctx.save();ctx.translate(225+t.xOffset,225*canvas.height/canvas.width+t.yOffset);ctx.rotate(t.rotation*Math.PI/180);let scale=t.scale;
  if(c.anim==='pop_bounce')scale*=.7+.3*Math.min(1,local/.25)+Math.sin(Math.min(1,local/.5)*Math.PI)*.12;if(c.anim==='slide_up')ctx.translate(0,60*(1-Math.min(1,local/.4)));ctx.scale(scale*(c.flipX?-1:1),scale*(c.flipY?-1:1));ctx.globalAlpha=t.opacity*(c.anim==='fade'?Math.max(0,Math.min(1,local/.3,(c.duration-local)/.3)):1);
  if(STICKER_SVGS[c.stickerId]){const im=stickerImage(c.stickerId);if(im.complete&&im.naturalWidth)ctx.drawImage(im,-size/2,-size/2,size,size);ctx.restore();return;}
  ctx.font=layout.font;ctx.textAlign='center';ctx.textBaseline='middle';
  if(['subtitle','badge'].includes(c.textStyle)){ctx.fillStyle=c.textStyle==='badge'?(c.badgeColor||'#eea19e'):'#16141bc4';ctx.beginPath();ctx.roundRect(-width/2,-height/2,width,height,c.textStyle==='badge'?12:6);ctx.fill();}
  ctx.shadowColor=c.textStyle==='neon'?(c.color||'#ffacd6'):'#3d252d66';ctx.shadowBlur=c.textStyle==='neon'?18:3;ctx.fillStyle=c.color||'#fff';
  let wordIndex=0;const count=String(c.title||'').trim().split(/\s+/).length,activeWord=Math.min(count-1,Math.floor(local/c.duration*count));
  lines.forEach((line,i)=>{const y=(i-(lines.length-1)/2)*size*1.2;if(c.textStyle==='karaoke'){let x=-ctx.measureText(line).width/2;ctx.textAlign='left';for(const word of line.split(' ')){ctx.fillStyle=wordIndex++===activeWord?(c.karaokeColor||'#ffd372'):(c.color||'#fff');ctx.fillText(word,x,y);x+=ctx.measureText(word+' ').width;}}else{ctx.fillText(line,0,y);if(c.textStyle==='neon'){ctx.shadowBlur=6;ctx.fillText(line,0,y);ctx.shadowBlur=18;}}});
  if(c.textStyle==='script'){ctx.shadowBlur=0;ctx.strokeStyle=c.color||'#fff';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.beginPath();for(const [x,y,dx,dy] of [[-width/2-12,-height/2, -10,-8],[-width/2-16,-height/2+27,-14,0],[width/2+12,-height/2+4,10,-10],[width/2+18,height/2-12,13,3]]){ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);}ctx.stroke();}ctx.restore();
}
function setCanvasSize(height){
  const dims=ratio.split(':').map(Number);canvas.height=height||Math.round(1080*dims[1]/Math.min(...dims)/2)*2;canvas.width=Math.round(canvas.height*dims[0]/dims[1]/2)*2;
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const size=dims.map(n=>Math.round(1080*n/Math.min(...dims)));$('canvasInfo').textContent=size[0]+' × '+size[1]+' · '+ratio;
  fitCanvas();
}
function changeAspectRatio(r){
  if(!['9:16','16:9','1:1','4:5'].includes(r)||r===ratio)return;
  const before=ratio.split(':').map(Number),after=r.split(':').map(Number),heightRatio=(after[1]/after[0])/(before[1]/before[0]);
  mutate(()=>{ratio=r;for(const c of clips){c.yOffset*=heightRatio;for(const k of c.keyframes||[])k.yOffset*=heightRatio;if(c.track==='video')c.fit='contain';}setCanvasSize();});
  renderInspector();drawCompositeFrame();
}
function setCanvasZoom(value){canvasZoom=Number(value)||1;fitCanvas();}
function setTimelineZoom(v){const center=($('tlScroll').scrollLeft+$('tlScroll').clientWidth/2)/pxPerSec;pxPerSec=C.clamp(Number(v),8,180);$('timelineZoom').value=pxPerSec;renderRuler();renderTimeline();$('tlScroll').scrollLeft=Math.max(0,center*pxPerSec-$('tlScroll').clientWidth/2);updatePlayheadUI();}
function togglePopover(id){const el=$(id);if(!el)return;const opening=el.hidden;for(const key of ['popStickers','popFilters','popSpeed'])$(key).hidden=key===id?!opening:true;syncFloating();TibeUI.popoverChanged(id,opening);}
function toggleAllPopovers(){const show=['popStickers','popFilters','popSpeed'].some(id=>$(id).hidden);for(const id of ['popStickers','popFilters','popSpeed'])$(id).hidden=!show;$('popoverButton').classList.toggle('active',show);TibeUI.popoverChanged('popStickers',show);}
function toggleTheme(){document.body.classList.toggle('dark-mode');}
function toggleMonitor(){monitorMuted=!monitorMuted;if(monitor)monitor.gain.value=monitorMuted?0:1;$('monitorButton').innerHTML=icon(monitorMuted?'mute':'volume');$('monitorButton').classList.toggle('active',monitorMuted);}
function toggleSnap(){snap=!snap;$('snapButton').classList.toggle('active',snap);toast(snap?'Bật bắt dính clip':'Tắt bắt dính clip');}
function addClip(clip,{revealTrack=false}={}){if(exporting)return;let added;mutate(()=>{const c=C.normalize(clip);if(revealTrack&&trackState[c.track])trackState[c.track].hidden=false;clips.push(c);selectedClipId=c.id;selectedIds=new Set([c.id]);added=c;});renderInspector();prepareMedia();return added;}
function addTextClip(title='Nhập nội dung của bạn',style='heading'){
  if(exporting)return;if(trackState.text?.locked)return toast('Track văn bản đang khóa. Mở khóa để thêm chữ.');
  TibeLibrary.stopSource();pauseAll();inspectorTab='video';
  document.querySelectorAll('.insp-tab').forEach(button=>button.classList.toggle('active',button.dataset.insp==='video'));
  const height=450*canvas.height/canvas.width,start=currentTime;
  const added=addClip({track:'text',title,start,duration:4,yOffset:['subtitle','karaoke'].includes(style)?height*.28:0,fontSize:style==='subtitle'?30:44,textStyle:style,color:'#ffffff',anim:'none'},{revealTrack:true});
  if(!added)return;seekTo(start);$('inspContent').scrollTop=0;
  requestAnimationFrame(()=>{if(selectedClipId!==added.id)return;const input=$('inspTextInput');if(input){input.focus({preventScroll:true});input.select();}});
}
function addSticker(key,placement={}){const title=TibeUI.stickerName(key);addClip({track:'sticker',title,stickerId:STICKER_SVGS[key]?key:undefined,stickerSymbol:STICKER_SVGS[key]?undefined:key,start:currentTime,duration:4,xOffset:110,yOffset:0,anim:'pop_bounce',...placement});TibeUI.rememberSticker(key);}
function addLibraryMedia(id,startOverride,trackOverride){
  const m=media[id];if(!m)return;
  const track=trackOverride||(m.type==='audio'?'audio':'video');
  if(trackState[track]?.locked)return toast('Track đang khóa.');
  const start=startOverride??(m.type==='audio'?currentTime:Math.max(0,...clips.filter(c=>c.track==='video').map(c=>c.start+c.duration)));
  addClip({track,title:m.name,mediaId:id,start,duration:m.type==='image'?4:m.duration,transition:'none',audioRole:m.url?.startsWith('/workspace/tts/')?'voice':'music',volume:m.type==='audio'?.7:1});seekTo(start);renderInspector();
}
function addMediaToTimeline(title){const m=Object.values(media).find(m=>m.name===title);if(m)addLibraryMedia(m.id);}
function splitClipAtPlayhead(){
  const targets=clips.filter(c=>selectedIds.has(c.id)&&!trackState[c.track]?.locked),pairs=targets.map(c=>({c,result:C.split(c,currentTime)})).filter(x=>x.result);
  if(!pairs.length)return toast('Đặt vạch phát vào giữa clip được chọn để cắt.');
  mutate(()=>{selectedIds.clear();for(const {c,result} of pairs){clips.splice(clips.indexOf(c),1,...result);selectedIds.add(result[1].id);}selectedClipId=[...selectedIds][0];});renderInspector();prepareMedia();
}
function trimClipLeft(){const c=selected();if(!c||currentTime<=c.start||currentTime>=c.start+c.duration)return;mutate(()=>Object.assign(c,C.trim(c,currentTime-c.start,c.duration)));renderInspector();}
function trimClipRight(){const c=selected();if(!c||currentTime<=c.start||currentTime>=c.start+c.duration)return;mutate(()=>Object.assign(c,C.trim(c,0,currentTime-c.start)));renderInspector();}
function deleteSelectedClip(ripple=false){
  const targets=clips.filter(c=>selectedIds.has(c.id)&&!trackState[c.track]?.locked);if(!targets.length)return;
  mutate(()=>{for(const c of targets.slice().sort((a,b)=>b.start-a.start)){clips=clips.filter(x=>x.id!==c.id);if(ripple)clips.filter(x=>x.track===c.track&&x.start>=c.start+c.duration-.001).forEach(x=>x.start-=c.duration);}selectedClipId=null;selectedIds.clear();});renderInspector();syncMedia();
}
function duplicateSelected(overlay=false){
  const targets=clips.filter(c=>selectedIds.has(c.id)&&!trackState[c.track]?.locked);if(!targets.length)return;
  if(overlay&&targets.some(c=>!['video','overlay'].includes(c.track)))return toast('Chọn video hoặc ảnh để thêm lớp phủ.');
  const first=Math.min(...targets.map(c=>c.start)),end=Math.max(...targets.map(c=>c.start+c.duration));
  mutate(()=>{selectedIds.clear();for(const c of targets){const clone=C.copy(c);clone.id=C.uid();clone.start=overlay?currentTime+c.start-first:c.start+end-first;if(overlay){clone.track='overlay';clone.scale=.75;clone.xOffset=80;clone.yOffset=60;}clips.push(clone);selectedIds.add(clone.id);}selectedClipId=[...selectedIds][0];});renderInspector();prepareMedia();
}
function freezeFrame(){const c=selected();if(c&&trackState[c.track]?.locked)return toast('Track đang khóa.');if(!c||!['video','overlay'].includes(c.track))return toast('Chọn clip hình ảnh hoặc video.');const m=media[c.mediaId],source=m?.type==='image'?loadImage(m):instances.get(c.id)?.el;if(!source)return toast('Chưa có khung hình để đóng băng.');const off=document.createElement('canvas');off.width=source.videoWidth||source.naturalWidth;off.height=source.videoHeight||source.naturalHeight;if(!off.width||!off.height)return toast('Đợi tư liệu tải xong.');off.getContext('2d').drawImage(source,0,0);const id=C.uid();mutate(()=>{media[id]={id,name:'Freeze frame',type:'image',url:off.toDataURL('image/png'),duration:2.5};clips.push(C.normalize({...C.copy(c),id:C.uid(),mediaId:id,title:'Freeze frame',sourceIn:0,speed:1,start:currentTime,duration:2.5,keyframes:[]}));selectedClipId=clips[clips.length-1].id;});renderInspector();}
function extractAudio(){const c=selected();if(c&&trackState[c.track]?.locked)return toast('Track đang khóa.');if(!c||media[c.mediaId]?.type!=='video')return toast('Chọn video có âm thanh để tách tiếng.');if(media[c.mediaId].hasAudio===false)return toast('Video này không có âm thanh.');const clone=C.copy(c);mutate(()=>{c.muted=true;clone.id=C.uid();clone.track='audio';clone.title='Âm thanh · '+c.title;clone.muted=false;clips.push(clone);selectedClipId=clone.id;});prepareMedia();renderInspector();toast('Đã tách âm thanh sang track Audio.');}
function setPlaybackRate(rate,btn){const c=selected();if(c&&trackState[c.track]?.locked)return toast('Track đang khóa.');if(!c||!['video','audio','overlay'].includes(c.track))return toast('Chọn video hoặc âm thanh để đổi tốc độ.');mutate(()=>C.speed(c,Number(rate)));if(btn){document.querySelectorAll('.speed-pill').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}if(!document.activeElement?.matches('#inspContent input'))renderInspector();syncFloating();}
function applyLut(name,el){TibeLibrary.stopLookPreview();const c=selected();if(!c||!['video','overlay'].includes(c.track))return toast('Chọn clip hình ảnh hoặc video để áp dụng màu.');if(trackState[c.track]?.locked)return toast('Track đang khóa.');if(!TibeLooks.filters.some(f=>f.id===name))return;updateActiveClip('filter',name);if(currentTime<c.start||currentTime>=c.start+c.duration)seekTo(c.start+Math.min(.15,c.duration/2));TibeLibrary.syncSelection();renderInspector();syncFloating();}
function adjustColor(prop,val){const c=selected();if(!c)return;mutate(()=>{c.adjust={...c.adjust,[prop]:Number(val)};},c.id+prop);}
function applyTransition(style){const c=selected();if(!c||c.track!=='video')return toast('Chọn clip ở track Video. Chuyển cảnh áp dụng ở đầu clip.');if(trackState[c.track]?.locked)return toast('Track đang khóa.');if(!TibeLooks.transitions.some(t=>t.id===style))return;updateActiveClip('transition',style);toast('Đã áp dụng '+(TibeLooks.transitions.find(t=>t.id===style)?.name||style));}
function addKeyframe(){
  const c=selected();if(!c)return;const time=C.clamp(currentTime-c.start,0,c.duration),value=C.transform(c,time);
  mutate(()=>{const existing=c.keyframes.find(k=>Math.abs(k.time-time)<.025);if(existing)Object.assign(existing,value);else c.keyframes.push({time,...value});});renderInspector();toast('Keyframe tại '+formatTime(time));
}
function removeKeyframes(){updateActiveClip('keyframes',[]);renderInspector();}
function escapeHTML(text){return String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function rangeControl(label,prop,value,min,max,step=1,handler='updateActiveClip'){
  value=Math.round(Number(value)*100)/100;
  return `<label class="prop-row"><span>${label}</span><input type="range" aria-label="${label}" min="${min}" max="${max}" step="${step}" value="${value}" data-control="${prop}" oninput="${handler}('${prop}',Number(this.value));this.nextElementSibling.value=this.value" onchange="${prop==='speed'?'renderInspector()':''}"><input type="number" aria-label="${label}: giá trị" min="${min}" max="${max}" step="${step}" value="${value}" oninput="if(this.value!==''){${handler}('${prop}',ClipCore.clamp(Number(this.value),${min},${max}));this.previousElementSibling.value=this.value}" onchange="this.value=ClipCore.clamp(Number(this.value),${min},${max});${prop==='speed'?'renderInspector()':''}"></label>`;
}
function selectControl(label,prop,value,options){return `<label class="prop-row"><span>${label}</span><select aria-label="${label}" class="num-box wide" onchange="updateActiveClip('${prop}',this.value)">${options.map(([v,t])=>`<option value="${v}" ${value===v?'selected':''}>${t}</option>`).join('')}</select></label>`;}
function renderInspector(){
  const c=selected(),el=$('inspContent');$('selectedCount').textContent=selectedIds.size?selectedIds.size+' clip':'Chưa chọn';
  if(!c){el.innerHTML=`<div class="empty-state">${icon('pointer')}<strong>Chọn một clip để chỉnh sửa</strong><span>Chọn clip trên timeline để bắt đầu.</span></div>`;syncFloating();return;}
  const section=(title,body,reset='',extra='')=>`<section class="insp-section"><div class="sec-title"><span>${icon('chevron')}${title}</span><div class="sec-tools">${extra}${reset?`<button title="Reset ${title}" onclick="${reset}">${icon('reset')}</button>`:''}</div></div>${body}</section>`;
  const toggle=(label,key,value)=>`<label class="toggle-line">${label}<input class="switch" aria-label="${label}" type="checkbox" ${value?'checked':''} onchange="updateActiveClip('${key}',this.checked)"></label>`;
  const percent=(label,prop,value,max=100)=>rangeControl(label,prop,Math.round(value*100),prop==='scale'?10:0,max,1,'setPercent');
  const visual=['video','overlay'].includes(c.track),hasAudio=media[c.mediaId]?.type!=='image'&&!!media[c.mediaId]&&media[c.mediaId].hasAudio!==false,state=C.transform(c,C.clamp(currentTime-c.start,0,c.duration));let html='';
  if(c.omeraSceneId){
    html+=section('Omera · Bento',`<label class="dialog-label">Phụ đề cảnh<textarea maxlength="500" rows="4" oninput="updateActiveClip('omeraCaption',this.value)">${escapeHTML(c.omeraCaption??c.title)}</textarea></label>`+
      selectControl('Bố cục','omeraLayout',c.omeraLayout||'BENTO_HERO_GLASS',[['BENTO_SPLIT_VERTICAL','Before / After'],['BENTO_PIP_DIAGRAM','Video + sơ đồ'],['BENTO_TRIPLE_GEAR','Kết quả + thiết bị'],['BENTO_HERO_GLASS','Hero Glass']])+
      `<label class="dialog-label">Thông số<input maxlength="180" value="${escapeHTML(c.omeraSettings||'')}" oninput="updateActiveClip('omeraSettings',this.value)"></label><label class="dialog-label">Thiết bị<input maxlength="120" value="${escapeHTML(c.omeraGear||'')}" oninput="updateActiveClip('omeraGear',this.value)"></label>`);
    html+=section('Thời gian',`<label class="dialog-label">Bắt đầu · s<input type="number" min="0" step="0.01" value="${c.start}" onchange="changeTiming('start',this.value)"></label><label class="dialog-label">Thời lượng · s<input type="number" min="0.6" step="0.01" value="${c.duration}" onchange="changeTiming('duration',this.value)"></label><p class="note-label">Khung hình, karaoke, Hook và SFX dùng thiết kế Omera. Có thể thêm chữ hoặc lớp phủ thường.</p>`);
    el.innerHTML=html;if(trackState[c.track]?.locked)el.querySelectorAll('input,textarea,select,button').forEach(control=>control.disabled=true);TibeUI.syncSelects();return;
  }
  if(inspectorTab==='audio'){
    html+=hasAudio?section('Audio',percent('Volume %','volume',c.volume,200)+rangeControl('Fade In · s','fadeIn',c.fadeIn,0,Math.min(30,c.duration),.1)+rangeControl('Fade Out · s','fadeOut',c.fadeOut,0,Math.min(30,c.duration),.1)+toggle('Mute clip','muted',c.muted)):'<p class="note-label">Clip này không có nguồn âm thanh. Chọn video có tiếng hoặc clip Audio.</p>';
    if(hasAudio){html+=section('Audio Ducking',toggle('Giảm nhạc khi có giọng nói','ducking',c.ducking)+selectControl('Vai trò','audioRole',c.audioRole||'music',[['music','Music / original'],['voice','Voice / TTS']])+`<p class="note-label">Nhạc được giảm còn 28% khi chồng lên clip Voice / TTS, với chuyển tiếp 120 ms.</p>`);html+=section('Voice Effects',selectControl('Effect','voiceEffect',c.voiceEffect||'none',[['none','None'],['deep','Deep'],['high','High'],['echo','Echo'],['radio','Radio']])+`<p class="note-label">Deep / High đổi cao độ mà giữ thời lượng clip. MP4 xử lý tiếng bằng FFmpeg.</p>${media[c.mediaId]?.type==='video'?`<button class="soft-button" onclick="extractAudio()">${icon('audio')}Tách âm thanh · Extract Audio</button>`:''}`);}
  }else if(inspectorTab==='speed'){
    html+=section('Normal Speed',`<div class="speed-buttons">${[.25,.5,1,2,4].map(n=>`<button class="speed-pill ${c.speed===n?'active':''}" onclick="setPlaybackRate(${n})">${n}x</button>`).join('')}</div>${rangeControl('Speed · x','speed',c.speed,.25,4,.05,'setClipSpeed')}`);
    html+=section('Curve Speed',curveGraph(c)+`<div class="curve-presets">${[['none','Normal'],['montage','Montage'],['hero','Hero'],['bullet','Bullet'],['jump_cut','Jump Cut']].map(([v,t])=>`<button class="${(c.speedCurve||'none')===v?'active':''}" onclick="setSpeedCurve('${v}')">${t}</button>`).join('')}</div><p class="note-label">Đường cong Bezier điều khiển tốc độ thật. Nguồn được giữ nguyên khi đổi preset.<br>Duration ${formatTime(c.duration)} · Source ${formatTime(C.sourceOffset(c,c.duration))}</p>`);
  }else if(inspectorTab==='anim'){
    html+=section('Animation',selectControl('Preset','anim',c.anim||'none',[['none','None'],['fade','Fade'],['ken_burns','Ken Burns'],['zoom_in','Zoom In'],['slide_up','Slide Up'],['pop_bounce','Pop Bounce']]),"updateActiveClip('anim','none');renderInspector()");
    html+=section('Keyframes · '+c.keyframes.length,`<div class="keyframe-controls"><button class="icon-btn" title="Keyframe trước" onclick="jumpKeyframe(-1)">${icon('prev')}</button><button class="soft-button" onclick="addKeyframe()">${icon('keyframe')}Add keyframe</button><button class="icon-btn" title="Keyframe tiếp theo" onclick="jumpKeyframe(1)">${icon('next')}</button></div><button class="link-button" onclick="deleteCurrentKeyframe()">Xóa keyframe tại vạch phát</button><p class="note-label">Chỉnh Position, Scale, Rotation hoặc Opacity để tạo điểm tại vạch phát khi clip đã có keyframe.</p>`,"removeKeyframes()");
  }else{
    if(c.track==='text'||c.track==='sticker')html+=section(c.track==='text'?'Text / Caption':'Sticker',`<textarea class="clip-name" id="inspTextInput" rows="2" oninput="updateActiveClip('title',this.value)">${escapeHTML(c.title)}</textarea>`);
    html+=section('Transform',`<div class="prop-row"><span>Position</span><div class="xy-inputs"><label class="xy-field">X<input type="number" aria-label="Vị trí X" value="${Math.round(state.xOffset)}" oninput="updateActiveClip('xOffset',Number(this.value))"></label><label class="xy-field">Y<input type="number" aria-label="Vị trí Y" value="${Math.round(state.yOffset)}" oninput="updateActiveClip('yOffset',Number(this.value))"></label></div></div>`+percent('Scale %','scale',state.scale,500)+rangeControl('Rotation °','rotation',state.rotation,-180,180)+`<div class="flip-buttons"><button class="${c.flipX?'active':''}" onclick="updateActiveClip('flipX',${!c.flipX});renderInspector()">${icon('flipH')}Flip H</button><button class="${c.flipY?'active':''}" onclick="updateActiveClip('flipY',${!c.flipY});renderInspector()">${icon('flipV')}Flip V</button></div>`,"resetTransform()",`<button title="Thêm keyframe" onclick="addKeyframe()">${icon('keyframe')}</button>`);
    if(c.track==='text'){
      html+=section('Text Style',`<div class="text-presets">${[['heading','Heading'],['script','Script'],['subtitle','Subtitle'],['karaoke','Karaoke'],['neon','Neon Glow'],['badge','Badge']].map(([v,t])=>`<button class="${v} ${c.textStyle===v?'active':''}" onclick="updateActiveClip('textStyle','${v}');renderInspector()">${t}</button>`).join('')}</div>`+rangeControl('Font Size','fontSize',c.fontSize,12,120)+colorControl('Text Color','color',c.color||'#ffffff')+(c.textStyle==='karaoke'?colorControl('Active Word','karaokeColor',c.karaokeColor||'#ffd372'):'')+(c.textStyle==='badge'?colorControl('Badge Color','badgeColor',c.badgeColor||'#eea19e'):''));
    }
    if(visual&&c.effect&&c.effect!=='none')html+=section('Video Effect',`<div class="effect-current">${icon('effects')}<span>${escapeHTML(TibeEffects.catalog.find(f=>f.id===c.effect)?.name||c.effect)}</span><button class="link-button" onclick="TibeUI.applyEffect('none')">Gỡ</button></div>`+rangeControl('Intensity %','effectAmount',(c.effectAmount??.7)*100,0,100,1,'setPercent'));
    if(visual&&c.filter&&c.filter!=='original')html+=section('Bộ lọc màu',`<div class="effect-current">${icon('filters')}<span>${escapeHTML(TibeLooks.filters.find(f=>f.id===c.filter)?.name||c.filter)}</span><button class="link-button" onclick="applyLut('original')">Gỡ</button></div>`+rangeControl('Cường độ %','filterAmount',Math.round((c.filterAmount??1)*100),0,100,1,'setPercent'));
    if(visual){
      const adjustments=[['brightness','Brightness','brightness'],['contrast','Contrast','contrast'],['saturation','Saturation','saturation'],['temp','Temperature','temperature'],['vignette','Vignette','vignette'],['sharpen','Sharpen','effects'],['highlight','Highlight','sun'],['shadow','Shadow','moon']];
      const controls=adjustments.map(([prop,label,ico])=>rangeControl(label,prop,c.adjust[prop]||0,['vignette','sharpen'].includes(prop)?0:-50,50,1,'adjustColor').replace(`<span>${label}</span>`,`<span>${label}${icon(ico)}</span>`));
      html+=section('Adjust',controls.slice(0,5).join('')+`<details class="more-adjust"><summary>More adjustments</summary>${controls.slice(5).join('')}</details>`,"resetColor()");
    }
    html+=section('Blend',selectControl('Mode','blend',c.blend||'source-over',[['source-over','Normal'],['screen','Screen'],['multiply','Multiply'],['overlay','Overlay'],['darken','Darken'],['lighten','Lighten']])+percent('Opacity %','opacity',state.opacity));
    if(visual){
      html+=section('Background',`<label class="toggle-line">Canvas background<input class="switch" aria-label="Canvas background" type="checkbox" ${projectCanvas.enabled?'checked':''} onchange="setCanvasOption('enabled',this.checked)"></label><label class="color-row">Pastel color<input type="color" aria-label="Canvas color" value="${projectCanvas.color}" oninput="setCanvasOption('color',this.value)"></label><label class="toggle-line">Canvas Blur<input class="switch" aria-label="Canvas Blur" type="checkbox" ${projectCanvas.blur?'checked':''} onchange="setCanvasOption('blur',this.checked)"></label>`+selectControl('Fit','fit',c.fit||'cover',[['cover','Cover'],['contain','Contain']])+rangeControl('Crop %','crop',c.crop,0,40));
      html+=section('Cutout & Mask',toggle('Chroma Key','chroma',c.chroma)+colorControl('Key Color','chromaColor',c.chromaColor)+rangeControl('Strength','chromaStrength',c.chromaStrength,0,100)+rangeControl('Spill / Shadow','chromaShadow',c.chromaShadow,0,100)+selectControl('Mask','mask',c.mask||'none',[['none','None'],['circle','Circle'],['rectangle','Rectangle'],['split','Split'],['filmstrip','Filmstrip'],['heart','Heart'],['star','Star']])+rangeControl('Feather','maskFeather',c.maskFeather,0,50)+toggle('Invert Mask','maskInvert',c.maskInvert));
      if(c.track==='video')html+=section('Transition',selectControl('Preset','transition',c.transition||'none',TibeLooks.transitions.map(t=>[t.id,t.name]))+rangeControl('Duration · s','transitionDuration',c.transitionDuration,.1,Math.min(3,c.duration),.1));
    }
    html+=section('Timing',`<div class="timing-grid"><label>Start · s<input aria-label="Bắt đầu clip" type="number" min="0" step="0.01" value="${c.start.toFixed(2)}" oninput="changeTiming('start',this.value,false)" onchange="renderInspector()"></label><label>Duration · s<input aria-label="Độ dài clip" type="number" min="0.05" step="0.01" value="${c.duration.toFixed(2)}" oninput="changeTiming('duration',this.value,false)" onchange="renderInspector()"></label></div>`);
    html+=section('Clip',`<div class="clip-meta"><span>${escapeHTML(c.title)}</span><span>${selectedIds.size} selected</span></div><div class="inspector-actions"><button class="soft-button" onclick="duplicateSelected()">${icon('duplicate')}Nhân đôi</button><button class="soft-button" onclick="duplicateSelected(true)" ${visual?'':'disabled'}>${icon('layers')}Lớp phủ</button><button class="soft-button" onclick="deleteSelectedClip(true)">${icon('trash')}Xóa nối tiếp</button><button class="soft-button" onclick="updateActiveClip('hidden',${!c.hidden});renderInspector()">${icon(c.hidden?'eye':'eyeOff')}${c.hidden?'Hiện clip':'Ẩn clip'}</button></div>`);
  }
  el.innerHTML=html;if(trackState[c.track]?.locked)el.querySelectorAll('input,textarea,select,button').forEach(control=>control.disabled=true);syncFloating();TibeUI.syncSelects();
}
function colorControl(label,key,value){const safe=/^#[0-9a-f]{6}$/i.test(value)?value:'#ffffff';return `<label class="color-row">${label}<input type="color" aria-label="${label}" value="${safe}" oninput="updateActiveClip('${key}',this.value)"></label>`;}

function switchInspTab(tab,button){inspectorTab=tab;if(tab==='speed'&&button)togglePopover('popSpeed');else if(button)$('popSpeed').hidden=true;document.querySelectorAll('.insp-tab').forEach(b=>b.classList.toggle('active',b.dataset.insp===tab));renderInspector();}
function selectRail(tab,button){TibeUI.stopEffectPreview();TibeLibrary.stopLookPreview();activeTab=tab;for(const id of ['popStickers','popFilters','popSpeed'])$(id).hidden=true;document.querySelectorAll('.rail-item').forEach(b=>b.classList.toggle('active',b===button||b.dataset.tab===tab));renderDrawer();}
function tile(title,description,icon,fn){const b=document.createElement('button');b.className='tool-tile';b.innerHTML=`<span>${globalThis.iconForTile(icon)}</span><strong>${title}</strong><small>${description}</small>`;b.onclick=fn;return b;}
function renderDrawer(){
  const names={media:'Media',templates:'Mẫu dựng',text:'Văn bản & phụ đề',audio:'Âm thanh',transitions:'Chuyển cảnh',effects:'Hiệu ứng video',filters:'Bộ lọc màu',stickers:'Nhãn dán'};
  $('drawerTitle').textContent=names[activeTab]||'Tư liệu';const drawer=$('drawerContent');drawer.replaceChildren();TibeUI.resetEffectCards();TibeLibrary.resetCards();
  const drawerAdd=document.querySelector('.drawer-header>.icon-btn');drawerAdd.hidden=!['media','audio'].includes(activeTab);drawerAdd.title='Nhập tư liệu';
  document.querySelector('.filter-pills').hidden=activeTab!=='media';document.querySelector('.library-search').hidden=!['media','audio'].includes(activeTab);document.querySelector('.import-button').hidden=!['media','audio'].includes(activeTab);
  if(activeTab==='stickers'){TibeUI.renderStickerDrawer(drawer);return;}
  if(activeTab==='effects'){TibeUI.renderEffectsDrawer(drawer);return;}
  if(activeTab==='filters'||activeTab==='transitions'){TibeLibrary.renderDrawer(drawer,activeTab);return;}
  if(activeTab==='templates'){TibeProjects.renderDrawer(drawer);return;}
  if(activeTab==='media'||activeTab==='audio'){
    const list=Object.values(media).filter(m=>(activeTab!=='audio'||m.type==='audio')&&(activeTab==='audio'||mediaFilter==='all'||m.type===mediaFilter)&&m.name.toLowerCase().includes(mediaSearch.toLowerCase()));
    const count=document.createElement('div');count.className='library-count';count.innerHTML=`<span>${list.length} tư liệu</span><small>Kéo thả hoặc bấm +</small>`;drawer.append(count);
    if(activeTab==='audio'){const voice=tile('Tạo giọng đọc','Tiếng Việt & tiếng Anh','audio',openVoice);voice.style.marginBottom='14px';drawer.append(voice,tile('Xử lý âm thanh · Concat','Lọc nhiễu, cân âm, đổi giọng & tiếng vang','effects',()=>TibeConcat.audio()));}
    const grid=document.createElement('div');grid.className='media-grid';drawer.append(grid);if(activeTab==='media'&&!mediaSearch&&mediaFilter==='all'){const upload=document.createElement('button');upload.className='library-upload';upload.innerHTML=icon('plus')+'<span>Upload media</span>';upload.onclick=()=>$('fileInput').click();grid.append(upload);}
    for(const m of list){
      const card=document.createElement('article');card.className='media-card'+(m.id===selectedAssetId?' asset-selected':'');card.dataset.type=m.type;card.tabIndex=0;card.draggable=true;card.setAttribute('role','button');card.setAttribute('aria-label',m.name);card.title='Kéo vào timeline hoặc bấm + để thêm';
      const thumbnail=document.createElement('div');thumbnail.className='media-thumb';thumbnail.innerHTML=icon(m.type==='audio'?'audio':m.type==='video'?'video':'image');
      const poster=m.thumbnail||(m.type==='image'?(m.url||m.runtimeUrl):null);if(poster){thumbnail.style.backgroundImage='url("'+(window.TibeBackend?.url?.(poster)||poster).replace(/["\\\n\r]/g,'')+'")';thumbnail.classList.add('has-poster');}
      else if(m.type==='image'){const image=loadImage(m);image.addEventListener('load',()=>{thumbnail.style.backgroundImage='url("'+image.src+'")';thumbnail.classList.add('has-poster');},{once:true});}
      const badge=document.createElement('span');badge.className='media-badge';badge.textContent=m.type==='image'?'ẢNH':formatTime(m.duration).slice(0,-2);thumbnail.append(badge);
      const add=document.createElement('button');add.className='asset-add';add.innerHTML=icon('plus');add.title='Thêm '+m.name+' vào timeline';add.onclick=e=>{e.stopPropagation();addLibraryMedia(m.id);};thumbnail.append(add);
      const name=document.createElement('span');name.className='asset-name';name.textContent=m.name;const meta=document.createElement('span');meta.className='asset-meta';meta.textContent=m.type==='image'?'Ảnh tĩnh':m.type==='video'?(m.width?m.width+' × '+m.height+' · Video':'Video'):'Âm thanh';
      card.append(thumbnail,name,meta);card.onclick=()=>{selectedAssetId=m.id;document.querySelectorAll('.media-card').forEach(x=>x.classList.toggle('asset-selected',x===card));$('assetInfo').innerHTML=icon('info')+'<span>'+escapeHTML(m.name)+' · '+(m.type==='image'?'Ảnh':formatTime(m.duration))+'</span>';};card.ondblclick=()=>addLibraryMedia(m.id);card.onkeydown=e=>{if(e.target===card&&e.key==='Enter')addLibraryMedia(m.id);};card.ondragstart=e=>{e.dataTransfer.setData('application/x-clipcut-media',m.id);e.dataTransfer.effectAllowed='copy';};grid.append(card);
      TibeLibrary.attachMediaCard(card,thumbnail,m);if(m.type==='audio'&&!m.peaks)buildWaveform(m);
    }
    if(!list.length){const empty=document.createElement('div');empty.className='empty-state';empty.innerHTML=icon('media')+'<span>Chưa có tư liệu phù hợp.<br>Nhập tệp hoặc đổi bộ lọc tìm kiếm.</span>';drawer.append(empty);}
    const note=document.createElement('p');note.className='drawer-note';note.textContent='Tư liệu mẫu là ảnh tĩnh. Bấm đúp để thêm cuối video; kéo thả để đặt vào vị trí mong muốn.';drawer.append(note);return;
  }
  const grid=document.createElement('div');grid.className='tool-tiles';drawer.append(grid);
  if(activeTab==='text'){
    grid.append(tile('Thêm văn bản','Hiện ngay trên khung hình · sửa nội dung bên phải','plus',()=>addTextClip()));
    grid.append(tile('Văn bản thành giọng nói','CIT Voice Studio / Edge TTS · nghe thử & thêm vào video','audio',openVoice));
    for(const [style,title,desc] of [['heading','Heading','Tiêu đề rõ nét'],['script','Good Vibes','Chữ viết tay & tia nắng'],['subtitle','Subtitle','Phụ đề có nền'],['karaoke','Karaoke','Tô màu từng từ'],['neon','Neon Glow','Chữ phát sáng'],['badge','Badge','Hộp màu pastel']])grid.append(tile(title,desc,style==='karaoke'?'karaoke':'text',()=>addTextClip(style==='script'?'Good\nVibes':title,style)));
    grid.append(tile('Nhập phụ đề SRT','Giữ nguyên mốc thời gian','upload',()=>$('subtitleInput').click()),tile('Xuất phụ đề SRT','Tải toàn bộ track chữ','download',()=>download(new Blob([C.srt(clips)],{type:'text/plain'}),projectName+'.srt')));
  }
  if(activeTab==='templates')grid.append(tile('Summer Vibes','Ảnh mùa hè, nhạc và chữ','sun',()=>loadPresetProject('summer_vibes')),tile('Dàn cảnh từ kịch bản','Tự chia câu thành các cảnh','effects',openReaModal),tile('Dự án mới','Bắt đầu với timeline trống','plus',newProject));

}
function filterMedia(type,button){mediaFilter=type;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===type));renderDrawer();}
async function readMetadata(file,url,type){
  if(type==='image'){const image=new Image();image.src=url;await image.decode();return{duration:4,width:image.naturalWidth,height:image.naturalHeight};}
  return new Promise((resolve,reject)=>{const el=document.createElement(type),timer=setTimeout(()=>{el.removeAttribute('src');el.load();reject(Error('Không đọc được '+file.name));},15000);el.preload='metadata';el.onloadedmetadata=()=>{clearTimeout(timer);if(!Number.isFinite(el.duration)||el.duration<=0)return reject(Error('Không đọc được thời lượng.'));resolve({duration:el.duration,width:el.videoWidth||0,height:el.videoHeight||0});el.removeAttribute('src');el.load();};el.onerror=()=>{clearTimeout(timer);reject(Error('Trình duyệt không hỗ trợ '+file.name+'. Dùng MP4 H.264/AAC hoặc WebM.'));};el.src=url;});
}
async function importMediaFiles(list){
  for(const file of list){try{if(!/^(image|video|audio)\//.test(file.type))throw Error('Chỉ nhập ảnh, video hoặc âm thanh.');if(file.size>512*1024*1024)throw Error('Tối đa 512 MB mỗi tư liệu.');toast('Đang nhập '+file.name);const id=C.uid(),type=file.type.split('/')[0],url=URL.createObjectURL(file);const info=await readMetadata(file,url,type);const item={id,name:file.name,type,...info};files.set(id,file);
      if(backend){const form=new FormData();form.append('file',file);const response=await appFetch('/api/upload',{method:'POST',body:form});const data=await response.json();if(!response.ok)throw Error(data.error);item.url=data.url;item.thumbnail=data.thumbnail||undefined;if(type==='video')item.hasAudio=!!data.metadata?.streams?.some(stream=>stream.codec_type==='audio');}
      else{await storeFile(id,file);item.runtimeUrl=url;}
      mutate(()=>media[id]=item);if(item.url)URL.revokeObjectURL(url);renderDrawer();if(type==='video')buildThumbnail(item);if(type==='audio')buildWaveform(item);toast('Đã nhập '+file.name+' · Kéo vào timeline hoặc bấm + để thêm.');
    }catch(e){toast(e.message);}}
}
function handleMediaUpload(e){importMediaFiles([...e.target.files]);e.target.value='';}
async function importSubtitles(e){try{const text=await e.target.files[0].text(),list=C.parseSRT(text);if(!list.length)throw Error('Không tìm thấy câu phụ đề SRT hợp lệ.');mutate(()=>{clips.push(...list);selectedClipId=list[0].id;});renderInspector();toast('Đã nhập '+list.length+' câu phụ đề.');}catch(error){toast(error.message);}e.target.value='';}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);}
function asDataURL(blob){return new Promise((res,rej)=>{const reader=new FileReader();reader.onload=()=>res(reader.result);reader.onerror=()=>rej(reader.error);reader.readAsDataURL(blob);});}
async function portableProject(allMedia=false){const p=snapshot(),used=new Set(p.clips.map(c=>c.mediaId).filter(Boolean));if(!allMedia)p.media=Object.fromEntries(Object.entries(p.media).filter(([id])=>used.has(id)));for(const m of Object.values(p.media)){delete m.runtimeUrl;if(m.url?.startsWith('assets/demo/')||m.url?.startsWith('data:'))continue;const file=files.get(m.id)||await readFile(m.id);if(file)m.url=await asDataURL(file);else if(m.url){const r=await appFetch(m.url);if(!r.ok)throw Error('Không tìm thấy '+m.name);m.url=await asDataURL(await r.blob());}else throw Error('Thiếu tư liệu '+m.name);}return p;}
async function saveProject(){try{toast('Đang đóng gói dự án cùng tư liệu…');const p=await portableProject();delete p.libraryId;download(new Blob([JSON.stringify(p)],{type:'application/json'}),projectName+'.clipcut');toast('Đã tải dự án có thể mở lại kèm tư liệu.');}catch(e){toast(e.message);}}
async function exportCapCutDraft(){
  closeDialog();if(!backend)return toast('Chạy run_studio.bat để xuất dự án CapCut.');
  try{toast('Đang đóng gói bản nháp CapCut…');const project=snapshot(),used=new Set(clips.map(c=>c.mediaId).filter(Boolean));project.media=Object.fromEntries(Object.entries(project.media).filter(([id])=>used.has(id)));
    for(const m of Object.values(project.media)){delete m.runtimeUrl;delete m.thumbnail;delete m.peaks;if(!m.url){const file=files.get(m.id)||await readFile(m.id);if(!file)throw Error('Thiếu tư liệu '+m.name);m.url=await asDataURL(file);}}
    project.stickerRasters={};for(const c of clips.filter(c=>STICKER_SVGS[c.stickerId])){const im=await stickerImage(c.stickerId).decode().then(()=>stickerImage(c.stickerId));const off=document.createElement('canvas');off.width=off.height=512;off.getContext('2d').drawImage(im,0,0,512,512);project.stickerRasters[c.stickerId]=off.toDataURL('image/png');}
    const response=await appFetch('/api/export/capcut_draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project})});if(!response.ok)throw Error((await response.json()).error);const report=JSON.parse(decodeURIComponent(response.headers.get('X-ClipCut-Report')||'%7B%7D'));
    download(await response.blob(),projectName+'_CapCut.zip');showDialog('Đã xuất bản nháp CapCut',`<p class="hint">Gói ZIP gồm draft_content.json, draft_meta_info.json, tư liệu và bản .clipcut. Thư mục bản nháp trên máy được ghi trong README của gói.</p><p class="hint">Chưa xác nhận mở thành công trong CapCut 8.3. Các hiệu ứng riêng của tibe cần xuất MP4 để giữ hình ảnh chính xác.</p><p class="note-label">${Number(report.warnings||0)} mục có thông tin chuyển đổi trong compatibility.json.</p><button class="soft-button" onclick="closeDialog()">Hoàn tất</button>`);
  }catch(error){toast(error.message);}
}
async function openProjectFile(e){try{const file=e.target.files[0];if(file.size>750*1024*1024)throw Error('Dự án quá lớn.');const p=JSON.parse(await file.text());const before=snapshot();applyProject(p);history.push(before);future.length=0;renderTimeline();currentTime=0;updatePlayheadUI();prepareMedia();saveSoon();toast('Đã mở '+projectName);}catch(error){toast(error.message);}e.target.value='';}
function newProject(){TibeProjects.newDialog();}
function renameProject(){showDialog('Tên dự án',`<label class="dialog-label">Tên dự án<input id="newName" maxlength="120" value="${escapeHTML(projectName)}"></label><button class="btn-export" onclick="mutate(()=>projectName=$('newName').value.trim()||'Untitled');refresh();closeDialog()">Lưu tên</button>`);}
function loadPresetProject(name){if(name==='summer_vibes'){const before=snapshot();applyProject(defaultProject());history.push(before);future.length=0;renderTimeline();currentTime=5.5;updatePlayheadUI();prepareMedia();saveSoon();}else openReaModal();}
function showDialog(title,body){window.TibeVoice?.stop();window.TibeConcat?.stop();TibeLibrary.stopSource();TibeLibrary.stopLookPreview();$('dialogTitle').textContent=title;$('dialogBody').innerHTML=body;const dialog=$('studioDialog');dialog.classList.toggle('voice-dialog',title==='Giọng đọc cho video');dialog.showModal();$('dialogClose').focus({preventScroll:true});$('dialogBody').scrollTop=0;dialog.scrollTop=0;}
function closeDialog(){if(exporting)return;$('studioDialog').close();}
function openReaModal(){TibeProjects.creator();}
function runReaDirector(){const text=$('sceneScript')?.value||'',parts=text.split(/[.!?\n]+/).map(s=>s.trim()).filter(Boolean).slice(0,100),duration=Number($('sceneDuration')?.value||4.5);if(!parts.length)return toast('Nhập kịch bản trước khi tạo.');mutate(()=>{clips=[];Object.entries(defaultProject().media).forEach(([id,m])=>{if(!media[id])media[id]=m;});parts.forEach((title,i)=>{clips.push(C.normalize({track:'video',title:'Cảnh '+(i+1),mediaId:'demo'+i%6,start:i*duration,duration,anim:'ken_burns',transition:'dissolve'}),C.normalize({track:'text',title,start:i*duration+.1,duration:duration-.2,fontSize:32,textStyle:'subtitle',yOffset:250,anim:'fade'}));});currentTime=0;selectedClipId=clips[1]?.id;projectName='My story';});closeDialog();refresh();prepareMedia();}
function openVoice(){TibeVoice.open();}
async function synthesizeVoice(){return TibeVoice.generate();}
async function openReaConnection(){
  showDialog('Tài nguyên trên máy','<div id="localResourceStatus" class="creator-result">Đang đọc tài nguyên đã tích hợp…</div>');
  try{await TibeBackend.ensure();const response=await appFetch('/api/resources/capcut'),report=await response.json();if(!$('localResourceStatus'))return;$('localResourceStatus').textContent='REA '+(report.reaVersion||'')+' tự hoạt động trong tibe. Đã nhận diện '+report.algorithms.length+' thuật toán shader từ CapCut trên máy; thư viện hiệu ứng hiển thị các preset đã chuyển đổi. Bộ lọc Concat và xử lý âm thanh đã được nhúng trực tiếp.';}catch(e){if($('localResourceStatus'))$('localResourceStatus').textContent=e.message;}
}

async function inspectRea(){const b=$('inspectRea');b.disabled=true;b.textContent='Đang phân tích…';try{const response=await appFetch('/api/rea/inspect',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const data=await response.json();if(!response.ok)throw Error(data.error);$('reaEvidence').textContent='CapCut '+(data.evidence.version||'')+'\nĐã kiểm tra tệp thực thi và '+data.evidence.installationComponents.length+' thành phần cài đặt.\n'+data.evidence.limitations.join('\n');const link=document.createElement('a');link.href=TibeBackend.url(data.reportUrl);link.textContent='Tải báo cáo bằng chứng REA';link.download='capcut.evidence.json';$('dialogBody').append(link);}catch(e){$('reaEvidence').textContent=e.message;}finally{b.disabled=false;b.textContent='Phân tích lại';}}

async function inspectReaMaterials(){const button=$('inspectMaterials');button.disabled=true;button.textContent='Đang đọc tài nguyên…';try{const response=await appFetch('/api/rea/materials',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),data=await response.json();if(!response.ok)throw Error(data.error);const cache=data.evidence.cacheSummary||{};$('reaEvidence').textContent='REA '+data.evidence.reaVersion+' · CapCut '+data.evidence.capcutVersion+'\n'+(cache.packs||0)+' thư mục trong kho cache · '+(cache.files||0)+' tệp\n'+data.lutCount+' LUT .cube có thể áp dụng.\nShader/Lua và chuyển cảnh gốc chưa được chuyển thành engine của tibe.';await TibeLibrary.loadLocalLuts(false);const link=document.createElement('a');link.href=TibeBackend.url(data.reportUrl);link.download='capcut-materials.evidence.json';link.textContent='Tải báo cáo tài nguyên REA';$('dialogBody').append(link);}catch(error){$('reaEvidence').textContent=error.message;}finally{button.disabled=false;button.textContent='Kiểm tra lại kho tài nguyên';}}

function exportFullVideo(){
  if(!clips.length)return toast('Thêm clip vào timeline trước khi xuất.');
  showDialog('Xuất video', `<div class="export-summary"><span>${icon('video')}</span><div><strong>${escapeHTML(projectName)}</strong><small>${ratio} · ${formatTime(totalDuration)} · ${clips.length} clip</small></div></div><label class="dialog-label">Tên tệp<input id="exportFilename" maxlength="120" value="${escapeHTML(projectName)}"></label><label class="dialog-label">Định dạng<select id="exportFormat" onchange="updateExportHelp()"><option value="mp4" ${backend?.ffmpeg?'':'disabled'}>MP4 · H.264 / AAC${backend?.ffmpeg?'':' (cần máy chủ FFmpeg)'}</option><option value="webm" ${backend?.ffmpeg?'':'selected'}>WebM · Xuất trên trình duyệt</option></select></label><div class="dialog-columns"><label class="dialog-label">Độ phân giải<select id="exportResolution"><option value="720">720p</option><option value="1080" selected>1080p</option></select></label><label class="dialog-label">Khung hình / giây<select id="exportFps"><option value="24">24 fps</option><option value="30" selected>30 fps</option><option value="59.94">59.94 fps · 60000/1001</option><option value="60">60 fps</option></select></label></div><p id="exportHelp" class="hint"></p><progress id="exportProgress" max="100" value="0"></progress><p id="exportMessage" class="hint">Sẵn sàng xuất</p><button id="startExport" class="btn-export" onclick="startExport()">${icon('upload')}Xuất video</button><button id="cancelExport" class="link-button" hidden onclick="cancelExport()">Hủy xuất</button>`);
  if(projectProduction.omera)$('exportFps').value='60';
  updateExportHelp();
}
function updateExportHelp(){const deterministic=$('exportFormat').value==='mp4'&&backend?.frameRenderer;$('exportHelp').textContent=deterministic?'Xuất từng khung hình bằng FFmpeg, trộn âm thanh đúng timeline. Có thể chuyển sang cửa sổ khác khi đang xuất.':'Xuất bằng trình duyệt theo thời gian thực. Giữ cửa sổ ở phía trước trong lúc dựng.';}
function exportName(){return ($('exportFilename')?.value.trim()||projectName).replace(/[<>:"/\\|?*]/g,'_');}
async function waitForSeek(item,time){if(!item||item.error)return;const el=item.el;item.target=null;el.pause();if(Math.abs(el.currentTime-time)<.015)return;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{el.removeEventListener('seeked',done);reject(Error('Không thể tua tư liệu để xuất.'));},10000);function done(){clearTimeout(timer);resolve();}el.addEventListener('seeked',done,{once:true});el.currentTime=Math.min(time,Math.max(0,el.duration-.002));});}
async function startExport(){
  if(exporting)return;const fps=Number($('exportFps').value),resolution=Number($('exportResolution').value),format=$('exportFormat').value;
  try{if(projectProduction?.sprint){TibeFBSprint.preflight(snapshot());if(format!=='mp4'||!backend?.frameRenderer)throw Error('FB Sprint cần máy chủ xuất MP4 từng khung hình để giữ đồng bộ.');}}catch(e){$('exportMessage').textContent=e.message;return;}
  if(format==='mp4'&&backend?.frameRenderer)return startFrameExport(fps,resolution);
  if(typeof MediaRecorder==='undefined'||!canvas.captureStream)return toast('Dùng Chrome hoặc Edge để xuất video.');
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)return toast('Trình duyệt không hỗ trợ ghi WebM.');
  TibeLibrary.stopSource();TibeLibrary.stopLookPreview();pauseAll();const savedTime=currentTime;exporting=true;$('startExport').disabled=true;$('cancelExport').hidden=false;$('dialogClose').disabled=true;document.querySelector('.app-shell').inert=true;
  exportJob={savedTime,cancelled:false,recorder:null,stream:null};
  try{
    await setupAudio();
    await Promise.all(clips.filter(c=>media[c.mediaId]&&media[c.mediaId].type!=='image').map(c=>getInstance(c).then(item=>{if(item.error)throw Error(item.error);return waitForSeek(item,c.sourceIn||0);})));if(exportJob.cancelled)throw Error('Đã hủy xuất.');
    await Promise.all(Object.values(media).filter(m=>m.type==='image'&&clips.some(c=>c.mediaId===m.id)).map(m=>{const im=loadImage(m);return im.complete&&im.naturalWidth?Promise.resolve():new Promise((res,rej)=>{im.onload=res;im.onerror=()=>rej(Error('Không tải được '+m.name));setTimeout(()=>rej(Error('Không tải được '+m.name)),15000);});}));
    currentTime=0;const short=Math.min(...ratio.split(':').map(Number));const size=ratio.split(':').map(Number);setCanvasSize(Math.round(resolution*size[1]/short/2)*2);drawCompositeFrame();
    const stream=canvas.captureStream(fps);mixDestination.stream.getAudioTracks().forEach(track=>stream.addTrack(track.clone()));exportJob.stream=stream;
    const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:resolution>=1080?10000000:5000000,audioBitsPerSecond:192000});exportJob.recorder=recorder;const chunks=[];
    const recording=new Promise((res,rej)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>rej(Error(e.error?.message||'Lỗi ghi video.'));recorder.onstop=()=>res(new Blob(chunks,{type:'video/webm'}));});
    recorder.start(500);drawCompositeFrame();stream.getVideoTracks()[0]?.requestFrame?.();isPlaying=true;playOrigin=0;playStartedAt=performance.now();lastFrame=playStartedAt;syncMedia(true);const blob=await recording;
    if(exportJob.cancelled)throw Error('Đã hủy xuất.');
    // Keep the WebM until conversion succeeds so a server failure never loses a completed render.
    if(format==='mp4'){$('exportMessage').textContent='Đang mã hóa MP4…';const form=new FormData();form.append('video',blob,'render.webm');form.append('fps',fps);form.append('duration',totalDuration);exportJob.abort=new AbortController();const response=await appFetch('/api/export/convert_mp4',{method:'POST',body:form,signal:exportJob.abort.signal});if(!response.ok){const error=await response.json();download(blob,exportName()+'.webm');throw Error((error.error||'Lỗi chuyển MP4')+' · Đã giữ bản WebM.');}const output=await response.blob();if(exportJob.cancelled)throw Error('Đã hủy xuất.');download(output,exportName()+'.mp4');}else download(blob,exportName()+'.webm');
    $('exportMessage').textContent='Đã xuất thành công · có âm thanh';$('exportProgress').value=100;toast('Video đã được tải xuống.');
  }catch(e){$('exportMessage').textContent=exportJob?.cancelled?'Đã hủy xuất.':e.message;toast(exportJob?.cancelled?'Đã hủy xuất.':e.message);}
  finally{pauseAll();exportJob?.stream?.getTracks().forEach(t=>t.stop());currentTime=savedTime;setCanvasSize();exportJob=null;exporting=false;document.querySelector('.app-shell').inert=false;$('dialogClose').disabled=false;$('startExport').disabled=false;$('cancelExport').hidden=true;syncMedia(true);updatePlayheadUI();}
}
function cancelExport(){if(!exportJob)return;exportJob.cancelled=true;exportJob.abort?.abort();if(exportJob.jobId)appFetch('/api/render/'+exportJob.jobId+'/cancel',{method:'POST'}).catch(()=>{});pauseAll();if(exportJob.recorder?.state==='recording')exportJob.recorder.stop();}
async function startFrameExport(fps,resolution){
  if(exporting)return;
  TibeLibrary.stopSource();TibeLibrary.stopLookPreview();pauseAll();const savedTime=currentTime;exporting=true;document.querySelector('.app-shell').inert=true;$('dialogClose').disabled=true;$('startExport').disabled=true;$('cancelExport').hidden=false;
  const job={deterministic:true,cancelled:false,abort:new AbortController(),jobId:null};exportJob=job;
  const request=async(url,options)=>{const response=await appFetch(url,{...options,signal:job.abort.signal});if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.error||'Không kết nối được máy chủ xuất video.');}return response;};
  const assertActive=()=>{if(job.cancelled)throw Error('Đã hủy xuất.');};
  try{
    $('exportMessage').textContent='Đang chuẩn bị tư liệu…';
    const used=new Set(clips.map(c=>c.mediaId).filter(Boolean)),project=snapshot();
    project.media=Object.fromEntries(Object.entries(project.media).filter(([id,m])=>used.has(id)&&m.type!=='image'));
    for(const m of Object.values(project.media)){delete m.thumbnail;delete m.runtimeUrl;delete m.peaks;if(!m.url){const file=files.get(m.id)||await readFile(m.id);if(!file)throw Error('Thiếu tư liệu '+m.name);m.url=await asDataURL(file);}assertActive();}
    await Promise.all(clips.filter(c=>STICKER_SVGS[c.stickerId]).map(c=>stickerImage(c.stickerId).decode()));
    const visual=clips.filter(c=>['video','overlay'].includes(c.track)&&media[c.mediaId]?.type==='video');await Promise.all(visual.map(c=>getInstance(c)));
    for(const m of Object.values(media).filter(m=>used.has(m.id)&&m.type==='image')){const im=loadImage(m);if(!im.src)im.src=await resolveUrl(m);if(!im.complete||!im.naturalWidth)await im.decode();assertActive();}
    const dims=ratio.split(':').map(Number);setCanvasSize(Math.round(resolution*dims[1]/Math.min(...dims)/2)*2);
    const start=await(await request('/api/render/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project,width:canvas.width,height:canvas.height,fps,duration:totalDuration})})).json();job.jobId=start.jobId;
    let batch=new FormData(),batchStart=0,batchCount=0;
    for(let frame=0;frame<start.frames;frame++){
      assertActive();currentTime=frame/(start.fps||fps);
      await Promise.all(visual.filter(c=>!c.hidden&&!trackState[c.track]?.hidden&&((currentTime>=c.start&&currentTime<c.start+c.duration)||transitionHoldLocal(c)!==null)).map(c=>waitForSeek(instances.get(c.id),C.sourceTime(c,transitionHoldLocal(c)??currentTime-c.start))));
      assertActive();drawCompositeFrame();
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Không đọc được khung hình.')),'image/jpeg',.94));
      batch.append('frames',blob,'frame_'+frame+'.jpg');batchCount++;$('exportProgress').value=(frame+1)/start.frames*94;$('exportMessage').textContent='Đang dựng khung hình '+(frame+1)+' / '+start.frames;updatePlayheadUI();
      if(batchCount===12||frame===start.frames-1){batch.append('start',String(batchStart));await request('/api/render/'+job.jobId+'/frames',{method:'POST',body:batch});batchStart=frame+1;batchCount=0;batch=new FormData();}
    }
    assertActive();$('exportMessage').textContent='Đang hoàn tất video và trộn âm thanh…';$('exportProgress').value=96;
    const output=await(await request('/api/render/'+job.jobId+'/finish',{method:'POST'})).blob();assertActive();download(output,exportName()+'.mp4');if(projectProduction?.sprint){const plan=projectProduction.sprint.plan,hash=await TibeFBSprint.fingerprint(plan);download(new Blob([JSON.stringify({template:TibeFBSprint.MODE,storyFingerprint:hash,note:'Dấu vân tay kịch bản để quản lý phiên bản; không xác nhận nội dung gốc của Meta.',fps:start.fps||fps,stripSourceMetadata:true,syntheticNarration:true,renderedAt:new Date().toISOString()},null,2)],{type:'application/json'}),exportName()+'-render-manifest.json');}job.jobId=null;$('exportProgress').value=100;$('exportMessage').textContent='Đã xuất thành công · '+formatTime(totalDuration)+' · '+fps+' fps';toast('Đã xuất video MP4.');
  }catch(error){$('exportMessage').textContent=job.cancelled?'Đã hủy xuất.':error.message;toast(job.cancelled?'Đã hủy xuất.':error.message);if(job.jobId)appFetch('/api/render/'+job.jobId+'/cancel',{method:'POST'}).catch(()=>{});}
  finally{pauseAll();currentTime=savedTime;setCanvasSize();exportJob=null;exporting=false;document.querySelector('.app-shell').inert=false;$('dialogClose').disabled=false;$('startExport').disabled=false;$('cancelExport').hidden=true;syncMedia(true);updatePlayheadUI();updateSelectionBox();}
}
function iconForTile(name){return icon(ICON_PATHS[name]?name:'effects');}
function reconcileSelection(){selectedIds=new Set([...selectedIds].filter(id=>clips.some(c=>c.id===id)));if(selectedClipId&&!selectedIds.has(selectedClipId)&&clips.some(c=>c.id===selectedClipId))selectedIds=new Set([selectedClipId]);if(!clips.some(c=>c.id===selectedClipId))selectedClipId=[...selectedIds][0]||null;}
function fitCanvas(){
  const area=$('viewportArea');if(!area)return;
  const factor=Math.min(Math.max(80,area.clientWidth-60)/canvas.width,Math.max(80,area.clientHeight-54)/canvas.height)*canvasZoom;
  canvas.style.width=Math.round(canvas.width*factor)+'px';canvas.style.height=Math.round(canvas.height*factor)+'px';$('canvasFrame').style.width=canvas.style.width;$('canvasFrame').style.height=canvas.style.height;updateSelectionBox();
}
function fitTimeline(){setTimelineZoom(($('tlScroll').clientWidth-45)/Math.max(2,totalDuration));$('tlScroll').scrollLeft=0;}
function toggleFocus(){document.body.classList.toggle('focus-mode');requestAnimationFrame(fitCanvas);}
function toggleGuides(){showGuides=!showGuides;$('guideButton').classList.toggle('active',showGuides);document.querySelectorAll('.alignment-guide').forEach(el=>el.hidden=!showGuides);}
function toggleTrack(track,key){mutate(()=>{trackState[track]={...trackState[track],[key]:!trackState[track]?.[key]};});renderInspector();syncMedia(true);updateSelectionBox();}
function setMediaSearch(value){mediaSearch=value;const focus=$('mediaSearch');renderDrawer();focus.focus();}
function presetCSS(value){return TibeLooks.cssFor(value);}
function setClipSpeed(_prop,value){setPlaybackRate(C.clamp(Number(value),.25,4));}
function resetTransform(){const c=selected();if(!c)return;mutate(()=>{Object.assign(c,{xOffset:0,yOffset:0,scale:1,rotation:0,opacity:1,keyframes:[]});});renderInspector();}
function resetColor(){const c=selected();if(!c)return;mutate(()=>{c.adjust={brightness:0,contrast:0,saturation:0,temp:0,vignette:0,sharpen:0,highlight:0,shadow:0};c.filter='original';});renderInspector();}
function changeTiming(prop,value,commit=true){const c=selected();if(!c||trackState[c.track]?.locked)return;const n=Number(value);if(value===''||!Number.isFinite(n))return;mutate(()=>{if(prop==='start')c.start=Math.max(0,n);else{const m=media[c.mediaId],source=m&&m.type!=='image'?m.duration:Infinity;Object.assign(c,C.resize(c,0,Math.max(.05,n)-c.duration,source));}},c.id+prop);if(commit)renderInspector();syncMedia(true);}
function jumpKeyframe(direction){const c=selected();if(!c?.keyframes?.length)return toast('Clip chưa có keyframe.');const local=currentTime-c.start,list=c.keyframes.slice().sort((a,b)=>a.time-b.time);const frame=direction>0?list.find(k=>k.time>local+.025):list.filter(k=>k.time<local-.025).pop();if(frame){seekTo(c.start+frame.time);renderInspector();}}
function deleteCurrentKeyframe(){const c=selected();if(!c)return;const local=currentTime-c.start;if(!c.keyframes.some(k=>Math.abs(k.time-local)<.04))return toast('Đặt vạch phát tại một keyframe.');mutate(()=>c.keyframes=c.keyframes.filter(k=>Math.abs(k.time-local)>=.04));renderInspector();}
function queueSeek(item,time,force=false){
  if(item.loading||item.error||!Number.isFinite(item.el.duration))return;
  const target=C.clamp(time,0,Math.max(0,item.el.duration-.002));
  if(force||!isPlaying||Math.abs(item.el.currentTime-target)>.2){item.target=target;if(!item.el.seeking&&Math.abs(item.el.currentTime-target)>.012)item.el.currentTime=target;}
  else item.target=null;
}
function requestMediaRefresh(drawer=false){
  mediaRefreshPending=true;mediaDrawerPending ||= drawer;
  if(pointerActive||mediaRefreshScheduled)return;
  mediaRefreshScheduled=true;
  requestAnimationFrame(()=>{mediaRefreshScheduled=false;if(pointerActive)return;if(mediaDrawerPending)renderDrawer();if(mediaRefreshPending)renderTimeline();mediaRefreshPending=false;mediaDrawerPending=false;});
}
document.addEventListener('pointerdown',()=>pointerActive=true,true);
for(const eventName of ['pointerup','pointercancel'])document.addEventListener(eventName,()=>{pointerActive=false;if(mediaRefreshPending)requestMediaRefresh();},true);
const waveformLoading=new Set(),thumbnailLoading=new Set();
async function buildWaveform(m){
  if(waveformLoading.has(m.id)||m.peaks)return;waveformLoading.add(m.id);delete m.waveError;
  try{
    const file=files.get(m.id);if(file&&file.size>100*1024*1024)throw Error('Tệp lớn hơn giới hạn phân tích 100 MB.');
    const response=file?null:await appFetch(await resolveUrl(m));if(response&&!response.ok)throw Error('Không tải được âm thanh.');
    const bytes=file?await file.arrayBuffer():await response.arrayBuffer();if(bytes.byteLength>100*1024*1024)throw Error('Tệp lớn hơn giới hạn phân tích 100 MB.');
    const context=new OfflineAudioContext(1,1,44100),decoded=await context.decodeAudioData(bytes),channels=Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i));
    if(media[m.id]===m){media[m.id].peaks=C.audioEnvelope(channels,4096);media[m.id].duration=decoded.duration;requestMediaRefresh(true);}
  }catch(error){if(media[m.id]===m){media[m.id].waveError=error.message;requestMediaRefresh();}}
  finally{waveformLoading.delete(m.id);}
}
async function buildThumbnail(m){
  if(m.type!=='video'||m.thumbnail||thumbnailLoading.has(m.id))return;thumbnailLoading.add(m.id);
  const el=document.createElement('video');el.crossOrigin='anonymous';el.muted=true;el.playsInline=true;el.preload='auto';
  try{const thumbnailUrl=await resolveUrl(m);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('thumbnail timeout')),12000);el.onloadeddata=()=>{clearTimeout(timer);resolve();};el.onerror=()=>{clearTimeout(timer);reject(Error('thumbnail unavailable'));};el.src=thumbnailUrl;});const off=document.createElement('canvas');off.width=240;off.height=Math.max(1,Math.round(240*el.videoHeight/el.videoWidth));off.getContext('2d').drawImage(el,0,0,off.width,off.height);if(media[m.id]){media[m.id].thumbnail=off.toDataURL('image/jpeg',.75);requestMediaRefresh(true);}}
  catch{}finally{el.removeAttribute('src');el.load();thumbnailLoading.delete(m.id);}
}
function labelLayout(c){
  const size=c.fontSize||(c.track==='sticker'?50:42),font=(c.textStyle==='script'?'italic 600 ':'700 ')+size+'px '+(c.track==='sticker'?'"Segoe UI Emoji",sans-serif':c.textStyle==='script'?'"Segoe Script",Georgia,serif':'"Segoe UI",sans-serif');
  ctx.save();ctx.font=font;
  const lines=String(c.track==='sticker'?(c.stickerSymbol||c.title||''):c.title||'').split('\n').flatMap(line=>{if(c.track==='sticker')return[line];const out=[];let current='';for(const word of line.split(' ')){const next=current?current+' '+word:word;if(ctx.measureText(next).width>400&&current){out.push(current);current=word;}else current=next;}return[...out,current];});
  const width=c.stickerId?size:Math.min(450,Math.max(...lines.map(l=>ctx.measureText(l).width),1)+(['subtitle','badge'].includes(c.textStyle)?28:8)),height=c.stickerId?size:lines.length*size*1.3;ctx.restore();return{size,font,lines,width,height};
}
function clipGeometry(c){
  const H=450*canvas.height/canvas.width,local=C.clamp(currentTime-c.start,0,c.duration),t=C.transform(c,local);let width=450,height=H,scale=t.scale;
  if(c.track==='overlay'){width=210;height=Math.min(260,H*.6);}
  if(['text','sticker'].includes(c.track)){const layout=labelLayout(c);width=layout.width;height=layout.height;if(c.anim==='pop_bounce')scale*=.7+.3*Math.min(1,local/.25)+Math.sin(Math.min(1,local/.5)*Math.PI)*.12;}
  else if(c.anim==='ken_burns')scale*=1+(local+(c.animationOffset||0))*.013;
  return{x:225+t.xOffset,y:H/2+t.yOffset,width,height,scale,rotation:t.rotation};
}
function updateSelectionBox(){
  const box=$('selectionBox'),c=selected();if(!box)return;
  const show=c&&selectedIds.size===1&&c.track!=='audio'&&!c.hidden&&!trackState[c.track]?.hidden&&currentTime>=c.start&&currentTime<c.start+c.duration&&!exporting;
  box.hidden=!show;$('viewerEmpty').hidden=clips.some(c=>['video','overlay','text','sticker'].includes(c.track));if(!show)return;
  const g=clipGeometry(c),factor=canvas.clientWidth/450;
  box.style.width=g.width*g.scale*factor+'px';box.style.height=g.height*g.scale*factor+'px';box.style.left=g.x*factor+'px';box.style.top=g.y*factor+'px';box.style.transform=`translate(-50%,-50%) rotate(${g.rotation}deg)`;$('selectionLabel').textContent=c.track==='text'?c.title.replace(/\n/g,' '):'';$('selectionLabel').hidden=c.track!=='text';
}
function hitClip(x,y){
  const list=[...clips.filter(c=>c.track==='video').sort((a,b)=>a.start-b.start),...clips.filter(c=>c.track==='overlay'),...clips.filter(c=>['text','sticker'].includes(c.track))];
  return list.reverse().find(c=>{if(c.hidden||trackState[c.track]?.hidden||trackState[c.track]?.locked||currentTime<c.start||currentTime>=c.start+c.duration)return false;const g=clipGeometry(c),a=-g.rotation*Math.PI/180,dx=x-g.x,dy=y-g.y;const lx=(dx*Math.cos(a)-dy*Math.sin(a))/g.scale,ly=(dx*Math.sin(a)+dy*Math.cos(a))/g.scale;return Math.abs(lx)<=g.width/2&&Math.abs(ly)<=g.height/2;});
}
function setTransformValues(c,values,time){
  if(c.keyframes?.length){const existing=c.keyframes.find(k=>Math.abs(k.time-time)<.025);if(existing)Object.assign(existing,values);else c.keyframes.push({time,...C.transform(c,time),...values});}
  else Object.assign(c,values);
}
function beginCanvasDrag(e,resize=false){
  if(exporting||e.button!==0)return;e.preventDefault();e.stopPropagation();
  const rect=canvas.getBoundingClientRect(),factor=rect.width/450,x=(e.clientX-rect.left)/factor,y=(e.clientY-rect.top)/factor;
  const c=resize?selected():hitClip(x,y);if(!c){selectClip(null);return;}if(trackState[c.track]?.locked)return;selectClip(c.id);
  const before=snapshot(),time=C.clamp(currentTime-c.start,0,c.duration),start=C.transform(c,time),sx=e.clientX,sy=e.clientY,g=clipGeometry(c),cx=rect.left+g.x*factor,cy=rect.top+g.y*factor,distance=Math.max(1,Math.hypot(sx-cx,sy-cy));let moved=false;
  const move=ev=>{if(Math.hypot(ev.clientX-sx,ev.clientY-sy)<2&&!moved)return;moved=true;
    if(resize)setTransformValues(c,{scale:C.clamp(start.scale*Math.hypot(ev.clientX-cx,ev.clientY-cy)/distance,.1,5)},time);
    else{let nx=start.xOffset+(ev.clientX-sx)/factor,ny=start.yOffset+(ev.clientY-sy)/factor;if(snap){if(Math.abs(nx)<4)nx=0;if(Math.abs(ny)<4)ny=0;}setTransformValues(c,{xOffset:Math.round(nx),yOffset:Math.round(ny)},time);document.querySelector('.alignment-guide.horizontal').hidden=showGuides||ny===0?false:true;document.querySelector('.alignment-guide.vertical').hidden=showGuides||nx===0?false:true;}
  };
  const up=()=>{window.removeEventListener('pointermove',move);document.querySelectorAll('.alignment-guide').forEach(el=>el.hidden=!showGuides);if(moved){history.push(before);future.length=0;changed();renderInspector();}};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});
}
function copySelected(){clipboardClips=C.copy(clips.filter(c=>selectedIds.has(c.id)));if(clipboardClips.length)toast('Đã sao chép '+clipboardClips.length+' clip.');}
function pasteClips(){if(!clipboardClips.length)return;const start=Math.min(...clipboardClips.map(c=>c.start));mutate(()=>{selectedIds.clear();for(const old of clipboardClips){if(trackState[old.track]?.locked)continue;const c={...C.copy(old),id:C.uid(),start:currentTime+old.start-start};clips.push(c);selectedIds.add(c.id);}selectedClipId=[...selectedIds][0]||null;});renderInspector();prepareMedia();}
function openClipMenu(e,c){e.preventDefault();if(!selectedIds.has(c.id))selectClip(c.id);const menu=$('clipMenu');menu.replaceChildren();for(const [label,key,name,action] of [['Cắt tại vạch phát','Ctrl+B','split',splitClipAtPlayhead],['Sao chép','Ctrl+C','duplicate',copySelected],['Dán tại vạch phát','Ctrl+V','layers',pasteClips],['Nhân đôi','Ctrl+D','duplicate',()=>duplicateSelected()],['Tách âm thanh','','audio',extractAudio],['Xóa','Delete','trash',()=>deleteSelectedClip()],['Xóa nối tiếp','Shift+Delete','trash',()=>deleteSelectedClip(true)]]){const button=document.createElement('button');button.innerHTML=icon(name)+label+'<span>'+key+'</span>';button.onclick=()=>{menu.hidden=true;action();};menu.append(button);}menu.hidden=false;menu.style.left=Math.min(e.clientX,window.innerWidth-210)+'px';menu.style.top=Math.min(e.clientY,window.innerHeight-menu.offsetHeight-10)+'px';}
function openShortcuts(){showDialog('Phím tắt & thao tác',`<div class="shortcut-list"><span>Phát / tạm dừng</span><kbd>Space</kbd><span>Nhập tư liệu</span><kbd>Ctrl + I</kbd><span>Cắt đôi tại vạch phát</span><kbd>Ctrl + B</kbd><span>Hoàn tác / làm lại</span><kbd>Ctrl + Z / Y</kbd><span>Nhân đôi</span><kbd>Ctrl + D</kbd><span>Sao chép / dán clip</span><kbd>Ctrl + C / V</kbd><span>Lưu dự án kèm tư liệu</span><kbd>Ctrl + S</kbd><span>Xóa nối tiếp trong track</span><kbd>Shift + Delete</kbd><span>Chọn nhiều clip</span><kbd>Shift + bấm</kbd><span>Bật / tắt bắt dính</span><kbd>N</kbd><span>Dịch một khung hình</span><kbd>← / →</kbd></div><p class="hint">Kéo mép clip để cắt hoặc mở rộng đến giới hạn nguồn. Kéo tư liệu từ thư viện vào timeline. Chọn chữ/lớp phủ ngay trong khung xem để di chuyển, kéo góc để đổi tỷ lệ.</p>`);}

document.addEventListener('visibilitychange',()=>{if(document.hidden&&exporting&&!exportJob?.deterministic)cancelExport();});
document.addEventListener('pointerdown',e=>{if(!$('clipMenu').contains(e.target))$('clipMenu').hidden=true;});
window.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.target.closest('.tibe-select-menu,.tibe-select-trigger,#sourcePreview')||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable||$('studioDialog').open||exporting)return;
  const mod=e.ctrlKey||e.metaKey;
  if(e.code==='Space'){e.preventDefault();togglePlay();}
  if(mod&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?redoAction():undoAction();}
  if(mod&&e.code==='KeyY'){e.preventDefault();redoAction();}
  if(mod&&e.code==='KeyB'){e.preventDefault();splitClipAtPlayhead();}
  if(mod&&e.code==='KeyD'){e.preventDefault();duplicateSelected();}
  if(mod&&e.code==='KeyC'){e.preventDefault();copySelected();}
  if(mod&&e.code==='KeyV'){e.preventDefault();pasteClips();}
  if(mod&&e.code==='KeyS'){e.preventDefault();TibeProjects.save();}
  if(mod&&e.code==='KeyI'){e.preventDefault();$('fileInput').click();}
  if(e.code==='KeyN'&&!mod)toggleSnap();
  if(e.code==='Delete'||e.code==='Backspace'){e.preventDefault();deleteSelectedClip(e.shiftKey);}
  if(e.code==='ArrowLeft'||e.code==='ArrowRight'){e.preventDefault();seekTo(currentTime+(e.code==='ArrowLeft'?-1:1)*(e.shiftKey?1:1/30));renderInspector();}
  if(e.code==='Escape'){selectClip(null);$('clipMenu').hidden=true;}
});
window.addEventListener('beforeunload',e=>{if(exporting){e.preventDefault();e.returnValue='';}});
canvas.addEventListener('pointerdown',e=>beginCanvasDrag(e));
$('selectionBox').querySelectorAll('[data-handle]').forEach(el=>el.addEventListener('pointerdown',e=>beginCanvasDrag(e,true)));
$('tlRuler').addEventListener('pointerdown',scrubTimeline);$('playhead').firstElementChild.addEventListener('pointerdown',scrubTimeline);
tracks.forEach(track=>{
  const lane=$('lane-'+track);
  lane.addEventListener('pointerdown',e=>{if(e.target===lane){selectClip(null);scrubTimeline(e);}});
  lane.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('application/x-clipcut-media')){e.preventDefault();lane.classList.add('drop-target');}});
  lane.addEventListener('dragleave',()=>lane.classList.remove('drop-target'));
  lane.addEventListener('drop',e=>{const id=e.dataTransfer.getData('application/x-clipcut-media');if(!id)return;e.preventDefault();lane.classList.remove('drop-target');const m=media[id];if(!m)return;let target=track;if(m.type==='audio')target='audio';else if(!['video','overlay'].includes(target))target='video';const start=Math.max(0,(e.clientX-lane.getBoundingClientRect().left)/pxPerSec);addLibraryMedia(id,Math.round(start*30)/30,target);});
});
$('tlScroll').addEventListener('scroll',()=>{$('trackHeaderList').style.transform='translateY(-'+$('tlScroll').scrollTop+'px)';});
if($('timelineEmpty')){
  $('timelineEmpty').addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('application/x-clipcut-media')||e.dataTransfer.types.includes('Files')){e.preventDefault();$('timelineEmpty').classList.add('drag-over');}});
  $('timelineEmpty').addEventListener('dragleave',()=>$('timelineEmpty').classList.remove('drag-over'));
  $('timelineEmpty').addEventListener('drop',e=>{e.preventDefault();$('timelineEmpty').classList.remove('drag-over');const id=e.dataTransfer.getData('application/x-clipcut-media');if(id&&media[id])addLibraryMedia(id,0,media[id].type==='audio'?'audio':'video');else if(e.dataTransfer.files.length)importMediaFiles([...e.dataTransfer.files]);});
}
const drop=document.querySelector('.asset-drawer');drop.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();drop.classList.add('drag-over');}});drop.addEventListener('dragleave',()=>drop.classList.remove('drag-over'));drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag-over');if(e.dataTransfer.files.length)importMediaFiles([...e.dataTransfer.files]);});
$('timelineResize').addEventListener('pointerdown',e=>{e.preventDefault();const start=e.clientY,height=document.querySelector('.timeline-area').offsetHeight;const move=ev=>{document.documentElement.style.setProperty('--timeline-height',C.clamp(height+start-ev.clientY,220,window.innerHeight*.6)+'px');fitCanvas();};window.addEventListener('pointermove',move);window.addEventListener('pointerup',()=>window.removeEventListener('pointermove',move),{once:true});});
$('studioDialog').addEventListener('cancel',e=>{if(exporting)e.preventDefault();});
async function init(){
  try{database=await openDB();}catch{}
  let restored=false;try{const saved=!demoMode&&localStorage.getItem('clipcut-autosave-v2');if(saved){applyProject(JSON.parse(saved));restored=true;}}catch(error){toast('Không thể khôi phục dự án: '+error.message);}
  if(!restored)applyProject(demoMode?defaultProject():{format:'clipcut-project',version:2,name:'Video chưa đặt tên',ratio:'9:16',clips:[],media:{}});
  $('saveStatus').textContent=demoMode?'Bản mẫu':restored?'Đã khôi phục bản nháp':'Bản nháp mới';setStickerCategory('all');setFilterCategory('featured');
  TibeUI.start();TibeLibrary.start();new ResizeObserver(()=>{fitCanvas();TibeUI.constrainPopovers();}).observe($('viewportArea'));fitCanvas();prepareMedia();refresh();
  Object.values(media).filter(m=>m.type==='audio').forEach(buildWaveform);Object.values(media).filter(m=>m.type==='video').forEach(buildThumbnail);
  requestAnimationFrame(renderLoop);
  if(location.protocol!=='file:')try{backend=await TibeBackend.ensure();}catch{}
  syncFloating();TibeUI.syncSelects();
  if(backend)await TibeLibrary.loadLocalLuts(false);
  if(backend)window.TibeCapCut?.load();
  window.dispatchEvent(new Event("tibe:ready"));

}

function stickerImage(key){if(!stickerImages.has(key)){const im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(STICKER_SVGS[key]);stickerImages.set(key,im);}return stickerImages.get(key);}
function processedVisual(c,source,sw,sh,dw,dh){
  const density=Math.min(4.5,canvas.width/450),w=Math.max(2,Math.round(dw*density)),h=Math.max(2,Math.round(dh*density));
  const filter=TibeLibrary.previewLook(c),amount=c.filterAmount??1;
  const key=JSON.stringify([w,h,source.currentTime||source.src,c.crop,c.fit,c.adjust,filter,amount,c.chroma,c.chromaColor,c.chromaStrength,c.chromaShadow,c.mask,c.maskFeather,c.maskInvert]);let cache=visualLayers.get(c.id);
  if(cache?.key===key)return cache.canvas;
  const off=cache?.canvas||document.createElement('canvas');off.width=w;off.height=h;const oc=off.getContext('2d',{willReadFrequently:true}),a=c.adjust||{},crop=C.clamp((c.crop||0)/100,0,.4),cw=sw*(1-2*crop),ch=sh*(1-2*crop),k=c.fit==='contain'?Math.min(w/cw,h/ch):Math.max(w/cw,h/ch);oc.imageSmoothingQuality='high';
  let b=100+(a.brightness||0),co=100+(a.contrast||0),sat=100+(a.saturation||0),hue=0,sepia=0;
  const lookCSS=TibeLooks.cssFor(filter,amount);oc.filter=(lookCSS==='none'?'':lookCSS+' ')+`brightness(${b}%) contrast(${co}%) saturate(${sat}%)`;oc.drawImage(source,sw*crop,sh*crop,cw,ch,(w-cw*k)/2,(h-ch*k)/2,cw*k,ch*k);oc.filter='none';
  const lut=TibeLooks.getLuts()[filter];if(lut&&amount){const frame=oc.getImageData(0,0,w,h);TibeLooks.applyLut(frame,lut,amount);oc.putImageData(frame,0,0);}
  if(c.chroma||a.temp||a.highlight||a.shadow||a.sharpen){const frame=oc.getImageData(0,0,w,h),data=frame.data,hex=c.chromaColor||'#00ff00',rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),dom=rgb.indexOf(Math.max(...rgb)),strength=10+(c.chromaStrength??35)*1.7,soft=12+(c.chromaShadow??20)*.5;
    const cb=v=>-.168736*v[0]-.331264*v[1]+.5*v[2],cr=v=>.5*v[0]-.418688*v[1]-.081312*v[2],keyCb=cb(rgb),keyCr=cr(rgb);
    for(let i=0;i<data.length;i+=4){const v=[data[i],data[i+1],data[i+2]],luma=(v[0]*.2126+v[1]*.7152+v[2]*.0722)/255,tone=(a.highlight||0)*1.5*luma*luma+(a.shadow||0)*1.5*(1-luma)*(1-luma);
      if(c.chroma){const distance=Math.hypot(cb(v)-keyCb,cr(v)-keyCr),alpha=C.clamp((distance-strength)/soft,0,1);data[i+3]*=alpha;if(alpha<1){v[dom]=v[dom]*(1-(c.chromaShadow||0)/100)+Math.min(v[(dom+1)%3],v[(dom+2)%3])*(c.chromaShadow||0)/100;}}
      data[i]=v[0]+tone+(a.temp||0)*.65;data[i+1]=v[1]+tone+(a.temp||0)*.08;data[i+2]=v[2]+tone-(a.temp||0)*.65;
    }
    if(a.sharpen>0){const original=new Uint8ClampedArray(data),amount=a.sharpen/65;for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=(y*w+x)*4;for(let ch=0;ch<3;ch++)data[i+ch]=original[i+ch]*(1+4*amount)-amount*(original[i-4+ch]+original[i+4+ch]+original[i-w*4+ch]+original[i+w*4+ch]);}}
    oc.putImageData(frame,0,0);
  }
  if(a.vignette>0){const g=oc.createRadialGradient(w/2,h/2,Math.min(w,h)*.12,w/2,h/2,Math.hypot(w,h)/2);g.addColorStop(0,'transparent');g.addColorStop(1,`rgba(0,0,0,${a.vignette/55})`);oc.fillStyle=g;oc.globalCompositeOperation='source-atop';oc.fillRect(0,0,w,h);oc.globalCompositeOperation='source-over';}
  if(c.mask&&c.mask!=='none'){
    const mask=document.createElement('canvas');mask.width=w;mask.height=h;const mc=mask.getContext('2d');mc.scale(w/450,w/450);mc.translate(0,(h/w*450-450)/2);mc.fillStyle='white';mc.beginPath();const path=new Path2D();
    if(c.mask==='circle')path.ellipse(225,225,210,210,0,0,Math.PI*2);
    else if(c.mask==='heart'){path.moveTo(225,402);path.bezierCurveTo(20,277,14,160,87,95);path.bezierCurveTo(142,48,201,90,225,140);path.bezierCurveTo(255,78,324,48,376,102);path.bezierCurveTo(440,168,418,294,225,402);}
    else if(c.mask==='star'){for(let i=0;i<10;i++){const angle=-Math.PI/2+i*Math.PI/5,r=i%2?94:211,x=225+Math.cos(angle)*r,y=225+Math.sin(angle)*r;i?path.lineTo(x,y):path.moveTo(x,y);}path.closePath();}
    else if(c.mask==='split')path.rect(0,0,225,450);
    else if(c.mask==='filmstrip'){path.roundRect(18,12,414,426,12);for(let y=30;y<425;y+=48){path.rect(28,y,22,24);path.rect(400,y,22,24);}}
    else path.roundRect(35,65,380,320,25);
    mc.fill(path,'evenodd');oc.globalCompositeOperation=c.maskInvert?'destination-out':'destination-in';oc.filter=c.maskFeather?`blur(${c.maskFeather*density}px)`:'none';oc.drawImage(mask,0,0);oc.filter='none';oc.globalCompositeOperation='source-over';
  }
  visualLayers.set(c.id,{key,canvas:off});return off;
}
function duckGain(c,time){
  if(!c.ducking||c.audioRole==='voice'||media[c.mediaId]?.url?.startsWith('/workspace/tts/'))return 1;
  let gain=1;for(const voice of clips){if(voice.id===c.id||voice.muted||voice.hidden||trackState[voice.track]?.hidden||trackState[voice.track]?.muted||voice.volume===0)continue;if(voice.audioRole!=='voice'&&!media[voice.mediaId]?.url?.startsWith('/workspace/tts/'))continue;const inVoice=Math.min((time-voice.start+.12)/.12,(voice.start+voice.duration+.12-time)/.12);gain=Math.min(gain,1-.72*C.clamp(inVoice,0,1));}return gain;
}
function configureVoice(item,effect){
  if(!audioContext||!item.source||item.voiceEffect===effect)return;item.source.disconnect();(item.fxNodes||[]).forEach(n=>n.disconnect());item.fxNodes=[];item.voiceEffect=effect;const add=node=>(item.fxNodes.push(node),node);
  if(effect==='echo'){const delay=add(audioContext.createDelay(1)),feedback=add(audioContext.createGain()),wet=add(audioContext.createGain());delay.delayTime.value=.18;feedback.gain.value=.25;wet.gain.value=.32;item.source.connect(item.gain);item.source.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(wet);wet.connect(item.gain);}
  else if(effect==='radio'){const high=add(audioContext.createBiquadFilter()),low=add(audioContext.createBiquadFilter());high.type='highpass';high.frequency.value=500;low.type='lowpass';low.frequency.value=2800;item.source.connect(high);high.connect(low);low.connect(item.gain);}
  else if(effect==='deep'||effect==='high'){
    // Two delay taps with a Hann crossfade shift pitch while the source clock stays intact.
    const node=add(audioContext.createScriptProcessor(1024,2,2)),length=16384,rings=[new Float32Array(length),new Float32Array(length)],ratio=effect==='deep'?.8:1.25,span=audioContext.sampleRate*.06;let write=0,phase=0;
    node.onaudioprocess=event=>{for(let i=0;i<event.outputBuffer.length;i++){const p=phase%1,q=(p+.5)%1,g=.5-.5*Math.cos(2*Math.PI*p);for(let ch=0;ch<2;ch++){const ring=rings[ch],input=event.inputBuffer.getChannelData(Math.min(ch,event.inputBuffer.numberOfChannels-1));ring[write]=input[i];const read=d=>{const index=(write-d+length*2)%length,lo=Math.floor(index),fraction=index-lo;return ring[lo]*(1-fraction)+ring[(lo+1)%length]*fraction;};event.outputBuffer.getChannelData(ch)[i]=read(32+p*span)*g+read(32+q*span)*(1-g);}write=(write+1)%length;phase=(phase+(1-ratio)/span+1)%1;}};item.source.connect(node);node.connect(item.gain);
  }else item.source.connect(item.gain);
}
function jumpClip(direction){const edges=[0,...clips.filter(c=>c.track==='video').map(c=>c.start),totalDuration].sort((a,b)=>a-b);seekTo(direction>0?(edges.find(t=>t>currentTime+.02)??totalDuration):(edges.filter(t=>t<currentTime-.02).pop()??0));}
function toggleFullscreen(){if(document.fullscreenElement)document.exitFullscreen().catch(e=>toast(e.message));else document.querySelector('.center-stage').requestFullscreen().catch(e=>toast(e.message));}
function setStickerCategory(category,button){TibeUI.setStickerCategory(category);}

let floatingFilterCategory='featured';
function setFilterCategory(category,button){floatingFilterCategory=category;if(button)button.parentElement.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===button));TibeLibrary.setFilterCategory(category);syncFloating();}
function syncFloating(){const c=selected();document.querySelectorAll('[data-lut]').forEach(b=>b.classList.toggle('active',b.dataset.lut===(c?.filter||'original')));const speed=c?.speed||1;$('floatingSpeeds').innerHTML=[.25,.5,1,2,4].map(n=>`<button class="speed-pill ${Math.abs(speed-n)<.001?'active':''}" onclick="setPlaybackRate(${n})">${n}x</button>`).join('');$('floatingSpeed').value=speed;$('floatingCurve').value=c?.speedCurve||'none';TibeUI.syncSelects();}
function setSpeedCurve(name){const c=selected();if(!c||!['video','overlay','audio'].includes(c.track))return toast('Chọn video hoặc âm thanh để đổi tốc độ.');if(trackState[c.track]?.locked)return toast('Track đang khóa.');mutate(()=>C.setCurve(c,name));renderInspector();syncFloating();syncMedia(true);}
function curveGraph(c){const points=C.curvePoints(c),x=t=>20+t*220,y=r=>100-r*22;let d=`M${x(points[0][0])},${y(points[0][1])}`;for(let i=1;i<points.length;i++){const [a,va]=points[i-1],[b,vb]=points[i];d+=` C${x(a+(b-a)/3)},${y(va)} ${x(b-(b-a)/3)},${y(vb)} ${x(b)},${y(vb)}`;}return `<svg class="curve-graph" viewBox="0 0 260 125" role="img" aria-label="Đường cong tốc độ ${c.speedCurve}"><path d="M20 12V100H240M20 78H240M20 34H240" stroke="#e8d7cd" fill="none"/><path d="${d}" fill="none" stroke="#ed9c99" stroke-width="3"/>${points.map(([t,r])=>`<circle cx="${x(t)}" cy="${y(r)}" r="3.5" fill="#fff7ed" stroke="#ea9d98"/>`).join('')}<text x="2" y="81">1x</text><text x="2" y="37">3x</text><text x="20" y="117">0s</text><text x="208" y="117">${c.duration.toFixed(1)}s</text></svg>`;}
function setCanvasOption(key,value){mutate(()=>projectCanvas[key]=value);}
function setPercent(prop,value){updateActiveClip(prop,Number(value)/100);}
function openProjectMenu(){showDialog('Dự án của bạn',`<div class="menu-actions"><button onclick="TibeProjects.library()">${icon('folder')}Thư viện dự án</button><button onclick="closeDialog();TibeProjects.save()">${icon('save')}Lưu vào thư mục dự án</button><button onclick="closeDialog();newProject()">${icon('plus')}Tạo dự án mới</button><button onclick="closeDialog();renameProject()">${icon('text')}Đổi tên dự án</button><button onclick="closeDialog();$('projectInput').click()">${icon('folder')}Mở tệp .clipcut</button><button onclick="closeDialog();saveProject()">${icon('download')}Tải dự án kèm tư liệu</button><button onclick="TibeConcat.open()">${icon('effects')}Bộ lọc & âm thanh Concat</button><button onclick="closeDialog();toggleTheme()">${icon('moon')}Đổi giao diện sáng / tối</button><button onclick="closeDialog();openReaConnection()">${icon('bolt')}Tài nguyên trên máy</button></div>`);}
function openExportMenu(){showDialog('Export project',`<div class="menu-actions"><button onclick="closeDialog();exportFullVideo()">${icon('video')}<span>Xuất video MP4 / WebM<small>Giữ toàn bộ hình ảnh, chữ và hiệu ứng đang dựng</small></span></button><button onclick="exportCapCutDraft()">${icon('layers')}<span>CapCut Desktop draft<small>Timeline chỉnh sửa được · JSON + tư liệu + báo cáo chuyển đổi</small></span></button><button onclick="closeDialog();saveProject()">${icon('save')}<span>Lưu .clipcut<small>Mở lại đầy đủ trong tibe</small></span></button></div>`);}

init();
