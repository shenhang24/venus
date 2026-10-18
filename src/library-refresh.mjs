import fs from 'node:fs';
import path from 'node:path';

// Watch only library folders; periodically reconcile missed/coalesced events.
export function createLibraryRefresh(store,{watch=fs.watch,clock=Date.now,reconcileMs=60000}={}){
  const pending=new Set(),watchers=[];
  let full=false,lastFull=clock(),closed=false;
  const mark=(folder,event,name)=>{
    if(!name){full=true;return;}
    const relative=String(name).replaceAll('\\','/');
    if(folder==='.venus'){if(relative==='classifications.md')full=true;return;}
    if(relative.endsWith('.md'))pending.add(folder+'/'+relative);
    else if(event==='rename'&&!relative.endsWith('.tmp'))full=true;
  };
  for(const folder of ['Vault','知识点','技能','概念云','.venus']){
    try{
      const watcher=watch(path.join(store.root,folder),{recursive:folder!=='.venus',persistent:false},(event,name)=>mark(folder,event,name));
      watcher.on('error',()=>{full=true;});watchers.push(watcher);
    }catch{full=true;}
  }
  return {
    poll(){
      if(closed)return;
      const due=clock()-lastFull>=reconcileMs;
      if(!full&&!due&&!pending.size)return;
      const paths=[...pending];pending.clear();const all=full||due;full=false;
      try{store.scan(all?{}:{paths});if(all)lastFull=clock();}
      catch(error){full=true;for(const p of paths)pending.add(p);throw error;}
    },
    close(){closed=true;for(const watcher of watchers)watcher.close();pending.clear();}
  };
}
