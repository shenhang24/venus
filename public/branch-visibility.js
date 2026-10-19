// Visibility follows saved membership and the layout's content hierarchy, never zoom.
export function branchVisibility(nodes,edges,orbits={},selection=null,allowed=null){
  const byId=new Map(nodes.map(n=>[n.id,n])),children=new Map(),parents=new Map(),members=new Map();
  const add=(map,key,value)=>{if(!map.has(key))map.set(key,new Set());map.get(key).add(value);};
  for(const e of edges)if(e.membershipLink&&byId.get(e.from)?.isMainTag&&byId.has(e.to))add(members,e.from,e.to);
  for(const n of nodes){const host=orbits[n.id]?.host;if(!n.isMainTag&&host&&byId.has(host)&&!byId.get(host).isMainTag){add(children,host,n.id);add(parents,n.id,host);}}
  const descend=(id,result)=>{const todo=[id];while(todo.length){const next=todo.pop();if(result.has(next))continue;result.add(next);for(const child of children.get(next)||[])todo.push(child);}return result;};
  const collections=new Map(),owned=new Set();
  for(const n of nodes)if(n.isMainTag){const contained=new Set();for(const id of members.get(n.id)||[])descend(id,contained);collections.set(n.id,contained);for(const id of contained)owned.add(id);}
  for(const n of nodes)if(!n.isMainTag&&!owned.has(n.id)&&!parents.has(n.id)&&children.has(n.id)){const contained=descend(n.id,new Set());contained.delete(n.id);collections.set(n.id,contained);for(const id of contained)owned.add(id);}
  const visibleIds=new Set(nodes.filter(n=>n.isMainTag||!owned.has(n.id)&&!parents.has(n.id)).map(n=>n.id)),expanded=new Set();
  if(byId.has(selection)){
    expanded.add(selection);visibleIds.add(selection);
    if(collections.has(selection))for(const id of collections.get(selection))visibleIds.add(id);
    else descend(selection,new Set()).forEach(id=>visibleIds.add(id));
    const todo=[selection],seen=new Set();while(todo.length){const id=todo.pop();if(seen.has(id))continue;seen.add(id);for(const parent of parents.get(id)||[]){visibleIds.add(parent);expanded.add(parent);todo.push(parent);}}
    for(const [root,contained]of collections)if(contained.has(selection))expanded.add(root);
  }
  if(allowed)for(const id of visibleIds)if(!allowed.has(id)&&!byId.get(id)?.isMainTag&&id!==selection)visibleIds.delete(id);
  // A visible body needs its physical ancestors, without activating their siblings.
  for(const id of [...visibleIds]){let host=orbits[id]?.host,seen=new Set();while(host&&byId.has(host)&&!seen.has(host)){seen.add(host);visibleIds.add(host);host=orbits[host]?.host;}}
  const aggregateCounts=new Map();for(const [id,contained]of collections)if(!expanded.has(id))aggregateCounts.set(id,[...contained].filter(child=>!allowed||allowed.has(child)).length);
  return {visibleIds,aggregateCounts,expanded};
}

// Visual volume only. Physics and camera framing continue to use detail radii.
export function aggregateDisplayRadius(baseRadius,uniqueContents){return baseRadius*Math.cbrt(1+Math.max(0,uniqueContents));}

export function radiusTransition(from,to,elapsed,duration=450){const t=Math.min(1,Math.max(0,elapsed/duration)),ease=t*t*(3-2*t);return {radius:from+(to-from)*ease,done:t===1};}
