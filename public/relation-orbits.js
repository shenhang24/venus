// Compact display geometry derived from recorded relations, not force simulation.
const norm=p=>Math.hypot(...p);
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
export function rotateOrbit3D(vector,angle,phase=0){
 const c=Math.cos(angle),s=Math.sin(angle),a=[vector[0]*c+vector[2]*s,vector[1],-vector[0]*s+vector[2]*c];
 const tilt=.55*Math.sin(angle*.71+phase),ct=Math.cos(tilt),st=Math.sin(tilt),b=[a[0],a[1]*ct-a[2]*st,a[1]*st+a[2]*ct];
 const roll=.4*Math.sin(angle*.43+phase*.7),cr=Math.cos(roll),sr=Math.sin(roll);
 return [b[0]*cr-b[1]*sr,b[0]*sr+b[1]*cr,b[2]];
}
// Cache distinct direct relations and bounded two-hop evidence once per sync.
export function relationAffinities(edges){
 const pairs=new Map(),seen=new Set(),neighbours=new Map();
 const add=(from,to,weight,indirect=false)=>{if(from===to||!weight)return;const key=[from,to].sort().join('|'),old=pairs.get(key);pairs.set(key,{from:from<to?from:to,to:from<to?to:from,weight:1-(1-(old?.weight||0))*(1-weight),indirect:indirect&&!old||!!old?.indirect&&indirect});};
 for(const e of edges){if(e.semanticAnchor&&!e.membershipLink)continue;const endpoints=['step','procedure'].includes(e.type)?[e.from,e.to]:[e.from,e.to].sort(),key=JSON.stringify([...endpoints,e.type]);if(seen.has(key)||!(Number(e.strength)>0))continue;seen.add(key);const w=Math.min(.85,Math.max(0,Number(e.strength)||0)*.65+.2);add(e.from,e.to,w);}
 for(const e of pairs.values())for(const [a,b]of [[e.from,e.to],[e.to,e.from]]){if(!neighbours.has(a))neighbours.set(a,[]);neighbours.get(a).push([b,e.weight]);}
 for(const list of neighbours.values()){const bounded=list.sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,16);for(let i=0;i<bounded.length;i++)for(let j=i+1;j<bounded.length;j++)add(bounded[i][0],bounded[j][0],Math.min(bounded[i][1],bounded[j][1])*.12,true);}
 return [...pairs.values()];
}
export function packRelationSpheres(items,links=[],rootRadius=0,gap=.02,breathing=.22){
 if(!Number.isFinite(rootRadius)||items.some(x=>!Number.isFinite(x.extent)))throw Error('Non-finite display envelope');
 const ordered=[...items].sort((a,b)=>b.extent-a.extent||a.id.localeCompare(b.id)),indices=new Map(ordered.map((v,i)=>[v.id,i]));
 const positions=ordered.map((item,i)=>{const y=1-2*(i+.5)/Math.max(1,ordered.length),a=i*2.399963229728653,r=Math.sqrt(1-y*y),radius=(rootRadius+item.extent+gap)/.978+item.extent*1.65*Math.cbrt(i);return [Math.cos(a)*r*radius,y*radius,Math.sin(a)*r*radius];});
 const graph=links.flatMap(e=>indices.has(e.from)&&indices.has(e.to)&&e.from!==e.to?[{i:indices.get(e.from),j:indices.get(e.to),weight:Math.max(0,Math.min(1,e.weight??e.strength??0))}]:[]);
 const rootMinimum=i=>(rootRadius+ordered[i].extent+gap)/.978;
 const radial=positions.map(norm);
 const minimum=(i,j)=>(ordered[i].extent+ordered[j].extent)*(1+breathing)+gap+.021*(radial[i]+radial[j]);
 const keepRoot=i=>{const p=positions[i],r=norm(p),min=rootMinimum(i);if(r<min)for(let k=0;k<3;k++)p[k]*=min/(r||1);radial[i]=Math.max(r,min);};
 const separate=()=>{
  const sorted=positions.map((p,i)=>({i,x:p[0]})).sort((a,b)=>a.x-b.x),maxExtent=Math.max(0,...ordered.map(x=>x.extent)),maxRadius=Math.max(0,...positions.map(norm));
  let overlaps=0;
  for(let a=0;a<sorted.length;a++)for(let b=a+1;b<sorted.length;b++){
   const i=sorted[a].i,j=sorted[b].i,p=positions[i],q=positions[j];
   if(q[0]-p[0]>ordered[i].extent+maxExtent+gap+.042*maxRadius)break;
   const min=minimum(i,j);if(Math.abs(p[1]-q[1])>=min||Math.abs(p[2]-q[2])>=min)continue;const d=distance(p,q);if(d>=min-1e-9)continue;overlaps++;
   const direction=d>1e-10?q.map((x,k)=>(x-p[k])/d):[1,0,0],wi=1/Math.max(.01,ordered[i].extent),wj=1/Math.max(.01,ordered[j].extent),amount=min-d+1e-6;
   for(let k=0;k<3;k++){p[k]-=direction[k]*amount*wi/(wi+wj);q[k]+=direction[k]*amount*wj/(wi+wj);}keepRoot(i);keepRoot(j);
  }
  return overlaps;
 };
 for(let pass=0;pass<(items.length>500?24:48);pass++){
  const delta=positions.map(()=>[0,0,0]),weights=positions.map(()=>0);
  for(const {i,j,weight}of graph){if(!weight)continue;const p=positions[i],q=positions[j],d=distance(p,q)||1,min=minimum(i,j),pull=Math.max(0,d-min*(1+.5*(1-weight)))*(.025+.12*weight);for(let k=0;k<3;k++){const v=(q[k]-p[k])/d*pull;delta[i][k]+=v;delta[j][k]-=v;}weights[i]+=weight;weights[j]+=weight;}
  for(let i=0;i<positions.length;i++){
   const p=positions[i],r=norm(p)||1,home=rootMinimum(i)+ordered[i].extent*.65*Math.cbrt(items.length),radial=Math.max(0,r-home)*.025;
   const move=delta[i].map((x,k)=>x/Math.max(1,weights[i])-p[k]/r*radial),speed=norm(move),limit=Math.max(.03,ordered[i].extent*.25);
   for(let k=0;k<3;k++)p[k]+=move[k]*Math.min(1,limit/(speed||1));keepRoot(i);
  }
  separate();separate();
 }
 for(let pass=0;pass<12;pass++)if(!separate())break;
 // Final outward projection guarantees the reserved swept spheres do not overlap,
 // even if iterative relaxation has not converged. It changes no stored graph.
 const placed=[];
 for(let i=0;i<positions.length;i++){
  keepRoot(i);const p=positions[i],r=norm(p)||1,dir=p.map(v=>v/r),intervals=[],coefficient=1-.021**2;
  // Solve each swept-sphere collision interval along the ray analytically.
  // This avoids repeated all-pair scans during binary search in large groups.
  for(const j of placed){const q=positions[j],a=(ordered[i].extent+ordered[j].extent)*(1+breathing)+gap+.021*radial[j],dot=dir[0]*q[0]+dir[1]*q[1]+dir[2]*q[2],middle=dot+.021*a,constant=radial[j]**2-a*a,discriminant=middle*middle-coefficient*constant;if(discriminant<=0)continue;const d=Math.sqrt(discriminant),low=(middle-d)/coefficient,high=(middle+d)/coefficient;if(high>=r)intervals.push([low,high]);}
  intervals.sort((a,b)=>a[0]-b[0]);let radius=r;for(const [low,high]of intervals){if(low>radius)break;if(high>=radius)radius=high+1e-6;}
  positions[i]=dir.map(v=>v*radius);radial[i]=radius;placed.push(i);
 }
 return new Map(ordered.map((item,i)=>[item.id,positions[i]]));
}
function projectedLinks(layout,edges,branch){
 const pairs=new Map();
 for(const edge of edges){if(edge.semanticAnchor||edge.membershipLink)continue;const from=branch(edge.from),to=branch(edge.to);if(!from||!to||from===to)continue;const key=[from,to].sort().join('|'),weight=Math.max(0,Math.min(1,Number(edge.weight??edge.strength)||0)),old=pairs.get(key);pairs.set(key,{from,to,weight:1-(1-(old?.weight||0))*(1-weight)});}
 return [...pairs.values()];
}
export function configureLocalRelationOrbits(layout,members,edges){
 for(const n of [...layout.orbitOrder].reverse()){
  const host=layout.nodeIndices.get(n.id),children=(members.get(host)||[]).filter(id=>layout.orbits[id]&&!['star','planet'].includes(layout.orbits[id].kind));if(!children.length)continue;
  const childSet=new Set(children),branch=id=>{const seen=new Set();while(id&&!seen.has(id)){if(childSet.has(id))return id;seen.add(id);id=layout.orbits[id]?.host;}return null;};
  const items=children.map(id=>({id,extent:layout.systemExtents[layout.nodeIndices.get(id)]}));
  const packed=packRelationSpheres(items,projectedLinks(layout,edges,branch),layout.collisionRadii[host],.02,.22);
  for(const id of children){const o=layout.orbits[id],vector=packed.get(id),i=layout.nodeIndices.get(id),radius=norm(vector);o.offset3D=vector;o.motionPhase=0;o.radius=o.targetRadius=radius;o.uncompressedShellRadius=radius;layout.systemExtents[host]=Math.max(layout.systemExtents[host],radius*1.02+layout.systemExtents[i]);layout.subtreeMaxRadius[host]=Math.max(layout.subtreeMaxRadius[host],layout.subtreeMaxRadius[i]);}
 }
}
export function configureGroupRelationOrbits(layout,edges,centralExtent){
 const planets=layout.nodes.filter(n=>layout.orbits[n.id]?.kind==='planet'),free=layout.nodes.filter(n=>!layout.starIds.has(n.id)&&!layout.orbits[n.id]),items=[...planets,...free].map(n=>({id:n.id,extent:layout.systemExtents[layout.nodeIndices.get(n.id)]})),roots=new Set(items.map(n=>n.id));
 const branch=id=>{const seen=new Set();while(id&&!seen.has(id)){if(roots.has(id))return id;seen.add(id);id=layout.orbits[id]?.host;}return null;};
 const pairs=projectedLinks(layout,edges,branch),sharedPairs=new Map();
 for(const group of layout.sharedOrbits){const hosts=group.hosts.map(i=>branch(layout.nodes[i].id)).filter(Boolean);for(let a=0;a<hosts.length;a++)for(let b=a+1;b<hosts.length;b++){const key=[hosts[a],hosts[b]].sort().join('|');if(hosts[a]!==hosts[b])sharedPairs.set(key,{from:hosts[a],to:hosts[b],weight:1});}}
 const packed=packRelationSpheres(items,[...pairs,...sharedPairs.values()],centralExtent+2*layout.centralOrbitRadius,.02,.3);
 layout.freeOrbits=new Map();let bound=centralExtent;
 for(const item of items){const vector=packed.get(item.id),radius=norm(vector),o=layout.orbits[item.id];if(o){o.offset3D=vector;o.motionPhase=0;o.radius=o.targetRadius=radius;o.satelliteEnvelope=item.extent;o.satelliteLimit=radius;}else layout.freeOrbits.set(item.id,{radius,offset3D:vector,phase:0,frame:layout.centralOrbitFrame});bound=Math.max(bound,radius+item.extent+2*layout.centralOrbitRadius);}
 layout.tourWorldBound=Math.max(100,bound*2);
}
