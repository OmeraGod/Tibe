(function (root) {
  'use strict';
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const num = (n, fallback = 0) => Number.isFinite(Number(n)) ? Number(n) : fallback;
  const uid = () => 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const copy = value => JSON.parse(JSON.stringify(value));
  const CURVES = {
    montage:[[0,1],[.22,2.5],[.48,.5],[.72,2.5],[1,1]],
    hero:[[0,1],[.3,1.6],[.48,.3],[.75,.3],[1,1.7]],
    bullet:[[0,2],[.3,2],[.42,.25],[.67,.25],[1,2]],
    jump_cut:[[0,.5],[.2,.5],[.38,3],[.6,3],[.78,.5],[1,.5]]
  };
  function curvePoints(c) { return CURVES[c.speedCurve] || [[0,1],[1,1]]; }
  // Cubic Bezier with horizontal handles (smoothstep); integrate analytically.
  function curveIntegral(c,x) {
    const points=curvePoints(c);let area=Math.min(0,x)*points[0][1];
    for(let i=1;i<points.length;i++){
      const [a,va]=points[i-1],[b,vb]=points[i],u=clamp((x-a)/(b-a),0,1);
      area+=(b-a)*(va*u+(vb-va)*(u*u*u-.5*u*u*u*u));
    }
    return area+Math.max(0,x-1)*points.at(-1)[1];
  }
  function rateAt(c,time) {
    const x=(time+num(c.curveOffset))/Math.max(.05,num(c.curveSpan,c.duration));
    const points=curvePoints(c);let v=points[0][1];
    for(let i=1;i<points.length;i++){const [a,va]=points[i-1],[b,vb]=points[i];if(x>=a){const u=clamp((x-a)/(b-a),0,1);v=va+(vb-va)*u*u*(3-2*u);}}
    return (c.speed||1)*v;
  }
  function sourceOffset(c,time) {
    if(!CURVES[c.speedCurve])return time*(c.speed||1);
    const span=Math.max(.05,num(c.curveSpan,c.duration)),offset=num(c.curveOffset);
    return span*(c.speed||1)*(curveIntegral(c,(offset+time)/span)-curveIntegral(c,offset/span));
  }
  function sourceTime(c,time) {return Math.max(0,num(c.sourceIn)+sourceOffset(c,time));}
  function inverseSource(c,amount) {if(!CURVES[c.speedCurve])return amount/(c.speed||1);let lo=-216000,hi=216000;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(sourceOffset(c,mid)<amount)lo=mid;else hi=mid;}return (lo+hi)/2;}
  function setCurve(c,name) {
    const amount=sourceOffset(c,c.duration),old=c.duration;
    c.speedCurve=CURVES[name]?name:'none';c.curveOffset=0;
    c.duration=amount/((c.speed||1)*curveIntegral(c,1));c.curveSpan=c.duration;
    c.keyframes?.forEach(k=>k.time*=c.duration/old);return c;
  }
  function normalize(c) {
    const out = { ...c, id: String(c.id || uid()), title:String(c.title||''), start: Math.max(0, num(c.start)), duration: clamp(num(c.duration, 4), .05, 21600),
      sourceIn: Math.max(0, num(c.sourceIn)), speed: clamp(num(c.speed, 1), .25, 4),
      scale: clamp(num(c.scale, 1), .1, 5), xOffset: num(c.xOffset), yOffset: num(c.yOffset),
      rotation: num(c.rotation), opacity: clamp(num(c.opacity, 1), 0, 1), volume: clamp(num(c.volume, 1), 0, 2),
      fontSize:clamp(num(c.fontSize,c.track==='sticker'?50:42),12,120), crop:clamp(num(c.crop),0,40),
      effectAmount:clamp(num(c.effectAmount,.7),0,1),
      filterAmount:clamp(num(c.filterAmount,1),0,1),
      fadeIn:clamp(num(c.fadeIn),0,30),fadeOut:clamp(num(c.fadeOut),0,30),transitionDuration:clamp(num(c.transitionDuration,.5),.05,5),
      chromaColor:/^#[0-9a-f]{6}$/i.test(c.chromaColor)?c.chromaColor:'#00ff00',chromaStrength:clamp(num(c.chromaStrength,35),0,100),chromaShadow:clamp(num(c.chromaShadow,20),0,100),
      maskFeather:clamp(num(c.maskFeather),0,50),maskInvert:!!c.maskInvert,
      speedCurve:CURVES[c.speedCurve]?c.speedCurve:'none',curveSpan:Math.max(.05,num(c.curveSpan,num(c.duration,4))),curveOffset:num(c.curveOffset),
      adjust:Object.fromEntries(['brightness','contrast','saturation','temp','vignette','sharpen','highlight','shadow'].map(k=>[k,clamp(num(c.adjust?.[k]),-50,50)])),
      keyframes:Array.isArray(c.keyframes)?c.keyframes.filter(k=>k&&Number.isFinite(Number(k.time))).slice(0,1000).map(k=>({time:Math.max(0,num(k.time)),xOffset:num(k.xOffset),yOffset:num(k.yOffset),scale:clamp(num(k.scale,1),.1,5),rotation:num(k.rotation),opacity:clamp(num(k.opacity,1),0,1)})):[] };
    return out;
  }
  function split(c, time) {
    const offset = time - c.start;
    if (offset < .05 || offset > c.duration - .05) return null;
    const left = copy(c), right = copy(c);
    left.duration = offset; right.id = uid(); right.start = time; right.duration -= offset;
    right.sourceIn = sourceTime(c,offset);
    right.curveOffset = num(c.curveOffset) + offset;
    // Keep the original animation time after splitting/trimming a clip.
    right.animationOffset = (c.animationOffset || 0) + offset;
    right.transition = 'none';
    if (c.keyframes?.length) {
      left.keyframes = c.keyframes.filter(k => k.time <= offset);
      const boundary = { time: 0, ...transform(c, offset) };
      right.keyframes = [boundary, ...c.keyframes.filter(k => k.time > offset).map(k => ({ ...k, time: k.time - offset }))];
      left.keyframes.push({time: offset, ...transform(c, offset)});
    }
    return [left, right];
  }
  function trim(c, left, right) {
    const a = clamp(left, 0, c.duration - .05), b = clamp(right, a + .05, c.duration);
    return resize(c, a, b-c.duration);
  }
  function speed(c, rate) {
    rate = clamp(num(rate,1),.25,4);
    const ratio = (c.speed || 1) / rate;
    c.duration *= ratio;
    if(c.curveSpan)c.curveSpan*=ratio;
    if(c.curveOffset)c.curveOffset*=ratio;
    if (c.keyframes) c.keyframes.forEach(k => k.time *= ratio);
    c.speed = rate;
    return c;
  }
  function resize(c, leftDelta, rightDelta, sourceDuration=Infinity) {
    const finite = Number.isFinite(sourceDuration);
    const left=clamp(num(leftDelta),Math.max(-c.start,finite?inverseSource(c,-(c.sourceIn||0)):-Infinity),c.duration-.05);
    const maxRight=finite?Math.max(0,inverseSource(c,sourceDuration-(c.sourceIn||0)))-c.duration:21600;
    const right=clamp(num(rightDelta),left-c.duration+.05,Math.max(left-c.duration+.05,maxRight));
    const result={...copy(c),start:Math.max(0,c.start+left),sourceIn:sourceTime(c,left),duration:c.duration+right-left,curveOffset:num(c.curveOffset)+left,animationOffset:Math.max(0,(c.animationOffset||0)+left)};
    if(c.keyframes?.length){
      result.keyframes=[{time:0,...transform(c,left)},...c.keyframes.filter(k=>k.time>left&&k.time<c.duration+right).map(k=>({...k,time:k.time-left})),{time:result.duration,...transform(c,c.duration+right)}];
    }
    return result;
  }
  function packRows(list) {
    const ends=[], result=new Map();
    list.slice().sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id)).forEach(c=>{
      let row=ends.findIndex(end=>end<=c.start+.00001);
      if(row<0)row=ends.length;
      ends[row]=c.start+c.duration;result.set(c.id,row);
    });
    return {rows:Math.max(1,ends.length),positions:result};
  }
  function snapPosition(start,duration,edges,threshold) {
    let result={start:Math.max(0,start),edge:null,distance:threshold};
    for(const edge of edges)for(const delta of [0,duration]){
      const distance=Math.abs(start+delta-edge),target=edge-delta;
      if(target>=0&&distance<result.distance)result={start:target,edge,distance};
    }
    return result;
  }
  function formatTime(value) {
    const ticks=Math.max(0,Math.round(num(value)*10));
    return String(Math.floor(ticks/600)).padStart(2,'0')+':'+String(Math.floor(ticks/10)%60).padStart(2,'0')+'.'+ticks%10;
  }
  function transform(c, time) {
    const keys = ['xOffset', 'yOffset', 'scale', 'rotation', 'opacity'];
    const result = Object.fromEntries(keys.map(k => [k, num(c[k], k === 'scale' || k === 'opacity' ? 1 : 0)]));
    const frames = (c.keyframes || []).slice().sort((a, b) => a.time - b.time);
    if (!frames.length) return result;
    const a = frames.filter(k => k.time <= time).pop() || { time: 0, ...result };
    const b = frames.find(k => k.time > time) || a;
    const fraction = a === b ? 0 : clamp((time - a.time) / (b.time - a.time), 0, 1);
    keys.forEach(k => { result[k] = num(a[k], result[k]) + (num(b[k], result[k]) - num(a[k], result[k])) * fraction; });
    return result;
  }
  function parseSRT(text) {
    const stamp = s => s.split(':').reduce((n, v) => n * 60 + Number(v.replace(',', '.')), 0);
    const result = [];
    for (const block of text.replace(/\r/g, '').trim().split(/\n\s*\n/)) {
      const lines = block.split('\n');
      const index = lines.findIndex(s => s.includes('-->'));
      if (index < 0) continue;
      const match = lines[index].match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
      if (!match) continue;
      const start = stamp(match[1]), duration = stamp(match[2]) - start;
      if (duration <= 0) continue;
      result.push(normalize({track:'text', title:lines.slice(index + 1).join('\n').replace(/<[^>]*>/g,''), start, duration, yOffset:260, fontSize:30, textStyle:'subtitle'}));
    }
    return result;
  }
  function srt(clips) {
    const stamp = t => { const ms = Math.round(t * 1000); return String(Math.floor(ms / 3600000)).padStart(2,'0')+':'+String(Math.floor(ms/60000)%60).padStart(2,'0')+':'+String(Math.floor(ms/1000)%60).padStart(2,'0')+','+String(ms%1000).padStart(3,'0'); };
    return clips.filter(c=>c.track==='text').sort((a,b)=>a.start-b.start).map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.start+c.duration)}\n${c.title}\n`).join('\n');
  }
  function audioEnvelope(channels,bins=2048){
    const length=Math.max(0,...channels.map(c=>c.length));if(!length)return [];
    bins=Math.min(length,Math.max(1,Math.floor(bins)));const result=[];
    for(let b=0;b<bins;b++){const from=Math.floor(b*length/bins),to=Math.floor((b+1)*length/bins);let peak=0,square=0,count=0;
      for(const channel of channels)for(let i=from;i<Math.min(to,channel.length);i++){const sample=num(channel[i]);peak=Math.max(peak,Math.abs(sample));square+=sample*sample;count++;}
      result.push(.45*peak+.55*Math.sqrt(square/Math.max(1,count)));
    }
    const max=Math.max(...result,0);return max?result.map(v=>v/max*.95):result;
  }
  function waveformForClip(c,peaks,sourceDuration,count=200){
    if(!peaks?.length||!(sourceDuration>0))return [];
    count=clamp(Math.floor(count),2,1200);const result=[];
    for(let i=0;i<count;i++){
      const local=(i+.5)/count*c.duration,from=sourceTime(c,i/count*c.duration),to=sourceTime(c,(i+1)/count*c.duration);
      const start=Math.floor(from/sourceDuration*peaks.length),end=Math.max(start+1,Math.ceil(to/sourceDuration*peaks.length));let peak=0;
      for(let j=Math.max(0,start);j<Math.min(peaks.length,end);j++)peak=Math.max(peak,num(peaks[j]));
      const fade=Math.max(0,Math.min(1,c.fadeIn?local/c.fadeIn:1,c.fadeOut?(c.duration-local)/c.fadeOut:1));
      result.push(clamp(peak*fade*(c.volume??1),0,1));
    }
    return result;
  }
  const api = {clamp, num, uid, copy, normalize, split, trim, resize, speed, transform, packRows, snapPosition, formatTime, parseSRT, srt, CURVES, curvePoints, curveIntegral, rateAt, sourceOffset, sourceTime, setCurve, audioEnvelope, waveformForClip};
  if (typeof module !== 'undefined') module.exports = api;
  else root.ClipCore = api;
})(typeof window === 'undefined' ? globalThis : window);
