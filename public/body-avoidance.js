const magnitude=v=>Math.hypot(...v);
// Local display constraints only. No masses are integrated and no orbit is reassigned.
export function resolveBodyAvoidance(layout){
  const nodes=layout.nodes,positions=layout.positions,radii=layout.collisionRadii;
  layout.bodyAvoidance||=new Map();
  const passThrough=layout.transferPassThroughIds||new Set();
  const nominal=new Map(nodes.map(n=>[n.id,[...positions[n.id]]])),previous=layout.bodyAvoidancePrevious;
  const inherited=new Map();
  for(const n of layout.orbitOrder){
    const host=layout.orbits[n.id]?.host,parent=inherited.get(host)||[0,0,0],offset=layout.bodyAvoidance.get(n.id)||[0,0,0];
    const shift=n.isMainTag||passThrough.has(n.id)?[0,0,0]:offset.map((x,k)=>x*.96+parent[k]);inherited.set(n.id,shift);
    positions[n.id]=nominal.get(n.id).map((x,k)=>x+shift[k]);
  }
  const movable=i=>!nodes[i].isMainTag;
  const pairMinimum=(i,j)=>layout.orbits[nodes[i].id]?.host===nodes[j].id?layout.orbitalClearance(i,j):layout.orbits[nodes[j].id]?.host===nodes[i].id?layout.orbitalClearance(j,i):layout.bodyMinimum(i,j);
  let corrections=0,converged=false,blockedMainPairs=0;
  // A sweep index avoids all-pairs work in the ordinary sparse case. It does
  // not reorder identities, orbit slots, planes or classification membership.
  const maximum=Math.max(...radii),maxMotion=previous?Math.max(0,...nodes.map(n=>!passThrough.has(n.id)&&previous.has(n.id)?magnitude(positions[n.id].map((x,k)=>x-previous.get(n.id)[k])):0)):0,reach=6*maximum+.04+2*maxMotion;
  for(let pass=0;pass<64;pass++){
    const order=nodes.map((_,i)=>i).sort((i,j)=>positions[nodes[i].id][0]-positions[nodes[j].id][0]);let changed=false;blockedMainPairs=0;
    for(let a=0;a<order.length;a++)for(let b=a+1;b<order.length;b++){
      const i=order[a],j=order[b],p=positions[nodes[i].id],q=positions[nodes[j].id];if(q[0]-p[0]>reach)break;
      // A transit body neither yields nor pushes a resident out of its path.
      if(passThrough.has(nodes[i].id)||passThrough.has(nodes[j].id))continue;
      const minimum=pairMinimum(i,j),delta=q.map((x,k)=>x-p[k]),distance=magnitude(delta);
      if(!movable(i)&&!movable(j)){if(distance<minimum-1e-7)blockedMainPairs++;continue;}
      // Keep large main bodies on their fixed orbit; satellites yield locally.
      const wi=movable(i)?1:0,wj=movable(j)?1:0,total=wi+wj;
      if(distance<minimum-1e-7){
        const direction=distance>1e-9?delta.map(x=>x/distance):[0,1,0],amount=minimum-distance+1e-6;
        for(let k=0;k<3;k++){p[k]-=direction[k]*amount*wi/total;q[k]+=direction[k]*amount*wj/total;}
        corrections++;changed=true;
      }
      const p0=previous?.get(nodes[i].id),q0=previous?.get(nodes[j].id),physical=radii[i]+radii[j]+.005;
      if(p0&&q0){
        const initial=q0.map((x,k)=>x-p0[k]),end=q.map((x,k)=>x-p[k]),motion=end.map((x,k)=>x-initial[k]),square=motion.reduce((s,x)=>s+x*x,0);
        const t=square?Math.max(0,Math.min(1,-initial.reduce((s,x,k)=>s+x*motion[k],0)/square)):1;
        const closest=initial.map((x,k)=>x+t*motion[k]),separation=magnitude(closest);
        if(t>1e-5&&separation<physical-1e-7&&magnitude(initial)>=physical-1e-7){
          const direction=separation>1e-9?closest.map(x=>x/separation):[0,1,0],amount=(physical-separation+1e-6)/t;
          for(let k=0;k<3;k++){p[k]-=direction[k]*amount*wi/total;q[k]+=direction[k]*amount*wj/total;}
          corrections++;changed=true;
        }
      }
    }
    if(!changed){converged=blockedMainPairs===0;break;}
  }
  const displaced=new Map(nodes.map(n=>[n.id,positions[n.id].map((x,k)=>x-nominal.get(n.id)[k])]));
  for(const n of nodes){
    const parent=displaced.get(layout.orbits[n.id]?.host)||[0,0,0];
    layout.bodyAvoidance.set(n.id,n.isMainTag||passThrough.has(n.id)?[0,0,0]:displaced.get(n.id).map((x,k)=>x-parent[k]));
    if(previous?.has(n.id))layout.velocities[n.id]=positions[n.id].map((x,k)=>x-previous.get(n.id)[k]);
  }
  // Resident tours resume from the position actually rendered after avoidance.
  for(const group of layout.sharedOrbits||[]){
    const tour=group.tour;if(!tour?.world||passThrough.has(group.id))continue;
    tour.world=[...positions[group.id]];tour.lastRenderedWorld=[...positions[group.id]];tour.worldVelocity=[...(layout.velocities[group.id]||[0,0,0])];
  }
  layout.bodyAvoidancePrevious=new Map(nodes.map(n=>[n.id,[...positions[n.id]]]));
  layout.bodyAvoidanceStats={corrections,converged,blockedMainPairs};
}
