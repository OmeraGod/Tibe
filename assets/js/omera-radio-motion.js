/* Original teaching graphics. Deterministic clock shared by Tibe preview/export.
 * A diagram illustrates timing; it does not claim to animate the photographed hand.
 */
(function(root){'use strict';
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
function model(c,time){const g=c.motionGraphic,t=Math.max(0,time),wait=g.wait??.2,turn=clamp((t-wait)/.6),lamp=clamp((t-wait-.6)/.12);return{turn,lamp,elapsed:t,progress:clamp(t/c.duration),cut:g.cut??3};}
function draw(ctx,c,time,w,h){
 const g=c.motionGraphic,m=model(c,time);ctx.save();ctx.fillStyle='rgba(8,18,24,.94)';ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,8);ctx.fill();ctx.translate(-w/2,-h/2);ctx.textBaseline='middle';
 const text=(s,x,y,size=11,color='#f5ecd9',align='left')=>{ctx.font=`${size>=11?'600':'400'} ${size}px Segoe UI`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(s,x,y);};
 const line=(x1,y1,x2,y2,color='#597580',width=1)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
 text(g.label||'MÔ PHỎNG NHỊP DỰNG',18,19,10,'#e5bc77');
 if(['radio','reaction','clock','signal','question'].includes(g.type)){
  const rx=w*.12,ry=40,rw=w*.76,rh=h-84;ctx.fillStyle='#744b31';ctx.beginPath();ctx.roundRect(rx,ry,rw,rh,8);ctx.fill();ctx.strokeStyle='#c99d65';ctx.stroke();
  for(let n=0;n<6;n++)line(rx+12,ry+14+n*5,rx+rw*.52,ry+14+n*5,'#241e1c',2);
  const cx=rx+rw*.79,cy=ry+rh*.5;ctx.strokeStyle='#d4b88c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,15,0,Math.PI*2);ctx.stroke();const angle=-Math.PI*.8+m.turn*Math.PI*.65;line(cx,cy,cx+Math.cos(angle)*12,cy+Math.sin(angle)*12,'#ffe4a2',2);
  ctx.fillStyle=m.lamp>.5?'#ffd36d':'#574633';ctx.shadowColor='#ffd36d';ctx.shadowBlur=m.lamp*8;ctx.beginPath();ctx.arc(rx+rw*.58,ry+rh*.55,3,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  const frequency=g.type==='signal'?.25+.5*(Math.sin(time*1.8)+1)/2:.65;line(rx+12,ry+rh-12,rx+rw*.52,ry+rh-12,'#c6b291');line(rx+12+frequency*rw*.46,ry+rh-18,rx+12+frequency*rw*.46,ry+rh-7,'#77d5cb',2);
  text(m.turn<.01?'CHỜ MỘT NHỊP':m.lamp<.5?'ĐANG XOAY NÚM':'ĐÈN BẬT',w/2,h-31,10,m.lamp>.5?'#f9d17a':'#9bbbbc','center');
  if(g.type==='clock'){text('CHƯƠNG TRÌNH SẮP BẮT ĐẦU',w/2,h-48,8,'#aad4d0','center');}
  if(g.type==='reaction'){const observe=clamp((time-(g.wait??.2)-.72)/2);text(observe>.5?'GIỮ LẠI PHẢN ỨNG':'KẾT QUẢ CHƯA LÀ HẾT',w/2,h-48,8,'#aad4d0','center');}
 }else if(g.type==='timeline'){
  const rows=g.rows||[{label:'A · CẮT NGAY',wait:.2},{label:'B · CÓ ĐIỀU CHỜ',wait:2.4},{label:'C · CHỈ KÉO DÀI',wait:3.8}];rows.forEach((row,i)=>{const y=49+i*30; text(row.label,18,y,9);const x=146,span=w-x-20;ctx.fillStyle='#28434c';ctx.fillRect(x,y-6,span,12);ctx.fillStyle=i===1?'#d1a364':'#6e9198';ctx.fillRect(x,y-6,span*clamp(row.wait/4),12);const head=(time%4)/4;line(x+span*head,y-10,x+span*head,y+10,'#f1f1e7',1);});
  text(g.caption||'CÙNG KẾT QUẢ · KHÁC THỜI ĐIỂM',w/2,h-25,9,'#aad4d0','center');
 }else if(g.type==='sound'){
  const mode=g.mode||'rain',x=18,y=53;for(let i=0;i<60;i++){const t=i/60*7+time,amp=mode==='switch'?Math.exp(-Math.abs(i-35)*.25)*(time>2.4?1:.04):.2+.7*Math.abs(Math.sin(t*3.1)*Math.cos(t*.7));line(x+i*(w-36)/60,y+30-amp*22,x+i*(w-36)/60,y+30+amp*22,mode==='switch'?'#e8b875':'#88c7c3',1.5);}text(mode==='switch'?'CÔNG TẮC · MỘT ĐIỂM CHÚ Ý':'MƯA · KHÔNG GIAN CĂN PHÒNG',w/2,h-34,10,'#f4e6c7','center');
 }else if(g.type==='story'){
  const labels=g.labels||['MONG MUỐN','ĐIỀU CHƯA BIẾT','PHẢN ỨNG'];labels.forEach((s,i)=>{const y=47+i*31,active=Math.min(labels.length-1,Math.floor(time/3))===i;ctx.fillStyle=active?'#365a60':'#172d37';ctx.beginPath();ctx.roundRect(18,y-10,w-36,23,4);ctx.fill();text(s,29,y+2,10,active?'#ffe0a0':'#aec3c7');});
 }else if(g.type==='exercise'){
  const reveal=clamp((time-1.6)/.5);text('MỘT TIN NHẮN MỚI',w/2,48,13,'#eee8d8','center');ctx.fillStyle='#2b4c57';ctx.beginPath();ctx.roundRect(w/2-60,66,120,33,6);ctx.fill();text(reveal>.5?'MỞ KẾT QUẢ':'CHƯA MỞ',w/2,83,11,'#e1c18c','center');text(g.caption||'NGƯỜI NÀY ĐANG MONG HAY SỢ?',w/2,h-32,10,'#a5cfca','center');
 }
 ctx.fillStyle='#31515c';ctx.fillRect(18,h-10,w-36,2);ctx.fillStyle='#d0ab70';ctx.fillRect(18,h-10,(w-36)*m.progress,2);ctx.restore();
}
const api={model,draw};if(typeof module!=='undefined')module.exports=api;else root.OmeraRadio=api;
})(typeof window==='undefined'?globalThis:window);
