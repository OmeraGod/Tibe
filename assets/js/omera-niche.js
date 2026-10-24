/* Local editorial evidence. Never sends private channel data externally. */
(()=>{'use strict';const $=id=>document.getElementById(id),nf=new Intl.NumberFormat('vi-VN');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=u=>{try{const x=new URL(u);return x.protocol==='https:'?x.href:null;}catch{return null;}};
window.OmeraNiche={render(p){const root=$('niche-research');root.hidden=!p;if(!p)return;
$('niche-choice').textContent=p.selection_reason;$('niche-limit').textContent=p.limitations;
$('niche-examples').innerHTML=(p.examples||[]).map(e=>{const u=safe(e.url);return `<article class="niche-example"><strong>${esc(e.channel)}</strong><p>${esc(e.title)}</p><small>${nf.format(e.views)} lượt xem · ${nf.format(e.likes)} thích<br>Đăng ${esc(e.published_at)} · mẫu từ chỉ mục tìm kiếm<br>${esc(e.format)}</small>${u?`<a href="${esc(u)}" target="_blank" rel="noopener">Nguồn video ↗</a>`:''}</article>`;}).join('');
const b=p.next_pilot||{};$('niche-title').textContent=b.title;$('niche-state').textContent=b.note;
$('niche-editor').hidden=!/^[a-f0-9]{32}$/.test(b.project_id||'');$('niche-editor').href='/?project='+encodeURIComponent(b.project_id||'');
$('niche-editor').textContent=b.rendered?'Chỉnh bản dài 16:9 ↗':'Mở phân cảnh 16:9 ↗';
let published=$('niche-published');if(!published){published=document.createElement('a');published.id='niche-published';published.className='button primary';$('niche-editor').parentElement.append(published);}const publishedUrl=/^https:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]{11}$/.test(b.published_url||'')?b.published_url:null;published.hidden=!b.published||!publishedUrl;published.textContent='Xem video đã công khai ↗';published.href=publishedUrl||'#';published.target='_blank';published.rel='noopener';
$('niche-script').onclick=()=>{const button=Array.from(document.querySelectorAll('[data-brief]')).find(x=>x.dataset.brief===b.slug);if(button)button.click();};
let preview=$('niche-preview');if(!preview){preview=document.createElement('button');preview.id='niche-preview';preview.className='button secondary';$('niche-editor').parentElement.append(preview);}preview.textContent=b.rendered?'Xem bản dài đã xuất':'Xem thử đoạn mở đầu';preview.hidden=!b.preview_rendered;
preview.onclick=()=>{$('detail-title').textContent=b.rendered?'Bản dài · '+(b.published?'đã công khai':b.uploaded?'đã tải lên':'chưa đăng YouTube'):'Bản mở đầu · chưa phải video đầy đủ';const note=document.createElement('p');note.textContent=b.note;const player=document.createElement('video');player.controls=true;player.playsInline=true;player.style.width='100%';player.preload='metadata';player.src='api/omera/preview/'+encodeURIComponent(b.slug);$('detail-body').replaceChildren(note,player);$('detail').showModal();};
$('niche-watch').textContent='Mục tiêu thử 4.000 giờ trong80ngày: giả định xem trung bình4phút cần60.000lượt xem video dài hợp lệ, tương đương750/ngày. Đây là phép tính kế hoạch, không phải số liệu kênh hoặc dự báo. Còn cần1.000đăng ký và xét duyệt; giờ TrangShorts không cộng vào nhánh giờ công khai.';
$('niche-evaluate').textContent=p.experiment?.evaluation||'';}};
})();
