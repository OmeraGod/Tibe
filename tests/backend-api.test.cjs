const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../assets/js/backend-api.js'),'utf8');
function environment(port='63343',protocol='http:'){
 const calls=[];let healthy=true;const context={window:null,location:{hostname:'localhost',port,protocol},backend:null,AbortSignal,Headers,fetch:async(url,options)=>{calls.push({url,options});return {ok:healthy,json:async()=>({ok:true,version:'3.6.0'})};}};context.window=context;vm.createContext(context);vm.runInContext(source,context);return {context,calls,fail:()=>healthy=false,ready:()=>healthy=true};
}
(async()=>{
 const {context,calls}=environment();await Promise.all([context.TibeBackend.ensure(),context.TibeBackend.ensure()]);assert.equal(calls.length,1);assert.equal(calls[0].url,'http://127.0.0.1:5050/api/status');
 await context.TibeBackend.request('/api/tts/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const sent=calls.at(-1);assert.equal(sent.url,'http://127.0.0.1:5050/api/tts/jobs');assert.equal(sent.options.headers.get('X-Tibe-Client'),'studio');assert.equal(sent.options.credentials,'omit');
 await context.TibeBackend.request('/workspace/tts/voice.wav');assert.equal(calls.at(-1).url,'http://127.0.0.1:5050/workspace/tts/voice.wav');assert.equal(context.TibeBackend.url('/workspace/uploads/photo.png'),'http://127.0.0.1:5050/workspace/uploads/photo.png');assert.equal(context.TibeBackend.url('assets/demo/coast.webp'),'assets/demo/coast.webp');
 const direct=environment('5050');await direct.context.TibeBackend.ensure();assert.equal(direct.calls[0].url,'/api/status');await direct.context.TibeBackend.request('/api/projects');assert.equal(direct.calls.at(-1).options.headers.has('X-Tibe-Client'),false);
 const offline=environment();offline.fail();await assert.rejects(offline.context.TibeBackend.ensure(),/MỞ TIBE/);offline.ready();await offline.context.TibeBackend.ensure();assert.equal(offline.calls.length,2);
 const file=environment('','file:');await assert.rejects(file.context.TibeBackend.ensure(),/MỞ TIBE/);assert.equal(file.calls.length,0);
 console.log('Backend transport: IDE preview uses existing local runtime, API and media resolve correctly, requests deduplicate, direct launch and retry work.');
})().catch(e=>{console.error(e);process.exitCode=1;});
