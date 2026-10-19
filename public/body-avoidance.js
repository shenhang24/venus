// Local geometric display constraints only. No force integration or orbit changes.
const avoidanceCaches=new WeakMap();
function collisionCache(layout){
  const {nodes,orbits,collisionRadii:radii}=layout,mask=[...(layout.transferPassThroughIds||[])].sort().join('\0');
  let c=avoidanceCaches.get(layout);
  if(c&&c.nodes===nodes&&c.orbits===orbits&&c.radii===radii&&c.mask===mask)return c;
  const count=nodes.length,index=new Map(nodes.map((n,i)=>[n.id,i]));
  c={nodes,orbits,radii,mask,index,parents:nodes.map(n=>index.get(orbits[n.id]?.host)??-1),orbitList:nodes.map(n=>orbits[n.id]),passFlags:nodes.map(n=>layout.transferPassThroughIds?.has(n.id)||false),main:nodes.map(n=>!!n.isMainTag),points:new Array(count),previousPoints:new Array(count),offsets:new Array(count),order:layout.orbitOrder.map(n=>index.get(n.id)),nominal:new Float64Array(count*3),inherited:new Float64Array(count*3),displaced:new Float64Array(count*3),boxes:nodes.map((_,i)=>({i,lo:[0,0,0],hi:[0,0,0],path:[]})),age:64};
  avoidanceCaches.set(layout,c);return c;
}
function buildCollisionTree(items,path=[]){
  const n={lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity],uniformGroup:items[0]?.group??-1};
  for(const b of items)if(b.group!==n.uniformGroup)n.uniformGroup=-1;
  for(const b of items)for(let k=0;k<3;k++){n.lo[k]=Math.min(n.lo[k],b.lo[k]);n.hi[k]=Math.max(n.hi[k],b.hi[k]);}
  if(items.length<=8){n.items=items;for(const b of items)b.path=[...path,n];}
  else{let axis=0;for(let k=1;k<3;k++)if(n.hi[k]-n.lo[k]>n.hi[axis]-n.lo[axis])axis=k;items.sort((a,b)=>(a.lo[axis]+a.hi[axis])-(b.lo[axis]+b.hi[axis]));const middle=items.length>>1;n.left=buildCollisionTree(items.slice(0,middle),[...path,n]);n.right=buildCollisionTree(items.slice(middle),[...path,n]);}
  return n;
}
function refitCollisionTree(n){
  if(!n.items){refitCollisionTree(n.left);refitCollisionTree(n.right);}
  n.lo.fill(Infinity);n.hi.fill(-Infinity);
  const children=n.items||[n.left,n.right];n.uniformGroup=children[0]?.group??children[0]?.uniformGroup??-1;
  for(const b of children){if((b.group??b.uniformGroup)!==n.uniformGroup)n.uniformGroup=-1;for(let k=0;k<3;k++){n.lo[k]=Math.min(n.lo[k],b.lo[k]);n.hi[k]=Math.max(n.hi[k],b.hi[k]);}}
}
const boxesOverlap=(a,b)=>a.lo[0]<=b.hi[0]&&a.hi[0]>=b.lo[0]&&a.lo[1]<=b.hi[1]&&a.hi[1]>=b.lo[1]&&a.lo[2]<=b.hi[2]&&a.hi[2]>=b.lo[2];
export function resolveBodyAvoidance(layout){
  const {nodes,positions,collisionRadii:radii}=layout,count=nodes.length,c=collisionCache(layout),passThrough=layout.transferPassThroughIds||new Set(),previous=layout.bodyAvoidancePrevious;
  layout.bodyAvoidance||=new Map();
  // Reusable numeric workspaces avoid allocating several maps and vectors per body.
  for(let i=0;i<count;i++){const id=nodes[i].id,p=c.points[i]=positions[id];c.previousPoints[i]=previous?.get(id);let offset=layout.bodyAvoidance.get(id);if(!offset){offset=[0,0,0];layout.bodyAvoidance.set(id,offset);}c.offsets[i]=offset;for(let k=0;k<3;k++)c.nominal[i*3+k]=p[k];}
  c.inherited.fill(0);
  const decay=Math.pow(.96,layout.motionStepScale||1);
  for(const i of c.order){const parent=c.parents[i],offset=c.offsets[i],p=c.points[i];for(let k=0;k<3;k++){const shift=c.main[i]||c.passFlags[i]?0:offset[k]*decay+(parent>=0?c.inherited[parent*3+k]:0);c.inherited[i*3+k]=shift;p[k]=c.nominal[i*3+k]+shift;}}
  const updateBox=i=>{const b=c.boxes[i],p=c.points[i],old=c.previousPoints[i]||p,pad=radii[i]+.02;for(let k=0;k<3;k++){b.lo[k]=Math.min(p[k],old[k])-pad;b.hi[k]=Math.max(p[k],old[k])+pad;}};
  for(let i=0;i<count;i++)updateBox(i);
  // sync() packs direct knowledge-plane siblings using their full subtree
  // envelopes and the .88/.02 tidal separation bound. A common parent moves
  // them rigidly; no pair test is needed until an external correction or a
  // shared-tour override breaks that certified relative configuration.
  for(let i=0;i<count;i++){const n=nodes[i],o=c.orbitList[i],offset=c.offsets[i];c.boxes[i].group=o?.knowledgePlane&&!o.motion&&!c.main[i]&&!layout.sharedOrbitIds?.has(n.id)&&offset.every(x=>Math.abs(x)<1e-10)?c.parents[i]:-1;}
  // Stable identities survive changing x-order; refit is linear. Occasional
  // rebuilds restore tree quality without changing collision semantics.
  if(!c.root||c.age++>=16){c.root=buildCollisionTree(c.boxes.filter(b=>!passThrough.has(nodes[b.i].id)));c.age=0;}
  else refitCollisionTree(c.root);
  const query=(i,after)=>{const box=c.boxes[i],found=[],stack=[c.root];while(stack.length){const n=stack.pop();if(box.group>=0&&n.uniformGroup===box.group||!boxesOverlap(box,n))continue;if(n.items){for(const b of n.items)if(b.i>after&&!(box.group>=0&&b.group===box.group)&&boxesOverlap(box,b))found.push(b.i);}else stack.push(n.left,n.right);}return found.sort((a,b)=>a-b);};
  const moved=i=>{updateBox(i);const b=c.boxes[i];b.group=-1;for(let a=b.path.length-1;a>=0;a--){const n=b.path[a],children=n.items||[n.left,n.right];n.uniformGroup=children[0]?.group??children[0]?.uniformGroup??-1;for(const child of children)if((child.group??child.uniformGroup)!==n.uniformGroup)n.uniformGroup=-1;for(let k=0;k<3;k++){n.lo[k]=Math.min(n.lo[k],b.lo[k]);n.hi[k]=Math.max(n.hi[k],b.hi[k]);}}};
  let corrections=0,converged=false,active=null,changedBodies;
  const blocked=new Set();
  const correctPair=(i,j,minimum)=>{
    if(c.passFlags[i]||c.passFlags[j])return false;
    const p=c.points[i],q=c.points[j],wi=c.main[i]?0:1,wj=c.main[j]?0:1,total=wi+wj;
    let dx=q[0]-p[0],dy=q[1]-p[1],dz=q[2]-p[2],distance=Math.hypot(dx,dy,dz);
    if(!total){if(distance<minimum-1e-7)blocked.add(i+':'+j);return false;}
    let corrected=false;
    if(distance<minimum-1e-7){const amount=minimum-distance+1e-6,scale=distance>1e-9?1/distance:0;dx=distance>1e-9?dx*scale:0;dy=distance>1e-9?dy*scale:1;dz=distance>1e-9?dz*scale:0;p[0]-=dx*amount*wi/total;p[1]-=dy*amount*wi/total;p[2]-=dz*amount*wi/total;q[0]+=dx*amount*wj/total;q[1]+=dy*amount*wj/total;q[2]+=dz*amount*wj/total;corrections++;corrected=true;}
    const p0=c.previousPoints[i],q0=c.previousPoints[j],physical=radii[i]+radii[j]+.005;
    if(p0&&q0){const ax=q0[0]-p0[0],ay=q0[1]-p0[1],az=q0[2]-p0[2],mx=q[0]-p[0]-ax,my=q[1]-p[1]-ay,mz=q[2]-p[2]-az,square=mx*mx+my*my+mz*mz,t=square?Math.max(0,Math.min(1,-(ax*mx+ay*my+az*mz)/square)):1;
      if(t>1e-5){const cx=ax+t*mx,cy=ay+t*my,cz=az+t*mz,separation=Math.hypot(cx,cy,cz);if(separation<physical-1e-7&&Math.hypot(ax,ay,az)>=physical-1e-7){
        // Project closing relative motion onto the tangent at its safe start.
        // The entire resulting segment stays outside the initial separation.
        // Unlike penetration/t this has no near-zero-time correction explosion.
        const closing=Math.min(0,(ax*mx+ay*my+az*mz)/(ax*ax+ay*ay+az*az)),correction=[-ax*closing,-ay*closing,-az*closing];
        for(let k=0;k<3;k++){p[k]-=correction[k]*wi/total;q[k]+=correction[k]*wj/total;}corrections++;corrected=true;
      }}
    }
    if(corrected){changedBodies.add(i);changedBodies.add(j);active?.add(i);active?.add(j);moved(i);moved(j);}return corrected;
  };
  for(let pass=0;pass<64;pass++){
    changedBodies=new Set();
    // Parent clearance is a separate O(N) constraint, so ordinary leaf boxes
    // never inherit a five-radius envelope merely to find their own parent.
    for(let i=0;i<count;i++){const parent=c.parents[i];if(parent<0||active&&!active.has(i)&&!active.has(parent))continue;
      const minimum=layout.orbitalClearance(i,parent),o=c.orbitList[i];
      if(c.boxes[i].group>=0&&!(active?.has(parent)||changedBodies.has(parent))&&o.targetRadius*.98>=minimum)continue;
      correctPair(i,parent,minimum);
    }
    for(let i=0;i<count;i++){
      if(c.passFlags[i])continue;
      const candidates=after=>active&&!active.has(i)?[...active].filter(j=>j>after).sort((a,b)=>a-b):query(i,after);
      let nearby=candidates(i),cursor=0;
      while(cursor<nearby.length){const j=nearby[cursor++];if(j===c.parents[i]||i===c.parents[j]||c.passFlags[j])continue;
        const a=c.boxes[i],b=c.boxes[j];if(!boxesOverlap(a,b))continue;
        if(a.group>=0&&a.group===b.group)continue;
        if(correctPair(i,j,layout.bodyMinimum(i,j))){nearby=candidates(j);cursor=0;}
      }
    }
    if(!changedBodies.size){converged=blocked.size===0;break;}active=changedBodies;
  }
  for(let i=0;i<count;i++){const p=c.points[i];for(let k=0;k<3;k++)c.displaced[i*3+k]=p[k]-c.nominal[i*3+k];}
  const savedPrevious=previous||new Map();
  for(let i=0;i<count;i++){
    const n=nodes[i],parent=c.parents[i],p=c.points[i],p0=c.previousPoints[i],offset=c.offsets[i];
    for(let k=0;k<3;k++)offset[k]=n.isMainTag||passThrough.has(n.id)?0:c.displaced[i*3+k]-(parent>=0?c.displaced[parent*3+k]:0);
    if(p0){const v=layout.velocities[n.id]||=[0,0,0];for(let k=0;k<3;k++)v[k]=p[k]-p0[k];}
    let stored=savedPrevious.get(n.id);if(!stored){stored=[0,0,0];savedPrevious.set(n.id,stored);}for(let k=0;k<3;k++)stored[k]=p[k];
  }
  for(const group of layout.sharedOrbits||[]){const tour=group.tour;if(!tour?.world||passThrough.has(group.id))continue;tour.world=[...positions[group.id]];tour.lastRenderedWorld=[...positions[group.id]];tour.worldVelocity=[...(layout.velocities[group.id]||[0,0,0])];}
  layout.bodyAvoidancePrevious=savedPrevious;layout.bodyAvoidanceStats={corrections,converged,blockedMainPairs:blocked.size};
}
