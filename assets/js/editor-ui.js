(function(root){
  'use strict';
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=id=>document.getElementById(id);
  let selectMenu=null,selectOwner=null,selectButton=null,started=false;
  const triggers=new WeakMap();
  function syncSelects(){if(selectOwner&&(!selectOwner.isConnected||selectOwner.disabled))closeSelect();document.querySelectorAll('select[data-tibe-select]').forEach(select=>{const button=triggers.get(select);if(button){button.querySelector('.select-value').textContent=select.selectedOptions[0]?.textContent||'Chọn';button.disabled=select.disabled;button.title=select.title||'';}});}
  function closeSelect(focus=false){const button=selectButton;selectMenu?.remove();selectMenu=null;selectOwner=null;selectButton=null;if(button){button.setAttribute('aria-expanded','false');if(focus&&button.isConnected)button.focus({preventScroll:true});}}
  function openSelect(select,button){
    if(selectMenu&&selectOwner===select){closeSelect(true);return;}closeSelect();if(select.disabled)return;
    selectOwner=select;selectButton=button;const menu=document.createElement('div');menu.className='tibe-select-menu';menu.setAttribute('role','listbox');menu.setAttribute('aria-label',button.getAttribute('aria-label')||'Lựa chọn');menu.id='tibeSelectMenu';
    for(const option of select.options){
      const choice=document.createElement('button');choice.type='button';choice.className='tibe-select-option'+(option.selected?' chosen':'');choice.setAttribute('role','option');choice.setAttribute('aria-selected',String(option.selected));choice.disabled=option.disabled;choice.dataset.value=option.value;
      const ratio=select.id==='ratioSelect'?`<span class="ratio-swatch" style="--shape:${option.value.replace(':',' / ')}"></span>`:'';
      choice.innerHTML=ratio+'<span>'+escape(option.textContent)+'</span>'+icon('check');choice.onclick=event=>{event.preventDefault();const owner=selectOwner;closeSelect();owner.value=option.value;owner.dispatchEvent(new Event('input',{bubbles:true}));owner.dispatchEvent(new Event('change',{bubbles:true}));syncSelects();if(button.isConnected)button.focus({preventScroll:true});};menu.append(choice);
    }
    (select.closest('dialog[open]')||document.body).append(menu);selectMenu=menu;button.setAttribute('aria-expanded','true');button.setAttribute('aria-controls',menu.id);
    const rect=button.getBoundingClientRect(),width=Math.min(300,Math.max(178,rect.width));menu.style.width=width+'px';
    const spaceBelow=innerHeight-rect.bottom-12,spaceAbove=rect.top-12,up=spaceBelow<Math.min(menu.scrollHeight,200)&&spaceAbove>spaceBelow;
    menu.style.maxHeight=Math.max(90,Math.min(320,up?spaceAbove:spaceBelow))+'px';menu.style.left=Math.max(8,Math.min(innerWidth-width-8,rect.left))+'px';
    if(up)menu.style.bottom=(innerHeight-rect.top+7)+'px';else menu.style.top=(rect.bottom+7)+'px';
    (menu.querySelector('.chosen:not(:disabled)')||menu.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});
    menu.onkeydown=event=>{
      const options=[...menu.querySelectorAll('button:not(:disabled)')],index=options.indexOf(document.activeElement);let next=index;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeSelect(true);return;}
      if(event.key==='Tab'){closeSelect();return;}
      if(event.key==='ArrowDown')next=(index+1)%options.length;else if(event.key==='ArrowUp')next=(index-1+options.length)%options.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=options.length-1;else return;
      event.preventDefault();event.stopPropagation();options[next]?.focus({preventScroll:true});options[next]?.scrollIntoView({block:'nearest'});
    };
  }
  function enhanceSelects(container=document){
    container.querySelectorAll('select:not([data-tibe-select])').forEach(select=>{
      select.dataset.tibeSelect='true';const wrapper=document.createElement('span');wrapper.className='tibe-select';select.before(wrapper);wrapper.append(select);select.classList.add('tibe-native-select');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
      const button=document.createElement('button');button.type='button';button.className='tibe-select-trigger';button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label',select.getAttribute('aria-label')||select.title||select.parentElement.parentElement.querySelector('span')?.textContent||'Chọn');
      button.innerHTML='<span class="select-value"></span>'+icon('chevron');button.onclick=event=>{event.preventDefault();event.stopPropagation();openSelect(select,button);};button.onkeydown=event=>{if(['ArrowDown','ArrowUp','Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();openSelect(select,button);}};
      wrapper.append(button);triggers.set(select,button);select.addEventListener('change',syncSelects);
    });syncSelects();
  }

  const stickerNames={heart:'Trái tim hồng',sun:'Nắng vàng',flower:'Hoa anh đào',scribble:'Nét gạch xanh',sparkle:'Lấp lánh',outlineHeart:'Trái tim trắng',smile:'Nụ cười',sprig:'Nhánh lá',bow:'Nơ hồng'};
  const emoji=['😊','🥰','😎','🤍','💗','💖','🦋','🌼','🌸','🌿','🍃','🌈','☀️','🌙','☁️','⭐','✨','🔥','🎵','🎧','🎀','🎉','🪄','📸','💫','🍓','🍒','🍋','🍑','🥥','🌊','🐚','🫶','💌','🎬','🪩'];
  const shapes=['♡','☆','●','✦','△','◇','☾','○','□','✧','♥','★','✿','✽','❀','◌','▱','◈'];
  const categories=[['all','Tất cả'],['aesthetic','Aesthetic'],['emoji','Emoji'],['shape','Hình'],['favorites','Yêu thích'],['recent','Gần đây']];
  const readList=key=>{try{const list=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(list)?list.filter(v=>typeof v==='string').slice(0,100):[];}catch{return [];}};
  let favorite=new Set(readList('tibe-sticker-favorites')),recent=readList('tibe-sticker-recent'),stickerCategory='all',stickerQuery='',density='cozy';
  const known=key=>Object.hasOwn(STICKER_SVGS,key)||emoji.includes(key)||shapes.includes(key);
  favorite=new Set([...favorite].filter(known));recent=recent.filter(known);
  function persistStickers(){try{localStorage.setItem('tibe-sticker-favorites',JSON.stringify([...favorite]));localStorage.setItem('tibe-sticker-recent',JSON.stringify(recent));}catch{}}
  const stickerName=key=>stickerNames[key]||key;
  function stickerList(){let list=stickerCategory==='favorites'?[...favorite]:stickerCategory==='recent'?recent:stickerCategory==='aesthetic'?Object.keys(STICKER_SVGS):stickerCategory==='emoji'?emoji:stickerCategory==='shape'?shapes:[...Object.keys(STICKER_SVGS),...emoji,...shapes];const query=stickerQuery.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'');return list.filter(key=>(stickerName(key)+' '+key).toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(query));}
  function renderStickerGrid(host){
    const grid=host.querySelector('.sticker-choice-grid');if(!grid)return;grid.replaceChildren();grid.dataset.density=density;const list=stickerList();
    host.querySelectorAll('[data-sticker-category]').forEach(button=>{const active=button.dataset.stickerCategory===stickerCategory;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    const search=host.querySelector('input');if(search&&search.value!==stickerQuery)search.value=stickerQuery;
    host.querySelector('.sticker-result-count').textContent=list.length+' sticker · kéo vào khung hình hoặc timeline';
    for(const key of list){
      const card=document.createElement('div');card.className='sticker-choice';card.draggable=true;card.dataset.stickerKey=key;
      const add=document.createElement('button');add.type='button';add.className='sticker-add';add.title=stickerName(key)+' · bấm để thêm';add.setAttribute('aria-label','Thêm sticker '+stickerName(key));const svg=STICKER_SVGS[key],gradient='sticker_'+ClipCore.uid();add.innerHTML=svg?svg.replace('id="h"',`id="${gradient}"`).replace('url(#h)',`url(#${gradient})`):`<span class="sticker-symbol">${escape(key)}</span>`;add.onclick=()=>addSticker(key);
      const star=document.createElement('button');star.className='sticker-favorite'+(favorite.has(key)?' active':'');star.title=favorite.has(key)?'Bỏ yêu thích':'Thêm yêu thích';star.setAttribute('aria-label',star.title+' '+stickerName(key));star.setAttribute('aria-pressed',String(favorite.has(key)));star.innerHTML=icon('heart');star.onclick=event=>{event.stopPropagation();favorite.has(key)?favorite.delete(key):favorite.add(key);persistStickers();refreshStickerSurfaces();};
      card.append(add,star);card.ondragstart=event=>{event.dataTransfer.setData('application/x-tibe-sticker',key);event.dataTransfer.effectAllowed='copy';};grid.append(card);
    }
    if(!list.length){const empty=document.createElement('div');empty.className='sticker-empty';empty.innerHTML=icon('stickers')+'<strong>'+ (stickerCategory==='favorites'?'Chạm trái tim để lưu sticker':stickerCategory==='recent'?'Sticker vừa dùng sẽ nằm ở đây':'Không tìm thấy sticker')+'</strong>';grid.append(empty);}
  }
  function refreshStickerSurfaces(){document.querySelectorAll('.sticker-library-surface').forEach(renderStickerGrid);}
  function renderStickerSurface(host,floating=false){
    host.classList.add('sticker-library-surface');host.innerHTML=`<div class="sticker-search">${icon('search')}<input type="search" aria-label="${floating?'Tìm sticker trong bảng nổi':'Tìm sticker'}" placeholder="Tìm sticker…" value="${escape(stickerQuery)}"><button class="icon-btn density-toggle" title="Đổi kích thước ô sticker">${icon('gridDense')}</button></div><div class="sticker-category-tabs">${categories.map(([key,name])=>`<button data-sticker-category="${key}">${name}</button>`).join('')}</div><p class="sticker-result-count"></p><div class="sticker-choice-grid"></div>`;
    host.querySelector('input').oninput=event=>{stickerQuery=event.target.value;refreshStickerSurfaces();};host.querySelector('.density-toggle').onclick=()=>{density=density==='cozy'?'compact':'cozy';refreshStickerSurfaces();};host.querySelectorAll('[data-sticker-category]').forEach(button=>button.onclick=()=>setStickerCategory(button.dataset.stickerCategory));renderStickerGrid(host);
  }
  function renderStickerDrawer(drawer){
    if(!$('popStickers').hidden){drawer.innerHTML=`<div class="sticker-floating-hint">${icon('popovers')}<strong>Sticker đang ở bảng nổi</strong><p>Kéo thanh tiêu đề để di chuyển, kéo góc dưới để đổi kích thước.</p><button class="soft-button" onclick="togglePopover('popStickers')">${icon('pin')}Đưa về thư viện</button></div>`;return;}
    const tools=document.createElement('div');tools.className='sticker-library-toolbar';tools.innerHTML='<span>STICKER LIBRARY</span><button class="soft-button" onclick="togglePopover(\'popStickers\')">'+icon('popovers')+'Bảng nổi</button>';drawer.append(tools);const surface=document.createElement('div');drawer.append(surface);renderStickerSurface(surface);
  }
  function setStickerCategory(category){stickerCategory=categories.some(([id])=>id===category)?category:'all';if(!$('floatingStickerBody').classList.contains('sticker-library-surface'))renderStickerSurface($('floatingStickerBody'),true);refreshStickerSurfaces();}
  function rememberSticker(key){if(!known(key))return;recent=[key,...recent.filter(k=>k!==key)].slice(0,36);persistStickers();if(stickerCategory==='recent')refreshStickerSurfaces();}
  function popoverChanged(id,opening){if(id==='popStickers'&&opening)renderStickerSurface($('floatingStickerBody'),true);if(activeTab==='stickers')renderDrawer();TibeLibrary.popoverChanged(id);requestAnimationFrame(constrainPopovers);}
  function constrainPopovers(){const area=$('viewportArea').getBoundingClientRect();for(const id of ['popStickers','popFilters','popSpeed']){const panel=$(id);if(panel.hidden)continue;const rect=panel.getBoundingClientRect();if(rect.left<area.left+4||rect.right>area.right-4||rect.top<area.top+4||rect.bottom>area.bottom-4){panel.style.transform='none';panel.style.right='auto';panel.style.bottom='auto';panel.style.left=Math.max(4,Math.min(area.width-rect.width-4,rect.left-area.left))+'px';panel.style.top=Math.max(4,Math.min(area.height-rect.height-4,rect.top-area.top))+'px';}}}
  function wireStickerDrag(){
    const panel=$('popStickers'),handle=panel.querySelector('header');handle.addEventListener('pointerdown',event=>{if(event.button!==0||event.target.closest('button'))return;event.preventDefault();const area=$('viewportArea').getBoundingClientRect(),rect=panel.getBoundingClientRect(),sx=event.clientX,sy=event.clientY;panel.style.transform='none';panel.style.right='auto';panel.style.bottom='auto';panel.classList.add('moving');const move=ev=>{panel.style.left=Math.max(4,Math.min(area.width-rect.width-4,rect.left-area.left+ev.clientX-sx))+'px';panel.style.top=Math.max(4,Math.min(area.height-rect.height-4,rect.top-area.top+ev.clientY-sy))+'px';};move(event);window.addEventListener('pointermove',move);window.addEventListener('pointerup',()=>{window.removeEventListener('pointermove',move);panel.classList.remove('moving');},{once:true});});
    const accept=event=>event.dataTransfer.types.includes('application/x-tibe-sticker');
    const workspace=$('canvasWorkspace');workspace.addEventListener('dragover',event=>{if(accept(event)){event.preventDefault();workspace.classList.add('sticker-drop-target');}});workspace.addEventListener('dragleave',()=>workspace.classList.remove('sticker-drop-target'));workspace.addEventListener('drop',event=>{if(!accept(event))return;event.preventDefault();workspace.classList.remove('sticker-drop-target');const key=event.dataTransfer.getData('application/x-tibe-sticker');if(!known(key))return;const rect=$('previewCanvas').getBoundingClientRect();addSticker(key,{xOffset:Math.round((event.clientX-rect.left)/rect.width*450-225),yOffset:Math.round((event.clientY-rect.top)/rect.width*450-225*rect.height/rect.width)});});
    const lane=$('lane-sticker');lane.addEventListener('dragover',event=>{if(accept(event)){event.preventDefault();lane.classList.add('drop-target');}});lane.addEventListener('drop',event=>{if(!accept(event))return;event.preventDefault();lane.classList.remove('drop-target');const key=event.dataTransfer.getData('application/x-tibe-sticker');if(known(key))addSticker(key,{start:Math.max(0,(event.clientX-lane.getBoundingClientRect().left)/pxPerSec)});});
  }

  const effectCategories=[['all','Tất cả'],['motion','Chuyển động'],['light','Ánh sáng'],['retro','Retro'],['lens','Ống kính'],['nature','Thiên nhiên'],['party','Sáng tạo'],['capcut','CapCut trên máy']];
  let effectCategory='all',effectSearch='',previewPlaying=true,previewSession=null,sampleImage=null,sampleCanvas=null,lastPreviewFrame=0;
  const previewCards=new Set();let previewObserver;
  function resetEffectCards(){for(const card of previewCards)previewObserver?.unobserve(card.canvas);previewCards.clear();}
  function syncEffectSelection(){const id=selected()?.effect||'none';document.querySelectorAll('.effect-card').forEach(button=>{const chosen=button.dataset.effectId===id;button.classList.toggle('active',chosen);button.setAttribute('aria-pressed',String(chosen));});}
  function stopEffectPreview(){previewSession=null;if($('effectPreviewLabel'))$('effectPreviewLabel').hidden=true;}
  function startEffectPreview(id,pinned=false){const clip=selected();if(!clip||!['video','overlay'].includes(clip.track)||exporting)return;previewSession={clipId:clip.id,id,started:performance.now(),pinned};$('effectPreviewLabel').textContent='Xem thử · '+(TibeEffects.catalog.find(e=>e.id===id)?.name||id);$('effectPreviewLabel').hidden=false;}
  function effectPreview(clip,time){if(!exporting&&!isPlaying&&previewSession?.clipId===clip.id)return{effect:previewSession.id,time:time+(performance.now()-previewSession.started)/1000};return{effect:clip.effect||'none',time};}
  function applyEffect(id){const c=selected();if(!c||!['video','overlay'].includes(c.track))return toast('Chọn clip video hoặc ảnh trên timeline.');if(trackState[c.track]?.locked)return toast('Track đang khóa.');if(!TibeEffects.catalog.some(e=>e.id===id))return;updateActiveClip('effect',id);if(currentTime<c.start||currentTime>=c.start+c.duration)seekTo(c.start+Math.min(.15,c.duration/2));renderDrawer();renderInspector();startEffectPreview(id,true);}
  function renderEffectsDrawer(drawer){
    drawer.innerHTML=`<div class="effects-intro"><div><span class="eyebrow">LIVE EFFECTS</span><strong>${TibeEffects.catalog.length-1} hiệu ứng video</strong></div><button class="icon-btn effect-preview-toggle" aria-label="${previewPlaying?'Dừng':'Bật'} xem thử hiệu ứng" title="${previewPlaying?'Dừng':'Bật'} xem thử">${icon(previewPlaying?'pause':'play')}</button></div><p class="effect-help">Rê chuột để thử trên clip · bấm để áp dụng</p><div class="sticker-search">${icon('search')}<input type="search" aria-label="Tìm hiệu ứng" placeholder="Tìm hiệu ứng…" value="${escape(effectSearch)}"></div><div class="effect-category-tabs">${effectCategories.map(([id,name])=>`<button data-effect-category="${id}" class="${effectCategory===id?'active':''}">${name}</button>`).join('')}</div><div class="effects-grid"></div>`;
    drawer.querySelector('.effect-preview-toggle').onclick=()=>{previewPlaying=!previewPlaying;renderDrawer();};drawer.querySelector('input').oninput=event=>{effectSearch=event.target.value;renderEffectGrid(drawer.querySelector('.effects-grid'));};drawer.querySelectorAll('[data-effect-category]').forEach(button=>button.onclick=()=>{effectCategory=button.dataset.effectCategory;renderDrawer();});renderEffectGrid(drawer.querySelector('.effects-grid'));
  }
  function renderEffectGrid(grid){
    resetEffectCards();grid.replaceChildren();const query=effectSearch.toLocaleLowerCase('vi'),list=TibeEffects.catalog.filter(effect=>(effectCategory==='all'||effect.category===effectCategory)&&(effect.name+' '+effect.description).toLocaleLowerCase('vi').includes(query));
    for(const effect of list){
      const button=document.createElement('button');button.type='button';button.className='effect-card'+((selected()?.effect||'none')===effect.id?' active':'');button.dataset.effectId=effect.id;button.setAttribute('aria-label','Áp dụng '+effect.name);button.setAttribute('aria-pressed',String((selected()?.effect||'none')===effect.id));
      button.innerHTML=`<span class="effect-preview"><canvas width="240" height="150" aria-label="Xem thử ${escape(effect.name)}"></canvas><span class="live-badge">${effect.id==='none'?'ORIGINAL':'LIVE'}</span><span class="effect-apply-mark">${icon('check')}</span></span><strong>${escape(effect.name)}</strong><small>${escape(effect.description)}</small>`;
      button.onpointerenter=()=>startEffectPreview(effect.id);button.onpointerleave=()=>{if(!previewSession?.pinned)stopEffectPreview();};button.onfocus=()=>startEffectPreview(effect.id);button.onblur=()=>{if(!previewSession?.pinned)stopEffectPreview();};button.onclick=()=>applyEffect(effect.id);grid.append(button);
      const card={canvas:button.querySelector('canvas'),effect:effect.id,visible:!previewObserver,drawn:false};previewCards.add(card);previewObserver?.observe(card.canvas);
    }
    if(!list.length)grid.innerHTML='<p class="note-label">Không tìm thấy hiệu ứng phù hợp.</p>';
  }
  function animatePreviews(now){
    if(previewSession&&(exporting||isPlaying||selected()?.id!==previewSession.clipId||(previewSession.pinned&&now-previewSession.started>3200)))stopEffectPreview();
    if(exporting||document.hidden||now-lastPreviewFrame<1000/24||!previewCards.size)return;lastPreviewFrame=now;
    if(!sampleImage){sampleImage=new Image();sampleImage.src='assets/demo/coast-hd.png';}if(!sampleImage.complete||!sampleImage.naturalWidth)return;
    if(!sampleCanvas){sampleCanvas=document.createElement('canvas');sampleCanvas.width=360;sampleCanvas.height=225;const cx=sampleCanvas.getContext('2d'),k=Math.max(360/sampleImage.naturalWidth,225/sampleImage.naturalHeight);cx.drawImage(sampleImage,(360-sampleImage.naturalWidth*k)/2,(225-sampleImage.naturalHeight*k)/2,sampleImage.naturalWidth*k,sampleImage.naturalHeight*k);}
    for(const card of previewCards){if(!card.canvas.isConnected||!card.visible||(!previewPlaying&&card.drawn))continue;const ctx=card.canvas.getContext('2d'),w=card.canvas.width,h=card.canvas.height;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);ctx.save();ctx.scale(w/450,w/450);ctx.translate(225,h/w*225);TibeEffects.draw(ctx,sampleCanvas,{width:450,height:450*h/w,effect:card.effect,time:previewPlaying?now/1000%5:1,amount:.72});ctx.restore();card.drawn=true;}
  }
  function waveformElement(c,m,width){
    const host=document.createElement('div');host.className='audio-wave';const values=ClipCore.waveformForClip(c,m?.peaks,m?.duration,Math.max(40,Math.min(1200,Math.round(width/2))));
    if(values.length){const n=values.length,w=Math.max(2,Math.round(width)),points=values.map((v,i)=>`${(i/(n-1)*w).toFixed(1)},${(20-v*18).toFixed(2)}`),lower=values.map((v,i)=>`${(i/(n-1)*w).toFixed(1)},${(20+v*18).toFixed(2)}`).reverse();host.innerHTML=`<svg viewBox="0 0 ${w} 40" preserveAspectRatio="none" aria-label="Sóng âm thực của ${escape(c.title)}"><path class="wave-envelope" d="M${points.join(' L')} L${lower.join(' L')}Z"/><path class="wave-center" d="M0 20H${w}"/></svg>`;host.dataset.waveform='ready';host.title='Sóng âm từ tư liệu gốc · đã tính theo trim, tốc độ, volume và fade';}
    else{host.classList.add('pending');host.dataset.waveform=m?.waveError?'error':'loading';host.textContent=m?.waveError?'Không đọc được sóng âm':'Đang phân tích âm thanh…';host.title=m?.waveError||'Đang giải mã âm thanh gốc';}
    return host;
  }
  function start(){
    if(started)return;started=true;enhanceSelects();
    new MutationObserver(records=>{let added=false;for(const record of records){if(record.type==='attributes'&&record.target.tagName==='SELECT'){syncSelects();continue;}for(const node of record.addedNodes){if(node.nodeType===1&&(node.matches('select:not([data-tibe-select])')||node.querySelector('select:not([data-tibe-select])'))){added=true;break;}}}if(added)enhanceSelects();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
    document.addEventListener('pointerdown',event=>{if(selectMenu&&!selectMenu.contains(event.target)&&!selectButton?.contains(event.target))closeSelect();});window.addEventListener('resize',()=>{closeSelect();constrainPopovers();});window.addEventListener('scroll',event=>{if(selectMenu&&!selectMenu.contains(event.target))closeSelect();},true);
    document.addEventListener('keydown',event=>{if(event.key==='Escape')stopEffectPreview();});
    $('studioDialog').addEventListener('close',()=>closeSelect());
    if(root.IntersectionObserver)previewObserver=new IntersectionObserver(entries=>{for(const entry of entries){const card=[...previewCards].find(c=>c.canvas===entry.target);if(card)card.visible=entry.isIntersecting;}},{threshold:.05});
    if(root.matchMedia?.('(prefers-reduced-motion:reduce)')?.matches)previewPlaying=false;
    if(root.ResizeObserver)new ResizeObserver(constrainPopovers).observe($('popStickers'));
    wireStickerDrag();
  }
  root.TibeUI={start,syncSelects,renderStickerDrawer,setStickerCategory,rememberSticker,stickerName,popoverChanged,constrainPopovers,renderEffectsDrawer,resetEffectCards,syncEffectSelection,animatePreviews,stopEffectPreview,effectPreview,applyEffect,waveformElement};
})(window);
