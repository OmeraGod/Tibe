/* A requested project is a saved copy, never a mutation of the source brief. */
window.addEventListener('tibe:ready',async()=>{
  const id=new URLSearchParams(location.search).get('project');
  if(!id||!/^[a-f0-9]{32}$/.test(id))return;
  try{toast('Đang mở timeline đã lưu cùng tư liệu…');const data=await TibeProjects.api('/api/projects/'+id);TibeProjects.replaceProject(data.project);const n=data.project.clips.length;toast('Đã mở timeline Omera · '+n+' clip. Giữ các lớp hình, giọng và phụ đề hiện có; kiểm tra bản xuất trước khi đăng.');}
  catch(error){toast(error.message);}
},{once:true});
