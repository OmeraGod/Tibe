/* Direct GLSL ES rendering of the pinned GL Transitions collection. */
(function(root){
 'use strict';const catalog=typeof module!=='undefined'?require('./gl-transition-catalog.js'):root.TIBE_GL_CATALOG;
 let canvas=null,gl=null,quad=null,textures=[],disabled=false,lastError='';const programs=new Map(),warned=new Set();
 const vertexSource='#version 300 es\nin vec2 a_position;out vec2 v_uv;void main(){v_uv=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}';
 function fragmentSource(source){return '#version 300 es\nprecision highp float;precision highp int;\nin vec2 v_uv;out vec4 tibe_color;uniform sampler2D tibe_from;uniform sampler2D tibe_to;uniform float progress;uniform float ratio;\nvec4 getFromColor(vec2 uv){return texture(tibe_from,uv);}vec4 getToColor(vec2 uv){return texture(tibe_to,uv);}\n'+source.replace(/\btexture2D\b/g,'texture')+'\nvoid main(){tibe_color=transition(v_uv);}';}
 function available(){
  if(disabled)return false;if(gl)return true;
  try{canvas=root.document.createElement('canvas');gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true,antialias:false,depth:false,stencil:false});if(!gl){disabled=true;return false;}
   quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
   textures=[0,1].map(()=>{const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);return texture;});
   canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();gl=null;programs.clear();});return true;
  }catch(error){lastError=error.message;disabled=true;return false;}
 }
 function shader(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error(message);}return shader;}
 function program(entry){
  if(programs.has(entry.name)){const cached=programs.get(entry.name);programs.delete(entry.name);programs.set(entry.name,cached);return cached;}
  const vs=shader(gl.VERTEX_SHADER,vertexSource),fs=shader(gl.FRAGMENT_SHADER,fragmentSource(entry.glsl)),p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(p,gl.LINK_STATUS)){const message=gl.getProgramInfoLog(p);gl.deleteProgram(p);throw Error(message);}
  const result={p,position:gl.getAttribLocation(p,'a_position'),uniforms:new Map()};for(const name of ['tibe_from','tibe_to','progress','ratio',...Object.keys(entry.paramsTypes)])result.uniforms.set(name,gl.getUniformLocation(p,name));
  programs.set(entry.name,result);if(programs.size>24){const first=programs.keys().next().value;gl.deleteProgram(programs.get(first).p);programs.delete(first);}return result;
 }
 function draw(ctx,from,to,{id,progress,width,height}){
  const entry=catalog.find(e=>'gl:'+e.name===id);if(!entry||!available())return false;
  try{const density=Math.max(.25,Math.hypot(ctx.getTransform().a,ctx.getTransform().b)),w=Math.max(2,Math.round(width*density)),h=Math.max(2,Math.round(height*density));if(w>gl.getParameter(gl.MAX_TEXTURE_SIZE)||h>gl.getParameter(gl.MAX_TEXTURE_SIZE))throw Error('Khung hình vượt giới hạn GPU.');
   if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;gl.viewport(0,0,w,h);const {p,position,uniforms}=program(entry);gl.useProgram(p);gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
   for(const [i,source] of [from,to].entries()){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[i]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.uniform1i(uniforms.get(i?'tibe_to':'tibe_from'),i);}
   gl.uniform1f(uniforms.get('progress'),Math.min(1,Math.max(0,progress)));gl.uniform1f(uniforms.get('ratio'),width/height);
   for(const [name,type] of Object.entries(entry.paramsTypes)){const location=uniforms.get(name);if(location===null)continue;const value=entry.defaultParams[name];if(type==='float')gl.uniform1f(location,value);else if(type==='int'||type==='bool')gl.uniform1i(location,Number(value));else if(/^ivec[234]$/.test(type))gl['uniform'+type.at(-1)+'iv'](location,value);else if(/^vec[234]$/.test(type))gl['uniform'+type.at(-1)+'fv'](location,value);}
   gl.drawArrays(gl.TRIANGLE_STRIP,0,4);ctx.drawImage(canvas,0,0,width,height);return true;
  }catch(error){lastError=error.message;if(!warned.has(entry.name)){warned.add(entry.name);root.toast?.('GPU chưa chạy được chuyển cảnh '+entry.name+'. Đang dùng hòa tan.');}return false;}
 }
 function register(looks){if(!available())return;for(const e of catalog){const id='gl:'+e.name;if(!looks.transitions.some(t=>t.id===id))looks.transitions.push({id,name:e.name.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' '),category:'gl',author:e.author,license:e.license});}}
 const api={catalog,fragmentSource,vertexSource,available,draw,register,get lastError(){return lastError;}};if(typeof module!=='undefined')module.exports=api;else{root.TibeGLTransitions=api;register(root.TibeLooks);}
})(typeof window!=='undefined'?window:globalThis);
