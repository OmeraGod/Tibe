// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer Abdullah and Concat contributors
// Adapted to JavaScript / sampled SDR LUTs for tibe, 2026.
// Upstream: Concat 797c8c707be5f2c798bb99e0fffad20612552510.
// Original shaders and licence are in third_party/concat; no spatial shader is approximated here.
(function(root){
  'use strict';
  const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n)),mix=(a,b,t)=>a+(b-a)*t;
  const luma=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
  const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a));return t*t*(3-2*t);};
  const saturation=(c,a)=>{const y=luma(c);return c.map(x=>mix(y,x,a));};
  const contrast=(c,a)=>c.map(x=>(x-.5)*a+.5);
  const sCurve=(c,a)=>c.map(x=>{const v=clamp(x);return mix(v,v*v*(3-2*v),a)+x-v;});
  const fade=(c,a)=>c.map(x=>x*(1-a)+a);
  const tone=(c,t,a)=>{const w=(1-Math.min(Math.abs(luma(c)-.5)*2,1))*a;return c.map((x,i)=>x+t[i]*w);};
  const split=(c,s,h,a)=>{const y=luma(c),sw=1-smooth(0,.6,y),hw=smooth(.4,1,y);return c.map((x,i)=>x+(s[i]*sw+h[i]*hw)*a);};
  const film=(c,toe,shoulder)=>c.map(x=>{const v=clamp(x),t=mix(v,v*v,toe*(1-v));return mix(t,1-(1-t)*(1-t),shoulder*t)+x-v;});
  function kelvin(k){const t=clamp(k,1000,40000)/100;return t<=66?[1,clamp((99.4708*Math.log(t)-161.1196)/255),t<=19?0:clamp((138.5177*Math.log(t-10)-305.0448)/255)]:[clamp(329.6987*Math.pow(t-60,-.1332)/255),clamp(288.1222*Math.pow(t-60,-.0755)/255),1];}
  const daylight=kelvin(6500);
  function balance(c,k){const t=kelvin(k).map((x,i)=>x/daylight[i]),y=Math.max(luma(t),.001);return c.map((x,i)=>x*t[i]/y);}
  const zero=[0,0,0];
  const presets=[
    ['autumn','Autumn',c=>saturation(split(c,zero,[.1,.04,-.08],1),1.1)],
    ['bleach-bypass','Bleach Bypass',c=>contrast(film(saturation(c,.35),.15,.25),1.25)],
    ['bronze','Bronze',c=>sCurve(split(tone(saturation(c,1-.8*.9),[.12,.04,-.12],.8),zero,[.04,.01,-.04],.8),.3*.6)],
    ['classic-chrome','Classic Chrome',c=>saturation(film(c,.1,.35),.9)],
    ['contrast-pop','Contrast Pop',c=>film(contrast(c,1+.25*.7),.25*.5,.25*.5)],
    ['cool','Cool',c=>balance(c,8500)],
    ['cyberpunk','Cyberpunk',c=>contrast(saturation(split(c,[.08,-.02,.12],[-.05,.08,.1],1),1.15),1.15)],
    ['delicious','Delicious',c=>sCurve(saturation(balance(c,5200),1.3),.25)],
    ['retro-70s','Retro 70s',c=>saturation(tone(fade(c,.1),[.1,.06,-.12],1),.85)],
    ['rosy','Rosy',c=>saturation(split(c,zero,[.08,.02,.03],1),1.08)],
    ['sci-fi','Sci-Fi',c=>saturation(split(balance(c,8200),[-.02,.03,.06],[0,.02,.03],1),.85)],
    ['silver','Silver',c=>{const g=c[0]*.3+c[1]*.33+c[2]*.37;return tone(fade([g,g,g],.05),[-.02,0,.03],1);}],
    ['tropical','Tropical',c=>contrast(saturation(split(c,zero,[-.06,.05,.08],1),1.35),1.1)],
    ['vaporwave','Vaporwave',c=>saturation(split(c,[.1,0,.15],[0,.08,.12],1),1.3)],
    ['warm','Warm',c=>balance(c,4600)],
    ['winter-cool','Winter Cool',c=>saturation(fade(balance(c,8800),.06),.8)]
  ].map(([id,name,transform])=>({id:'lut:concat-'+id,name:'Concat · '+name,transform}));
  function bake(preset,size=33){const values=[];for(let b=0;b<size;b++)for(let g=0;g<size;g++)for(let r=0;r<size;r++)values.push(...preset.transform([r/(size-1),g/(size-1),b/(size-1)]));return {title:preset.name,size,domainMin:[0,0,0],domainMax:[1,1,1],values,builtin:'concat',source:'Concat 797c8c7 · WGSL → SDR LUT'};}
  function install(looks){looks.registerLuts(Object.fromEntries(presets.map(p=>[p.id,bake(p)])));for(const p of presets){const f=looks.filters.find(f=>f.id===p.id);if(f)f.category='concat';}}
  const api={presets,bake,install};if(typeof module!=='undefined')module.exports=api;else{root.TibeConcatLooks=api;install(root.TibeLooks);}
})(typeof window!=='undefined'?window:globalThis);
