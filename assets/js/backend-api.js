/* Shared local transport: Flask app and JetBrains HTML preview use one runtime. */
(function(root){
  'use strict';let pending=null;
  const version='3.6.0',preview=['localhost','127.0.0.1'].includes(location.hostname)&&['63342','63343'].includes(location.port);
  const origin=preview?'http://127.0.0.1:5050':'',nativeFetch=root.fetch.bind(root);
  const url=path=>typeof path==='string'&&path.startsWith('/workspace/')?origin+path:path;
  async function ensure(){
    const ready=typeof backend!=='undefined'?backend:root.TibeBackendState;
    if(ready?.version===version)return ready;
    if(pending)return pending;
    pending=(async()=>{
      if(location.protocol==='file:')throw Error('Mở MỞ TIBE.bat để dùng tạo giọng và xuất MP4.');
      let response;try{response=await nativeFetch(origin+'/api/status',{signal:AbortSignal.timeout(6000),credentials:'omit'});}catch{throw Error('Chưa mở bộ xử lý tibe. Nhấp đúp MỞ TIBE.bat rồi bấm Thử lại.');}
      if(!response.ok)throw Error('Trang đang ở chế độ xem HTML. Mở MỞ TIBE.bat để chạy đầy đủ.');
      const data=await response.json();if(data.version!==version)throw Error('Mở lại MỞ TIBE.bat để nạp bản tibe mới.');if(typeof backend!=='undefined')backend=data;root.TibeBackendState=data;return data;
    })();try{return await pending;}finally{pending=null;}
  }
  async function request(path,options={}){
    if(typeof path==='string'&&path.startsWith('/api/')){
      await ensure();const headers=new Headers(options.headers||{});if(origin)headers.set('X-Tibe-Client','studio');
      return nativeFetch(origin+path,{...options,headers,credentials:'omit'});
    }
    return nativeFetch(url(path),options);
  }
  root.TibeBackend={ensure,request,url,appUrl:'http://127.0.0.1:5050/',preview};
})(window);
