/* A requested project is a saved copy, never a mutation of the source brief. */
window.addEventListener('tibe:ready',async()=>{
  const id=new URLSearchParams(location.search).get('project');
  if(!id||!/^[a-f0-9]{32}$/.test(id))return;
  try{const data=await TibeProjects.api('/api/projects/'+id);TibeProjects.replaceProject(data.project);toast('Đã mở phân cảnh Omera · thời lượng theo đề cương, chưa có giọng và phụ đề đồng bộ.');}
  catch(error){toast(error.message);}
},{once:true});
