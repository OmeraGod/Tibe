// Read-only REA resource inventory. No CapCut process is started or modified.
import {readFile,writeFile,stat,readdir} from 'node:fs/promises';
import path from 'node:path';
import {inventoryArtifact} from '../node_modules/rea-agents/dist/artifacts/inventory/ArtifactInventory.js';
import {ArtifactResourceScope} from '../node_modules/rea-agents/dist/artifacts/ArtifactResourceScope.js';
const target=path.resolve(process.argv[2]),output=path.resolve(process.argv[3]);
const scope=new ArtifactResourceScope();
try{
  const reports=[];
  for(const relative of ['Resources/oobe/effect','Resources/DefaultAdjustBundle/merge_all_adjust_color/AmazingFilter_lut']){
    const selected=path.join(target,relative);if(!await stat(selected).catch(()=>null))continue;
    const inventory=await inventoryArtifact(selected,{resourceScope:scope,environment:process.env,integrity:{mode:'fail'}});
    reports.push({relativePath:relative,operation:'inventory_artifact',provider:'rea-agents/artifacts',inventory});
  }
  const cache=path.resolve(target,'../../User Data/Cache/effect');
  const cacheSummary={packs:0,files:0,cubeFiles:0,enginePackageConfigs:0};
  const cubeFolders=new Set();
  async function discover(directory,depth=0){
    if(depth>14)return;
    for(const entry of await readdir(directory,{withFileTypes:true}).catch(()=>[])){
      if(entry.isSymbolicLink())continue;const child=path.join(directory,entry.name);
      if(entry.isDirectory()){if(depth===0)cacheSummary.packs++;await discover(child,depth+1);}
      else if(entry.isFile()){cacheSummary.files++;if(entry.name==='config.json')cacheSummary.enginePackageConfigs++;if(entry.name.toLowerCase().endsWith('.cube')){cacheSummary.cubeFiles++;cubeFolders.add(directory);}}
    }
  }
  await discover(cache);
  for(const directory of [...cubeFolders].slice(0,24)){
    const inventory=await inventoryArtifact(directory,{resourceScope:scope,environment:process.env,integrity:{mode:'fail'}});
    reports.push({relativePath:'User Data/Cache/effect/'+path.relative(cache,directory),operation:'inventory_artifact',provider:'rea-agents/artifacts',inventory});
  }
  const version=JSON.parse(await readFile(new URL('../node_modules/rea-agents/package.json',import.meta.url),'utf8')).version;
  const report={reaVersion:version,capcutVersion:path.basename(target),readOnly:true,cacheSummary,reports,
    limitations:['Inventory proves local files and digests, not that the CapCut rendering engine was recovered.','Only compatible .cube color LUTs can run directly in tibe; shader/Lua packages require engine-specific work.']};
  await writeFile(output,JSON.stringify(report,null,2),'utf8');
  console.log(JSON.stringify({ok:true,reaVersion:version,resources:reports.length,report:output}));
}finally{await scope.close();}
