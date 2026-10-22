// Actual REA read-only inventory of the shader files adapted by tibe.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {inventoryArtifact} from '../node_modules/rea-agents/dist/artifacts/inventory/ArtifactInventory.js';
import {ArtifactResourceScope} from '../node_modules/rea-agents/dist/artifacts/ArtifactResourceScope.js';
const base=path.resolve(process.argv[2]),cache=path.resolve(process.argv[3]);
const report=JSON.parse(await readFile(path.join(base,'workspace/rea/capcut-compatible-algorithms.json'),'utf8'));
const scope=new ArtifactResourceScope();
try{
  const evidence=[];
  for(const item of report.algorithms){const source=path.resolve(cache,item.source);if(!source.startsWith(cache+path.sep))throw Error('Outside cache');const inventory=await inventoryArtifact(source,{resourceScope:scope,environment:process.env,integrity:{mode:'fail'}});evidence.push({algorithm:item.algorithm,sha256:item.sha256,relativePath:item.source,inventory});}
  await writeFile(path.join(base,'workspace/rea/capcut-native-effects.evidence.json'),JSON.stringify({reaVersion:'6.7.0',readOnly:true,evidence},null,2));
  console.log(JSON.stringify({ok:true,algorithms:evidence.length,provider:'rea-agents/artifacts'}));
}finally{await scope.close();}
