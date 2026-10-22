(function(root){
  'use strict';
  const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let source=null,sourceId=null,sourceToken=0,lookSession=null,category='all',query='',kind='filters',lastFrame=0;
  const cards=new Set();let observer,samples;
  function syncSourceButtons(){document.querySelectorAll('[data-source-play]').forEach(button=>{const playing=button.dataset.sourcePlay===sourceId&&source&&!source.paused;button.innerHTML=icon(playing?'pause':'play');button.classList.toggle('playing',!!playing);button.setAttribute('aria-label',(playing?'Tạm dừng':'Phát thử')+' '+(media[button.dataset.sourcePlay]?.name||''));button.setAttribute('aria-pressed',String(!!playing));});const main=$('sourceToggle');if(main)main.innerHTML=icon(source&&!source.paused?'pause':'play');}
  function stopSource(){sourceToken++;if(source){source.pause();source.removeAttribute('src');source.load();source=null;}sourceId=null;$('sourcePreview')?.remove();syncSourceButtons();}
  async function playSource(id){
    root.TibeVoice?.stop();root.TibeConcat?.stop();
    if(exporting)return;const m=media[id];if(!m||!['audio','video'].includes(m.type))return;
    if(sourceId===id&&source){try{if(source.paused)await source.play();else source.pause();}catch(error){toast('Không phát được tư liệu: '+error.message);}return;}
    stopSource();pauseAll();updatePlayheadUI();const token=sourceToken;sourceId=id;
    const panel=document.createElement('section');panel.id='sourcePreview';panel.className='source-preview';panel.setAttribute('aria-label','Phát thử tư liệu');
    panel.innerHTML=`<header><span class="source-kind">${icon(m.type==='audio'?'audio':'video')}</span><div><small>PHÁT THỬ TƯ LIỆU</small><strong>${esc(m.name)}</strong></div><button class="icon-btn" aria-label="Đóng phát thử">${icon('close')}</button></header><div class="source-screen"></div><div class="source-transport"><button id="sourceToggle" class="source-toggle" aria-label="Phát / tạm dừng">${icon('play')}</button><input id="sourceSeek" type="range" min="0" max="${m.duration||1}" step="0.01" value="0" aria-label="Vị trí phát tư liệu"><span id="sourceTime">00:00.0</span></div><p class="source-message">Đang tải tư liệu…</p>`;
    document.body.append(panel);panel.querySelector('header button').onclick=stopSource;
    const el=document.createElement(m.type);source=el;el.preload='auto';el.playsInline=true;el.volume=.8;
    if(m.type==='video')panel.querySelector('.source-screen').append(el);else{panel.querySelector('.source-screen').classList.add('audio-source-screen');panel.querySelector('.source-screen').innerHTML=icon('waveform');if(m.peaks){const wave=TibeUI.waveformElement(ClipCore.normalize({title:m.name,duration:m.duration}),m,340);panel.querySelector('.source-screen').append(wave);}}
    const refresh=()=>{if(source!==el)return;$('sourceSeek').max=Number.isFinite(el.duration)?el.duration:m.duration||1;$('sourceSeek').value=el.currentTime||0;$('sourceTime').textContent=formatTime(el.currentTime||0);syncSourceButtons();};
    for(const event of ['play','pause','ended','timeupdate','loadedmetadata'])el.addEventListener(event,refresh);
    $('sourceToggle').onclick=async()=>{try{if(el.paused)await el.play();else el.pause();}catch(error){toast(error.message);}};
    $('sourceSeek').oninput=event=>{if(Number.isFinite(el.duration))el.currentTime=Math.min(el.duration,Number(event.target.value));};
    el.onerror=()=>{if(source===el)panel.querySelector('.source-message').textContent='Không giải mã được tư liệu này. Thử MP4 H.264/AAC hoặc WebM.';};
    try{const url=await resolveUrl(m);if(token!==sourceToken||!panel.isConnected)return;el.src=url;await el.play();if(token===sourceToken)panel.querySelector('.source-message').textContent='Nghe/xem nguồn gốc · không thay đổi timeline';}
    catch(error){if(token===sourceToken)panel.querySelector('.source-message').textContent='Không phát được: '+error.message;}
  }
  function attachMediaCard(card,thumbnail,m){
    if(thumbnail.style.backgroundImage)thumbnail.classList.add('has-poster');
    const add=thumbnail.querySelector('.asset-add');add.setAttribute('aria-label','Thêm '+m.name+' vào timeline');add.innerHTML=icon('plus');add.ondblclick=e=>e.stopPropagation();add.onpointerdown=e=>e.stopPropagation();
    if(['audio','video'].includes(m.type)){const play=document.createElement('button');play.type='button';play.className='asset-preview-play';play.dataset.sourcePlay=m.id;play.innerHTML=icon('play');play.title='Phát thử '+m.name;play.setAttribute('aria-label',play.title);play.onclick=e=>{e.stopPropagation();playSource(m.id);};play.ondblclick=e=>e.stopPropagation();play.onpointerdown=e=>e.stopPropagation();thumbnail.append(play);}
    if(m.type==='audio'&&m.peaks){const wave=TibeUI.waveformElement(ClipCore.normalize({title:m.name,duration:m.duration}),m,240);wave.classList.add('media-audio-wave');thumbnail.append(wave);}
    card.addEventListener('dragstart',e=>{if(e.target.closest('button'))e.preventDefault();});syncSourceButtons();
  }
  const groups={filters:[['all','Tất cả'],['portrait','Chân dung'],['cinema','Điện ảnh'],['travel','Du lịch'],['retro','Retro'],['food','Ẩm thực'],['mono','Đen trắng'],['concat','Concat'],['local','LUT của bạn']],transitions:[['all','Tất cả'],['basic','Cơ bản'],['wipe','Quét / mở'],['slide','Trượt'],['camera','Máy quay'],['light','Ánh sáng'],['creative','Sáng tạo'],['gl','GL Transitions']]};
  function resetCards(){for(const card of [...cards]){if(card.canvas.isConnected&&card.canvas.closest('#floatingFilters')&&!$('popFilters').hidden)continue;observer?.unobserve(card.canvas);cards.delete(card);}}
  function stopLookPreview(){lookSession=null;}
  function previewLook(c){return !exporting&&!isPlaying&&lookSession?.clipId===c.id?lookSession.id:c.filter||'original';}
  function syncSelection(){const c=selected();document.querySelectorAll('[data-look-id]').forEach(button=>{const value=button.dataset.lookKind==='transitions'?c?.transition||'none':c?.filter||'original',active=value===button.dataset.lookId;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});const slider=$('filterStrength');if(slider)slider.disabled=!c||!['video','overlay'].includes(c.track)||!!trackState[c.track]?.locked;if(slider&&document.activeElement!==slider){slider.value=(c?.filterAmount??1)*100;$('filterStrengthValue').textContent=Math.round(slider.value)+'%';}}
  function renderDrawer(drawer,type){
    if(kind!==type){kind=type;category='all';query='';}resetCards();const filter=type==='filters',catalog=filter?TibeLooks.filters:TibeLooks.transitions;
    if(filter&&!$('popFilters').hidden){drawer.innerHTML=`<div class="sticker-floating-hint">${icon('filters')}<strong>Bộ lọc đang ở bảng nổi</strong><p>Cùng một thư viện màu, đặt ở nơi thuận tay.</p><button class="soft-button" onclick="togglePopover('popFilters')">${icon('pin')}Đưa về thư viện</button></div>`;return;}
    drawer.innerHTML=`<div class="look-library-heading"><div><span class="eyebrow">${filter?'COLOR STUDIO':'LIVE TRANSITIONS'}</span><strong>${catalog.length-1} ${filter?'bộ lọc màu':'chuyển cảnh'}</strong></div>${filter?`<button class="soft-button" onclick="togglePopover('popFilters')">${icon('popovers')}Bảng nổi</button>`:''}</div><p class="effect-help">${filter?'Rê chuột để thử màu · bấm để áp dụng':'Xem chuyển động trên từng ô · áp dụng ở đầu clip'}</p><div class="sticker-search">${icon('search')}<input type="search" aria-label="Tìm ${filter?'bộ lọc':'chuyển cảnh'}" placeholder="Tìm ${filter?'bộ lọc màu':'chuyển cảnh'}…" value="${esc(query)}"></div><div class="look-category-tabs">${groups[type].map(([id,name])=>`<button data-look-category="${id}" class="${category===id?'active':''}">${name}</button>`).join('')}</div>${filter?`<div class="filter-strength"><span>Cường độ</span><input id="filterStrength" type="range" min="0" max="100" step="1" value="${(selected()?.filterAmount??1)*100}" aria-label="Cường độ bộ lọc"><output id="filterStrengthValue">${Math.round((selected()?.filterAmount??1)*100)}%</output></div><div class="lut-import-row"><button class="soft-button" id="importCubeButton">${icon('upload')}Nhập LUT .cube</button><button class="soft-button" id="scanLutButton">${icon('bolt')}LUT trên máy</button></div>`:''}<div class="look-grid"></div>`;
    drawer.querySelector('input[type=search]').oninput=event=>{query=event.target.value;renderGrid(drawer.querySelector('.look-grid'),type);};drawer.querySelectorAll('[data-look-category]').forEach(button=>button.onclick=()=>{category=button.dataset.lookCategory;renderDrawer(drawer,type);});
    if(filter){$('filterStrength').oninput=event=>{setPercent('filterAmount',event.target.value);$('filterStrengthValue').textContent=event.target.value+'%';};$('importCubeButton').onclick=importCube;$('scanLutButton').onclick=()=>loadLocalLuts(true);}
    renderGrid(drawer.querySelector('.look-grid'),type);
  }
  function renderGrid(grid,type,compact=false){
    for(const card of [...cards])if(grid.contains(card.canvas)){observer?.unobserve(card.canvas);cards.delete(card);}
    const catalog=type==='filters'?TibeLooks.filters:TibeLooks.transitions,q=query.toLocaleLowerCase('vi');grid.replaceChildren();
    for(const look of catalog.filter(f=>(category==='all'||f.category===category||f.id==='original'||f.id==='none')&&f.name.toLocaleLowerCase('vi').includes(q))){
      const button=document.createElement('button');button.type='button';button.className='look-card';button.dataset.lookId=look.id;button.dataset.lookKind=type;
      const lutSource=look.lut&&TibeLooks.getLuts()[look.id]?.source;
      button.innerHTML=`<span class="look-thumbnail"><canvas width="240" height="150" aria-label="Xem thử ${esc(look.name)}"></canvas><span class="look-check">${icon('check')}</span>${type==='transitions'?'<span class="live-badge">LIVE</span>':''}</span><strong>${esc(look.name)}</strong>${compact?'':`<small>${look.lut?(look.category==='concat'?'Công thức Concat · SDR':lutSource?'LUT CapCut trên máy':'LUT đã nhập'):type==='filters'?'Bộ lọc màu':(look.category==='gl'?'GL Transitions · '+look.author:'Chuyển cảnh video')}</small>`}`;
      if(type==='filters'){button.onpointerenter=button.onfocus=()=>{const c=selected();if(c&&['video','overlay'].includes(c.track))lookSession={clipId:c.id,id:look.id};};button.onpointerleave=button.onblur=stopLookPreview;}
      button.onclick=()=>{stopLookPreview();if(type==='filters')applyLut(look.id);else{applyTransition(look.id);const c=selected();if(c?.track==='video')seekTo(c.start);}syncSelection();renderInspector();};grid.append(button);
      const entry={canvas:button.querySelector('canvas'),type,id:look.id,visible:!observer,drawn:false};cards.add(entry);observer?.observe(entry.canvas);
    }
    if(!grid.children.length)grid.innerHTML='<p class="note-label">Chưa có lựa chọn phù hợp. Thử nhóm khác hoặc nhập LUT.</p>';syncSelection();
  }
  function renderFloatingFilters(){const host=$('floatingFilters');if(!host)return;for(const entry of [...cards])if(host.contains(entry.canvas)){observer?.unobserve(entry.canvas);cards.delete(entry);}host.className='floating-filter-grid look-grid';renderGrid(host,'filters',true);}
  function setFilterCategory(value){category={featured:'all',film:'cinema',natural:'travel',retro:'retro'}[value]||value;query='';renderFloatingFilters();}
  function popoverChanged(id){if(id==='popFilters'||!$('popFilters').hidden||activeTab==='filters'){if(!groups.filters.some(([value])=>value===category))category='all';if(activeTab==='filters')root.renderDrawer();renderFloatingFilters();}}
  async function importCube(){const input=document.createElement('input');input.type='file';input.accept='.cube';input.onchange=async()=>{try{const file=input.files[0];if(!file)return;const lut=TibeLooks.parseCube(await file.text(),file.name.replace(/\.cube$/i,'')),id='lut:'+ClipCore.uid();TibeLooks.registerLuts({[id]:lut});category='local';query='';saveSoon();root.renderDrawer();toast('Đã nhập '+lut.title+'. Chọn bộ lọc để áp dụng.');}catch(error){toast(error.message);}};input.click();}
  async function loadLocalLuts(notify=false){
    if(location.protocol==='file:'){if(notify)toast('Mở run_studio.bat để đọc LUT trên máy.');return;}
    try{const response=await (root.TibeBackend?.request||root.fetch)('/api/rea/luts');const data=await response.json();if(!response.ok)throw Error(data.error);const entries={};for(const item of data.luts||[]){const lut=TibeLooks.parseCube(item.cube,item.name);lut.source=item.source;entries['lut:'+item.sha256]=lut;}TibeLooks.registerLuts(entries);if(notify){category='local';query='';root.renderDrawer();toast(Object.keys(entries).length?'Đã đọc '+Object.keys(entries).length+' LUT từ bản cài CapCut.':'Chưa có LUT .cube trên máy. Bạn có thể nhập tệp của mình.');}return data;}catch(error){if(notify)toast(error.message);}
  }
  function sampleSources(){if(!samples){samples=['coast-hd.png','cliff-hd.png'].map(name=>{const image=new Image();image.src='assets/demo/'+name;return image;});}return samples.every(im=>im.complete&&im.naturalWidth)?samples:null;}
  function animate(now){
    if(exporting||document.hidden||now-lastFrame<1000/24)return;lastFrame=now;const source=sampleSources();if(!source)return;
    for(const card of cards){if(!card.canvas.isConnected||!card.visible||card.canvas.closest('[hidden]')||(card.type==='filters'&&card.drawn))continue;const cx=card.canvas.getContext('2d'),w=240,h=150;cx.save();cx.clearRect(0,0,w,h);
      if(card.type==='transitions'){const reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;if(reduced&&card.drawn){cx.restore();continue;}TibeLooks.drawTransition(cx,source[0],source[1],{id:card.id,progress:reduced?.5:(now/1000%2.5)/2.5,width:w,height:h});}
      else{cx.filter=TibeLooks.cssFor(card.id);cx.drawImage(source[0],0,0,w,h);cx.filter='none';const lut=TibeLooks.getLuts()[card.id];if(lut){const data=cx.getImageData(0,0,w,h);TibeLooks.applyLut(data,lut,1);cx.putImageData(data,0,0);}}
      cx.restore();card.drawn=true;
    }
  }
  function start(){if(root.IntersectionObserver)observer=new IntersectionObserver(entries=>{for(const entry of entries){const card=[...cards].find(c=>c.canvas===entry.target);if(card)card.visible=entry.isIntersecting;}},{threshold:.02});document.addEventListener('visibilitychange',()=>{if(document.hidden)source?.pause();});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&source){event.preventDefault();event.stopPropagation();stopSource();}},true);window.addEventListener('beforeunload',stopSource);}
  root.TibeLibrary={start,attachMediaCard,playSource,stopSource,renderDrawer,resetCards,animate,previewLook,stopLookPreview,syncSelection,renderFloatingFilters,setFilterCategory,popoverChanged,loadLocalLuts};
})(window);
