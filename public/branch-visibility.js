// All networks expose their full nebula. Selection changes focus, never membership visibility.
export function branchVisibility(nodes,edges,orbits={},selection=null,allowed=null){
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const visibleIds=new Set(nodes.filter(n=>!allowed||allowed.has(n.id)||n.isMainTag||n.id===selection).map(n=>n.id));
  // Retain physical ancestors when an explicit filter selects a nested satellite.
  for(const id of [...visibleIds]){
    let host=orbits[id]?.host;const seen=new Set([id]);
    while(host&&byId.has(host)&&!seen.has(host)){
      seen.add(host);visibleIds.add(host);host=orbits[host]?.host;
    }
  }
  return {visibleIds,aggregateCounts:new Map(),expanded:new Set(visibleIds)};
}

// Visual volume only. Physics and camera framing continue to use detail radii.
export function aggregateDisplayRadius(baseRadius,uniqueContents){return baseRadius*Math.cbrt(1+Math.max(0,uniqueContents));}

export function radiusTransition(from,to,elapsed,duration=450){const t=Math.min(1,Math.max(0,elapsed/duration)),ease=t*t*(3-2*t);return {radius:from+(to-from)*ease,done:t===1};}
