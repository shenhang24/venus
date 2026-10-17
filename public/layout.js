// Geometry is inferred only from recorded relations and their shared neighbours.
import {configureSharedTours,advanceSharedTours} from './shared-tours.js';
// Relation types and their independent evidence are never merged in storage.
export const BASE_ANIMATION_SPEED = 2;
export const SPIN_SPEED_MULTIPLIER = 0;
// Applied to the original group spacing formula, never to saved positions.
export const GROUP_DISTANCE_SCALE = .25;
export const LOCAL_ORBIT_DISTANCE_SCALE = .25;
export const SURFACE_GAP = .02;
export function nodeRadiusFactor(main,count,growth=.01){
  const grown=1+Math.max(0,count||0)*growth;
  return main?Math.min(Math.cbrt(10),1.4*grown):grown;
}
// AU semi-major axes; logarithmic display compression keeps outer orbits readable.
export const SOLAR_ORBIT_AU = [.387,.723,1,1.524,5.203,9.537,19.191,30.069];
const phaseOf = (id) => {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) / 4294967296) * Math.PI * 2;
};

export function orbitalFrame(id){
  const azimuth=phaseOf('azimuth:'+id),inclination=.3+.9*phaseOf('inclination:'+id)/(Math.PI*2);
  const c=Math.cos(azimuth),s=Math.sin(azimuth),ci=Math.cos(inclination),si=Math.sin(inclination);
  return {u:[c,0,s],v:[-s*ci,si,c*ci],normal:[-s*si,-ci,c*si]};
}

export const KNOWLEDGE_LAYERS_PER_PLANE = 9;
// Minimum distance over a shared angular period, including differently tilted planes.
export function orbitSweepDistance(a,ra,b,rb){
 const basis=o=>o.sweepBasis||(o.sweepBasis={c:o.frame.u.map((x,k)=>x*Math.cos(o.phase)+o.frame.v[k]*Math.sin(o.phase)),s:o.frame.u.map((x,k)=>-x*Math.sin(o.phase)+o.frame.v[k]*Math.cos(o.phase))});
 const x=basis(a),y=basis(b);let aa=0,bb=0,ab=0;for(let k=0;k<3;k++){const p=ra*x.c[k]-rb*y.c[k],q=ra*x.s[k]-rb*y.s[k];aa+=p*p;bb+=q*q;ab+=p*q;}
 const denominator=aa+bb+Math.hypot(aa-bb,2*ab);return denominator>0?Math.sqrt(Math.max(0,2*(aa*bb-ab*ab)/denominator)):0;
}

// Newtonian acceleration in scaled scene units. Large graphs use a mass tree.
export function gravityAccelerations(positions,masses,G,softening=0,theta=.6){
  const result=positions.map(()=>[0,0,0]);
  const add=(i,point,mass)=>{const p=positions[i],x=point[0]-p[0],y=point[1]-p[1],z=point[2]-p[2],r2=x*x+y*y+z*z+softening*softening;if(!r2)return;const scale=G*mass/(r2*Math.sqrt(r2)),a=result[i];a[0]+=x*scale;a[1]+=y*scale;a[2]+=z*scale;};
  if(positions.length<=180){for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++){
    const d=positions[j].map((v,a)=>v-positions[i][a]),r2=d.reduce((s,v)=>s+v*v,softening*softening);if(!r2)continue;
    const scale=G/(r2*Math.sqrt(r2));for(let a=0;a<3;a++){result[i][a]+=d[a]*scale*masses[j];result[j][a]-=d[a]*scale*masses[i];}
  }return result;}
  const low=[0,1,2].map(a=>Math.min(...positions.map(p=>p[a]))),high=[0,1,2].map(a=>Math.max(...positions.map(p=>p[a])));
  const center=low.map((v,a)=>(v+high[a])/2),half=Math.max(1e-6,...high.map((v,a)=>(v-low[a])/2))*1.00001;
  const build=(ids,center,half,depth)=>{
    const mass=ids.reduce((s,i)=>s+masses[i],0),point=[0,1,2].map(a=>ids.reduce((s,i)=>s+positions[i][a]*masses[i],0)/mass),node={mass,point,center,half};
    if(ids.length<=8||depth>=24){node.ids=ids;return node;}
    const groups=Array.from({length:8},()=>[]);for(const i of ids){const p=positions[i],oct=(p[0]>=center[0]?1:0)|(p[1]>=center[1]?2:0)|(p[2]>=center[2]?4:0);groups[oct].push(i);}
    node.children=groups.flatMap((group,oct)=>group.length?[build(group,center.map((v,a)=>v+((oct&(1<<a))?1:-1)*half/2),half/2,depth+1)]:[]);return node;
  };
  const root=build(positions.map((p,i)=>i),center,half,0);
  for(let i=0;i<positions.length;i++){
    const stack=[root];while(stack.length){const node=stack.pop();if(node.ids){for(const j of node.ids)if(j!==i)add(i,positions[j],masses[j]);continue;}
      const p=positions[i],contains=Math.abs(p[0]-node.center[0])<=node.half&&Math.abs(p[1]-node.center[1])<=node.half&&Math.abs(p[2]-node.center[2])<=node.half;
      const dx=node.point[0]-p[0],dy=node.point[1]-p[1],dz=node.point[2]-p[2],distance=Math.sqrt(dx*dx+dy*dy+dz*dz);
      if(!contains&&node.half*2/distance<theta)add(i,node.point,node.mass);else stack.push(...node.children);
    }
  }
  return result;
}

export function integrateGravity(positions,velocities,masses,G,dt=1,softening=0,accelerate=gravityAccelerations){
  const first=accelerate(positions,masses,G,softening);
  for(let i=0;i<positions.length;i++)for(let a=0;a<3;a++){velocities[i][a]+=first[i][a]*dt/2;positions[i][a]+=velocities[i][a]*dt;}
  const second=accelerate(positions,masses,G,softening);
  for(let i=0;i<positions.length;i++)for(let a=0;a<3;a++)velocities[i][a]+=second[i][a]*dt/2;
}

export class AffinityLayout {
  constructor() {
    this.positions = Object.create(null);
    this.velocities = Object.create(null);
    this.nodes = [];
    this.links = [];
    this.time = 0;
    this.steps = 0;
    this.accumulator = 0;
    this.spacing = 30;
    this.timeScale = BASE_ANIMATION_SPEED;
    this.orbitClocks = new Map();
  }

  sync({ nodes, edges, seeds = {}, spacing = 30, growth = .01,baseRadius=2 }) {
    this.spacing = spacing;
    const signature = JSON.stringify([
      nodes.map((n) => [n.id,!!n.isMainTag,n.domainConnectionCount,(n.sources||[]).map(s=>s.id).sort()]).sort(),
      edges.map((e) => [e.from, e.to, e.type, e.strength,e.dimensions?.orbitParent,!!e.sources?.some(s=>s.quote?.trim())]).sort(),
      spacing,growth,baseRadius,
    ]);
    if (signature === this.signature) return;
    this.signature = signature;
    this.nodes = nodes;
    const degrees=new Map(nodes.map(n=>[n.id,new Set()]));
    for(const edge of edges){
      if(edge.from===edge.to||edge.semanticAnchor&&!edge.membershipLink)continue;
      const ends=['step','procedure'].includes(edge.type)?[edge.from,edge.to]:[edge.from,edge.to].sort();
      const key=JSON.stringify([...ends,edge.type]);
      degrees.get(edge.from)?.add(key);degrees.get(edge.to)?.add(key);
    }
    // Visual volume supplies inertia: a large core cannot be pulled around by a leaf.
    this.masses=nodes.map(n=>nodeRadiusFactor(n.isMainTag,n.isMainTag?(n.domainConnectionCount??degrees.get(n.id).size):degrees.get(n.id).size,growth)**3);
    this.collisionRadii=this.masses.map(m=>baseRadius*Math.cbrt(m));
    this.collisionGap=SURFACE_GAP;
    this.restPositions ||= Object.create(null);
    const ids = new Set(nodes.map((n) => n.id));
    const neighbours = new Map(nodes.map((n) => [n.id, new Map()]));
    const pairs = new Map();
    const pair = (a, b, weight, indirect = false) => {
      if (a === b || !ids.has(a) || !ids.has(b)) return;
      const [from, to] = a < b ? [a, b] : [b, a];
      const key = JSON.stringify([from, to]);
      const previous = pairs.get(key);
      // Several relation classifications do not mechanically multiply attraction.
      if (!previous || previous.weight < weight)
        pairs.set(key, { from, to, weight, indirect });
    };
    for (const e of edges) {
      if (!ids.has(e.from) || !ids.has(e.to)) continue;
      const w = Math.min(1, Math.max(0, Number(e.strength) || 0));
      if (!w) continue;
      pair(e.from, e.to, w);
      for (const [a, b] of [
        [e.from, e.to],
        [e.to, e.from],
      ])
        neighbours.get(a).set(b, Math.max(w, neighbours.get(a).get(b) || 0));
    }
    // Bounded, weak two-hop attraction expresses shared known structure.
    // It creates no semantic relation or visible edge and has no keyword fallback.
    for (const ns of neighbours.values()) {
      const entries = [...ns]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 12);
      for (let i = 0; i < entries.length; i++)
        for (let j = i + 1; j < entries.length; j++)
          pair(
            entries[i][0],
            entries[j][0],
            Math.min(entries[i][1], entries[j][1]) * 0.16,
            true,
          );
    }
    this.links = [...pairs.values()];
    const centered=nodes.length>0&&nodes.every(n=>seeds[n.id]?.length===3&&seeds[n.id].every(v=>v===0));
    for (const n of nodes) {
      if (this.positions[n.id]) continue;
      const near = [...neighbours.get(n.id)]
        .map(([id]) => this.positions[id])
        .filter(Boolean);
      const phase = phaseOf(n.id);
      const offset = [
        Math.sin(phase),
        Math.cos(phase * 1.7),
        Math.sin(phase * 2.3),
      ];
      this.positions[n.id] = centered?[0,0,0]:near.length
        ? offset.map(
            (x, a) =>
              near.reduce((sum, p) => sum + p[a], 0) / near.length +
              x * spacing,
          )
        : seeds[n.id]?.every(Number.isFinite)
          ? [...seeds[n.id]]
          : offset.map((x) => x * spacing * 2);
      this.velocities[n.id] = [0, 0, 0];
    }
    for (const id of Object.keys(this.positions))
      if (!ids.has(id)) {
        delete this.positions[id];
        delete this.velocities[id];
        delete this.restPositions[id];
      }
    for(const n of nodes)this.restPositions[n.id]||=[...this.positions[n.id]];
    const cores=nodes.map((n,i)=>({node:n,mass:this.masses[i]})).filter(({node})=>node.isMainTag);
    cores.sort((a,b)=>(b.node.domainConnectionCount||0)-(a.node.domainConnectionCount||0)||b.mass-a.mass||(a.node.id===this.coreId?-1:b.node.id===this.coreId?1:a.node.id.localeCompare(b.node.id)));
    this.coreId=cores[0]?.node.id||null;
    // Comparable leading domains form a binary; smaller domains stay planets.
    this.companionId=cores[1]&&(cores[1].node.domainConnectionCount||0)>=10&&(cores[1].node.domainConnectionCount||0)>=(cores[0].node.domainConnectionCount||0)*.85?cores[1].node.id:null;
    this.starIds=new Set(cores.slice(0,3).filter((c,i)=>i===0||((c.node.domainConnectionCount||0)>=10&&(c.node.domainConnectionCount||0)>=(cores[0].node.domainConnectionCount||0)*.85)).map(c=>c.node.id));
    if(this.coreId&&!this.center)this.center=[...this.positions[this.coreId]];
    if(!this.center&&nodes.length)this.center=[0,1,2].map(a=>nodes.reduce((sum,n)=>sum+this.positions[n.id][a],0)/nodes.length);
    this.eclipticY??=this.center?.[1]||0;
    const largestSize=Math.max(1,...this.masses.map(m=>Math.cbrt(m)));
    const maxDomainCount=Math.max(1,...cores.map(c=>c.node.domainConnectionCount||0));
    this.centrality=this.masses.map((m,i)=>nodes[i].isMainTag?(nodes[i].domainConnectionCount||0)/maxDomainCount:largestSize>1?(Math.cbrt(m)-1)/(largestSize-1):0);
    const nodeIndex=new Map(nodes.map((n,i)=>[n.id,i])),members=new Map(),owners=new Map(),membershipHosts=new Map();
    this.nodeIndices=nodeIndex;
    for(const edge of edges.filter(e=>e.membershipLink)){
      const host=nodeIndex.get(edge.from),child=nodeIndex.get(edge.to);
      if(host===undefined||child===undefined||!nodes[host].isMainTag||nodes[child].isMainTag)continue;
      if(!membershipHosts.has(edge.to))membershipHosts.set(edge.to,new Set());membershipHosts.get(edge.to).add(host);
      const previous=owners.get(edge.to);
      if(previous===undefined||this.masses[host]>this.masses[previous])owners.set(edge.to,host);
    }
    this.sharedOrbits=[...membershipHosts].filter(([id,hosts])=>hosts.size>1).map(([id,hosts])=>({id,index:nodeIndex.get(id),hosts:[...hosts]}));
    this.sharedOrbitIds=new Set(this.sharedOrbits.map(group=>group.id));
    this.sharedOrbitById=new Map(this.sharedOrbits.map(group=>[group.id,group]));
    this.membershipPlaneKeys=new Map();
    for(const n of nodes){const hosts=membershipHosts.get(n.id);if(hosts)this.membershipPlaneKeys.set(n.id,'membership:'+hosts.size+':'+nodes[owners.get(n.id)].id);}
    this.orbitHierarchyIssues=[];
    const hierarchy=edges.filter(e=>!e.membershipLink&&e.sources?.some(s=>s.quote?.trim())&&(e.type==='contains'||e.type==='part-of'||e.dimensions?.orbitParent===true||e.dimensions?.orbitParent===e.from))
      .sort((a,b)=>(b.strength||0)-(a.strength||0)||String(a.id||a.from+'|'+a.to).localeCompare(String(b.id||b.from+'|'+b.to)));
    const assigned=new Set();
    for(const edge of hierarchy){
      const parentId=edge.type==='part-of'?edge.to:edge.from,childId=edge.type==='part-of'?edge.from:edge.to,parent=nodeIndex.get(parentId),child=nodeIndex.get(childId);
      if(parent===undefined||child===undefined||nodes[child].isMainTag||nodes[parent].kind!==nodes[child].kind||assigned.has(childId))continue;
      let ancestor=parent,cycle=false;const seen=new Set([child]);
      while(ancestor!==undefined){if(seen.has(ancestor)){cycle=true;break;}seen.add(ancestor);ancestor=owners.get(nodes[ancestor].id);}
      if(cycle){this.orbitHierarchyIssues.push({edgeId:edge.id,reason:'cyclic orbital hierarchy'});continue;}
      owners.set(childId,parent);assigned.add(childId);
    }
    // Provenance is also a visual neighbourhood, never a new stored relation.
    for(const n of [...nodes].sort((a,b)=>a.id.localeCompare(b.id))){
      if(n.isMainTag||assigned.has(n.id)||this.sharedOrbitIds.has(n.id))continue;
      for(const source of n.sources||[]){
        const parent=nodeIndex.get(source.id),child=nodeIndex.get(n.id);
        if(parent===undefined||parent===child||nodes[parent].isMainTag||nodes[parent].kind!==n.kind)continue;
        if(owners.get(n.id)!==owners.get(source.id))continue;
        let ancestor=parent,cycle=false;const seen=new Set([child]);
        while(ancestor!==undefined){if(seen.has(ancestor)){cycle=true;break;}seen.add(ancestor);ancestor=owners.get(nodes[ancestor].id);}
        if(!cycle){owners.set(n.id,parent);assigned.add(n.id);break;}
      }
    }
    this.orbits=Object.create(null);
    for(const [id,host]of owners){if(!members.has(host))members.set(host,[]);members.get(host).push(id);}
    for(const [host,children]of members){
      const sourceKey=id=>(nodes[nodeIndex.get(id)].sources||[]).map(s=>s.id).sort().join('|');
      const planeKey=id=>this.membershipPlaneKeys.get(id)||nodes[host].id+':unclassified';
      children.sort((a,b)=>planeKey(a).localeCompare(planeKey(b))||sourceKey(a).localeCompare(sourceKey(b))||a.localeCompare(b));const axis=[0,1,0],norm=1;
      let shell=0,shellRank=0,previousPlane=null,layer=0,page=0;
      const knowledge=nodes[host].kind==='knowledge';
      children.forEach((id,rank)=>{const i=nodeIndex.get(id),stellar=this.starIds.has(nodes[host].id);
        const band=rank%SOLAR_ORBIT_AU.length,outerLayer=Math.floor(rank/SOLAR_ORBIT_AU.length),baseKey=planeKey(id);
        if(knowledge){
          if(previousPlane!==null&&baseKey!==previousPlane){shell++;shellRank=0;layer=0;page=0;}
          else if(shellRank>=6*(layer+1)){shell++;shellRank=0;layer++;if(layer>=KNOWLEDGE_LAYERS_PER_PLANE){page++;layer=0;}}
        }else if(shellRank>=6*(shell+1)||(previousPlane!==null&&baseKey!==previousPlane)){shell++;shellRank=0;}
        previousPlane=baseKey;const slots=6*((knowledge?layer:shell)+1),slot=shellRank++,key=knowledge&&page?baseKey+':capacity-plane:'+page:baseKey;
        const gap=stellar?this.collisionRadii[host]*(.8+1.2*Math.log1p(SOLAR_ORBIT_AU[band])+outerLayer*4.2):this.collisionRadii[host]*.15+this.collisionRadii[i]*(.45+2.4*(knowledge?layer:shell));
        const radius=this.collisionRadii[host]+this.collisionRadii[i]+gap;
        this.orbits[id]={host:nodes[host].id,localShell:shell,localSlots:slots,planeKey:key,...(knowledge?{knowledgePlane:true,planePage:page,radialLayer:layer}:{}),axis:axis.map(v=>v/norm),radius,targetRadius:radius,phase:slot*Math.PI*2/slots+(knowledge?layer*.2+page*.618:shell*.2),hostMass:this.masses[host]};});
    }
    const primary=nodeIndex.get(this.coreId);
    if(primary!==undefined)for(const {node}of cores){
      if(node.id===this.coreId)continue;
      const i=nodeIndex.get(node.id);
      if(this.starIds.has(node.id)){const radius=(this.collisionRadii[primary]+this.collisionRadii[i])*1.12;
        this.orbits[node.id]={host:this.coreId,kind:'star',binary:true,radius,targetRadius:radius,axis:[0,1,0],hostMass:this.masses[primary],launchKey:'binary:'+this.coreId};continue;}
      const rank=cores.filter(c=>!this.starIds.has(c.node.id)).findIndex(c=>c.node.id===node.id);
      const ring=Math.floor(rank/8),slot=rank%8;
      const maxPlanetRadius=Math.max(...cores.slice(1).map(c=>this.collisionRadii[nodeIndex.get(c.node.id)]),1);
      const nineAU=[...SOLAR_ORBIT_AU,39.482],band=ring%9,cycle=Math.floor(ring/9);
      const base=Math.max(spacing*3,this.collisionRadii[primary]+maxPlanetRadius*3);
      const radius=base+(maxPlanetRadius*3+spacing)* (Math.log1p(nineAU[band])/Math.log(1.387)+cycle*12);
      this.orbits[node.id]={host:this.coreId,kind:'planet',ring,slot,phase:slot*Math.PI/4+ring*.23,axis:[0,1,0],radius,targetRadius:radius,hostMass:this.masses[primary],launchKey:'planet-ring:'+this.coreId+':'+ring+':'+slot};
    }
    for(const group of this.sharedOrbits)if(this.orbits[group.id])this.orbits[group.id].launchKey='shared:'+group.hosts.map(i=>nodes[i].id).sort().join('|');
    this.centralOrbitFrame=orbitalFrame([...this.starIds].sort().join('|'));
    for(const o of Object.values(this.orbits)){o.frame=orbitalFrame(o.planeKey||o.host+':ring:'+(o.ring??'central'));o.axis=o.frame.normal;}
    for(const group of this.sharedOrbits)group.frame=orbitalFrame(this.membershipPlaneKeys.get(group.id));
    this.orbitDepths=Object.create(null);
    const depth=id=>this.orbitDepths[id]??(this.orbitDepths[id]=this.orbits[id]?1+depth(this.orbits[id].host):0);
    for(const n of nodes)depth(n.id);
    this.orbitOrder=[...nodes].sort((a,b)=>this.orbitDepths[a.id]-this.orbitDepths[b.id]);
    this.systemExtents=[...this.collisionRadii];
    this.subtreeMaxRadius=[...this.collisionRadii];
    // Reserve disjoint swept volumes, including descendants, growth and +/-2% tides.
    // This is geometric packing, not collision forces or integration.
    for(const n of [...this.orbitOrder].reverse()){
      const host=nodeIndex.get(n.id),children=members.get(host)||[],shells=new Map();
      for(const id of children){const o=this.orbits[id];if(!o||o.kind==='star'||o.kind==='planet')continue;if(!shells.has(o.localShell))shells.set(o.localShell,[]);shells.get(o.localShell).push(id);}
      const planeBounds=new Map(),knowledgePlaced=[];
      let previous=0,previousExtent=0,previousSize=0,previousRadiusForPlane=0,previousExtentForPlane=0;
      for(const shell of [...shells.keys()].sort((a,b)=>a-b)){
        const ids=shells.get(shell),plane=this.orbits[ids[0]].planeKey,knowledge=this.orbits[ids[0]].knowledgePlane;
        if(knowledge){const previous=planeBounds.get(plane)||{radius:0,extent:0,size:0};previousRadiusForPlane=previous.radius;previousExtentForPlane=previous.extent;}
        const extent=Math.max(...ids.map(id=>this.systemExtents[nodeIndex.get(id)])),size=Math.max(...ids.map(id=>this.subtreeMaxRadius[nodeIndex.get(id)])),slots=this.orbits[ids[0]].localSlots;
        const oldPrevious=previous,oldExtent=previousExtent;if(knowledge){previous=previousRadiusForPlane;previousExtent=previousExtentForPlane;}
        const parentGap=SURFACE_GAP+.2*Math.min(this.collisionRadii[host],size);
        const baselineRadius=Math.max((this.collisionRadii[host]+extent+parentGap)/.98,(2*extent+SURFACE_GAP)/(2*Math.sin(Math.PI/slots)*.98),(previous*1.02+previousExtent+extent+SURFACE_GAP)/.98);
        const placed=[];
        // Pack actual child envelopes, rather than assigning every child the
        // largest sibling's envelope. All members of this shell share a plane
        // and angular rate, so their separation is bounded analytically.
        for(const id of [...ids].sort((a,b)=>this.systemExtents[nodeIndex.get(b)]-this.systemExtents[nodeIndex.get(a)]||a.localeCompare(b))){
          const i=nodeIndex.get(id),e=this.systemExtents[i],s=this.subtreeMaxRadius[i],o=this.orbits[id];
          let radius=Math.max(baselineRadius*LOCAL_ORBIT_DISTANCE_SCALE,(this.collisionRadii[host]+e+parentGap)/.98,(previous*1.02+previousExtent+e+SURFACE_GAP)/.98);
          const safe=r=>knowledge?knowledgePlaced.every(p=>Math.abs(r-p.radius)-.02*(r+p.radius)>=e+p.extent+SURFACE_GAP-1e-8||orbitSweepDistance(o,r,p.orbit,p.radius)-.02*(r+p.radius)>=e+p.extent+SURFACE_GAP-1e-8):placed.every(p=>{const angle=o.phase-p.phase,nominal=Math.sqrt(Math.max(0,r*r+p.radius*p.radius-2*r*p.radius*Math.cos(angle)));return nominal-.02*(r+p.radius)>=e+p.extent+SURFACE_GAP-1e-8;});
          if(!safe(radius)){let low=Math.max(radius,...placed.map(p=>p.radius)),high=low;while(!safe(high))high=high*1.25+1;for(let step=0;step<40;step++){const middle=(low+high)/2;if(safe(middle))high=middle;else low=middle;}radius=high;}
          o.radius=o.targetRadius=radius;o.uncompressedShellRadius=baselineRadius;
          placed.push({radius,phase:o.phase,extent:e,size:s});
          if(knowledge)knowledgePlaced.push({radius,orbit:o,extent:e});
          this.systemExtents[host]=Math.max(this.systemExtents[host],radius*1.02+e);
        }
        this.subtreeMaxRadius[host]=Math.max(this.subtreeMaxRadius[host],size);
        previous=Math.max(...placed.map(p=>p.radius));previousExtent=extent;previousSize=size;
        if(knowledge){planeBounds.set(plane,{radius:previous,extent,size});previous=oldPrevious;previousExtent=oldExtent;}
      }
    }
    configureSharedTours(this,orbitalFrame);
    const starIndices=[...this.starIds].map(id=>nodeIndex.get(id)),starExtent=Math.max(0,...starIndices.map(i=>this.systemExtents[i])),starSize=Math.max(0,...starIndices.map(i=>this.subtreeMaxRadius[i]));
    this.centralOrbitRadius=0;
    if(starIndices.length>1)for(let a=0;a<starIndices.length;a++)for(let b=a+1;b<starIndices.length;b++){
      const i=starIndices[a],j=starIndices[b],chord=2*Math.sin(Math.PI*(b-a)/starIndices.length);
      this.centralOrbitRadius=Math.max(this.centralOrbitRadius,(this.systemExtents[i]+this.systemExtents[j]+SURFACE_GAP)/chord);
    }
    const starMass=starIndices.reduce((sum,i)=>sum+this.masses[i],0);
    const mean=[0,0];starIndices.forEach((i,k)=>{mean[0]+=Math.cos(k*Math.PI*2/starIndices.length)*this.masses[i]/starMass;mean[1]+=Math.sin(k*Math.PI*2/starIndices.length)*this.masses[i]/starMass;});
    const centralExtent=Math.max(0,...starIndices.map((i,k)=>Math.hypot(Math.cos(k*Math.PI*2/starIndices.length)-mean[0],Math.sin(k*Math.PI*2/starIndices.length)-mean[1])*this.centralOrbitRadius+this.systemExtents[i]));
    const ringBounds=new Map();
    for(const n of nodes){const o=this.orbits[n.id];if(o?.kind!=='planet')continue;
      const extent=this.systemExtents[nodeIndex.get(n.id)];
      ringBounds.set(o.ring,Math.max(ringBounds.get(o.ring)||0,o.targetRadius*GROUP_DISTANCE_SCALE,extent*Math.max(1,4*GROUP_DISTANCE_SCALE)));
    }
    let previousRadius=0,previousEnvelope=centralExtent,previousSize=starSize;
    for(const ring of [...ringBounds.keys()].sort((a,b)=>a-b)){
      const members=nodes.filter(n=>this.orbits[n.id]?.kind==='planet'&&this.orbits[n.id].ring===ring);
      const envelope=Math.max(...members.map(n=>this.systemExtents[nodeIndex.get(n.id)]));
      const size=Math.max(...members.map(n=>this.subtreeMaxRadius[nodeIndex.get(n.id)]));
      let sameRingMinimum=0;
      for(let a=0;a<members.length;a++)for(let b=a+1;b<members.length;b++){
        const i=nodeIndex.get(members[a].id),j=nodeIndex.get(members[b].id),angle=Math.abs(this.orbits[members[a].id].phase-this.orbits[members[b].id].phase);
        sameRingMinimum=Math.max(sameRingMinimum,(this.systemExtents[i]+this.systemExtents[j]+4*Math.max(this.subtreeMaxRadius[i],this.subtreeMaxRadius[j]))/(2*Math.abs(Math.sin(angle/2))));
      }
      const radius=Math.max(ringBounds.get(ring),sameRingMinimum,previousRadius+previousEnvelope+envelope+SURFACE_GAP);
      for(const n of members){const o=this.orbits[n.id];o.radius=o.targetRadius=radius;o.satelliteEnvelope=envelope;o.satelliteLimit=radius;}
      previousRadius=radius;previousEnvelope=envelope;previousSize=size;
    }
    const free=nodes.filter(n=>!this.starIds.has(n.id)&&!this.orbits[n.id]).sort((a,b)=>a.id.localeCompare(b.id));
    const freeSize=Math.max(0,...free.map(n=>this.collisionRadii[nodeIndex.get(n.id)]));
    const systemBound=Math.max(centralExtent,...nodes.filter(n=>this.orbits[n.id]?.kind==='planet').map(n=>this.orbits[n.id].targetRadius+this.systemExtents[nodeIndex.get(n.id)]+2*this.centralOrbitRadius));
    this.tourWorldBound=Math.max(100,systemBound*4);
    this.freeOrbits=new Map();
    for(let k=0;k<free.length;k++){
      const shell=Math.floor((Math.sqrt(1+4*k/3)-1)/2),start=3*shell*(shell+1),slots=6*(shell+1);
      const radius=Math.max(systemBound+freeSize+SURFACE_GAP+shell*(2*freeSize+SURFACE_GAP),(freeSize+SURFACE_GAP/2)/Math.sin(Math.PI/slots));
      this.freeOrbits.set(free[k].id,{radius,phase:(k-start)*Math.PI*2/slots,frame:orbitalFrame('unassigned:'+shell)});
    }
    // Gravity groups include planet hosts too; visual roles are independent of this index.
    this.stellarIndices=nodes.map((n,i)=>n.isMainTag?i:-1).filter(i=>i>=0);
    this.bodyRoles=Object.fromEntries(nodes.map(n=>[n.id,this.starIds.has(n.id)?'star':n.isMainTag?'planet':this.orbits[n.id]&&!this.starIds.has(this.orbits[n.id].host)?'satellite':'planet']));
    const systems=new Map(),sharedSystems=new Map();
    for(const n of nodes){let root=n.id;while(!nodes[nodeIndex.get(root)]?.isMainTag&&!this.sharedOrbitIds.has(root)&&this.orbits[root])root=this.orbits[root].host;
      if(this.sharedOrbitIds.has(root)){if(!sharedSystems.has(root))sharedSystems.set(root,[]);sharedSystems.get(root).push(nodeIndex.get(n.id));continue;}
      if(nodes[nodeIndex.get(root)]?.isMainTag){if(!systems.has(root))systems.set(root,[]);systems.get(root).push(nodeIndex.get(n.id));}
    }
    this.gravitySystems=[...systems.values()];
    this.sharedGravitySystems=[...sharedSystems].map(([id,members])=>({members,hosts:this.sharedOrbitById.get(id).hosts}));
    this.spinRates=Object.fromEntries(nodes.map(n=>[n.id,(this.starIds.has(n.id)?.08:.25)*(.72+.56*phaseOf(n.id)/(Math.PI*2))]));
    this.G=spacing**3*.0000005;
    this.gravityLaunches||=new Map();
  }

  advance(elapsed) {
    this.accumulator += Math.max(0, Math.min(elapsed, 0.1))*this.timeScale;
    let changed = false;
    while (this.accumulator >= 1 / 30-1e-10) {
      this.step();
      this.accumulator = Math.max(0,this.accumulator-1/30);
      changed = true;
    }
    return changed;
  }

  step({ floating = true } = {}) {
    const count = this.nodes.length;
    if (!count) return;
    if(floating&&this.coreId){this.stepGravity();this.time+=1/30;this.steps++;return;}
    const forces = new Float64Array(count * 3);
    const index = new Map(this.nodes.map((n, i) => [n.id, i]));
    const positions = this.nodes.map((n) => this.positions[n.id]);
    const centroid = [0, 0, 0];
    const totalMass=this.masses.reduce((sum,m)=>sum+m,0);
    for (let i=0;i<count;i++)
      for (let a = 0; a < 3; a++) centroid[a] += positions[i][a]*this.masses[i]/totalMass;
    const repel = (i, j, weight = 1) => {
      if (i === j) return;
      const p = positions[i],
        q = positions[j];
      let dx = p[0] - q[0],
        dy = p[1] - q[1],
        dz = p[2] - q[2];
      let length = Math.hypot(dx, dy, dz);
      if (length < 0.01) {
        const phase = phaseOf(this.nodes[i].id + this.nodes[j].id);
        dx = Math.sin(phase);
        dy = Math.cos(phase);
        dz = Math.sin(phase * 1.7);
        length = Math.hypot(dx, dy, dz);
      }
      const force = (65 * weight) / (length * length + 30);
      forces[i * 3] += (dx / length) * force;
      forces[i * 3 + 1] += (dy / length) * force;
      forces[i * 3 + 2] += (dz / length) * force;
    };
    if (count <= 180) {
      for (let i = 0; i < count; i++)
        for (let j = 0; j < count; j++) repel(i, j);
    } else {
      // Local spatial cells + a bounded far-field sample keep large graphs usable.
      const cell = this.spacing * 1.6,
        grid = new Map();
      const cells = positions.map((p) => p.map((v) => Math.floor(v / cell)));
      const key = (x, y, z) => `${x},${y},${z}`;
      cells.forEach(([x, y, z], i) => {
        const k = key(x, y, z);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
      });
      for (let i = 0; i < count; i++) {
        const [x, y, z] = cells[i];
        let visited = 0;
        outer: for (let a = -1; a <= 1; a++)
          for (let b = -1; b <= 1; b++)
            for (let c = -1; c <= 1; c++) {
              for (const j of grid.get(key(x + a, y + b, z + c)) || []) {
                repel(i, j);
                if (++visited >= 40) break outer;
              }
            }
        for (let s = 1; s <= 12; s++)
          repel(i, (i + s * 607) % count, Math.sqrt(count) / 12);
      }
    }
    for (const link of this.links) {
      const i = index.get(link.from),
        j = index.get(link.to);
      const p = positions[i],
        q = positions[j];
      const delta = q.map((v, a) => v - p[a]);
      const length = Math.hypot(...delta) || 0.001;
      const desired = Math.max(this.spacing * (1.9 - 1.25 * link.weight),this.bodyMinimum(i,j));
      const spring =
        (length - desired) *
        (0.002 + 0.007 * link.weight) *
        (link.indirect ? 0.35 : 1);
      for (let a = 0; a < 3; a++) {
        const f = (delta[a] / length) * spring;
        forces[i * 3 + a] += f;
        forces[j * 3 + a] -= f;
      }
    }
    for (let i = 0; i < count; i++) {
      const n = this.nodes[i],
        p = positions[i],
        v = this.velocities[n.id];
      const phase = phaseOf(n.id);
      const mass=this.masses[i],mobility=1/mass;
      if(n.id===this.coreId){
        // The center stays put: a newly dominant label travels to it continuously.
        const amplitude=floating?this.spacing*.02/Math.pow(mass,.1):0;
        const delta=p.map((value,a)=>this.center[a]+Math.sin(this.time*(.07+a*.013)+phase*(a+1))*amplitude-value),distance=Math.hypot(...delta);
        const limit=this.spacing*.008/Math.pow(mass,.15);
        for(let a=0;a<3;a++)v[a]=v[a]*.9+delta[a]*Math.min(.006,limit/(distance||1))*.1;
        const speed=Math.hypot(...v);
        for(let a=0;a<3;a++)p[a]+=v[a]*Math.min(1,limit/(speed||1));
        continue;
      }
      const centrality=this.centrality[i];
      let radial=p.map((value,a)=>value-this.center[a]);
      const radius=Math.hypot(...radial);
      if(radius<.001)radial=[Math.sin(phase),Math.cos(phase),Math.sin(phase*1.7)];
      const directionLength=Math.hypot(...radial)||1;
      // A finite central region keeps several large domains from collapsing together.
      const targetRadius=this.spacing*(3+5*(1-centrality));
      const inward=(radius-targetRadius)*.0002*centrality;
      for (let a = 0; a < 3; a++) {
        const drift = floating
          ? Math.sin(this.time * (0.19 + a * 0.023) + phase * (a + 1)) *
            this.spacing *
            0.000035
          : 0;
        // Heavy bodies retain a soft home, rather than a hard fixed coordinate.
        v[a] =
          (v[a] + (forces[i * 3 + a] - (p[a] - centroid[a]) * 0.00006 + drift)*mobility
            -(p[a]-this.restPositions[n.id][a])*.00012*(1-mobility)*(1-centrality)
            -(radial[a]/directionLength)*inward
            +(floating?(a===0?-radial[2]:a===2?radial[0]:0)/directionLength*this.spacing*(n.isMainTag?.00035:.000006)*(1-centrality*.6)*Math.sqrt(mobility):0)) *
          (0.78+0.06*mobility);
      }
      const speed = Math.hypot(...v),
        limit = this.spacing * 0.012 / Math.pow(mass,.65);
      for (let a = 0; a < 3; a++)
        p[a] += v[a] * Math.min(1, limit / (speed || 1));
    }
    this.resolveCollisions();
    this.time += 1 / 30;
    this.steps++;
  }

  spinAngle(id){return phaseOf(id)+this.time*(this.spinRates?.[id]||.25)*SPIN_SPEED_MULTIPLIER;}

  bodyMinimum(i,j){
    return this.collisionRadii[i]+this.collisionRadii[j]+SURFACE_GAP;
  }
  stellarMinimum(i,j){if(this.starIds?.has(this.nodes[i].id)&&this.starIds.has(this.nodes[j].id))return this.bodyMinimum(i,j);
    return this.bodyMinimum(i,j)+Math.max(0,(this.systemExtents?.[i]||0)-this.collisionRadii[i])+Math.max(0,(this.systemExtents?.[j]||0)-this.collisionRadii[j]);}

  focalPosition(){
    if(!this.companionId)return this.positions[this.coreId]||this.center||[0,0,0];
    const indices=[...this.starIds].map(id=>this.nodeIndices.get(id)),total=indices.reduce((s,i)=>s+this.masses[i],0);
    return [0,1,2].map(k=>indices.reduce((s,i)=>s+this.positions[this.nodes[i].id][k]*this.masses[i],0)/total);
  }

  resolveStellarSpacing(){
    const stars=this.nodes.map((n,i)=>n.isMainTag?i:-1).filter(i=>i>=0),before=new Map(stars.map(i=>[this.nodes[i].id,[...this.positions[this.nodes[i].id]]]));
    for(let pass=0;pass<128;pass++){
      let overlapFound=false;
      for(let a=0;a<stars.length;a++)for(let b=a+1;b<stars.length;b++){
        const i=stars[a],j=stars[b],p=this.positions[this.nodes[i].id],q=this.positions[this.nodes[j].id],minimum=this.stellarMinimum(i,j);
        let delta=q.map((v,k)=>v-p[k]),length=Math.hypot(...delta);if(length>=minimum-1e-7)continue;
        if(length<1e-8){const phase=phaseOf(this.nodes[i].id+'|'+this.nodes[j].id);delta=[Math.cos(phase),0,Math.sin(phase)];length=0;}else delta=delta.map(v=>v/length);
        const wi=1/this.masses[i],wj=1/this.masses[j],total=wi+wj,vi=this.velocities[this.nodes[i].id],vj=this.velocities[this.nodes[j].id],closing=delta.reduce((s,v,k)=>s+(vj[k]-vi[k])*v,0);
        for(let k=0;k<3;k++){
          const correction=(minimum-length+1e-6)*delta[k];p[k]-=correction*wi/total;q[k]+=correction*wj/total;
          if(closing<0){vi[k]+=closing*delta[k]*wi/total;vj[k]-=closing*delta[k]*wj/total;}
        }
        overlapFound=true;
      }
      if(!overlapFound)break;
    }
    for(const [id,orbit]of Object.entries(this.orbits))if(!this.nodes[this.nodeIndices.get(id)]?.isMainTag){
      if(this.sharedOrbitIds.has(id))continue;
      let hostId=orbit.host;while(hostId&&!before.has(hostId)&&!this.sharedOrbitIds.has(hostId))hostId=this.orbits[hostId]?.host;
      if(!hostId||this.sharedOrbitIds.has(hostId))continue;const old=before.get(hostId),host=this.positions[hostId];
      for(let k=0;k<3;k++)this.positions[id][k]+=host[k]-old[k];
    }
  }

  stepGravity(){
    // Display choreography only: no force integration, impulses or escape velocities.
    const stars=[...this.starIds].map(id=>this.nodeIndices.get(id));
    const center=this.center||[0,this.eclipticY,0];
    if(stars.length>1){
      const radius=this.centralOrbitRadius;
      const angle=this.steps*.001;
      const frame=this.centralOrbitFrame;
      const offsets=stars.map((i,k)=>{const a=angle+k*Math.PI*2/stars.length;return frame.u.map((u,j)=>(u*Math.cos(a)+frame.v[j]*Math.sin(a))*radius);});
      const mass=stars.reduce((sum,i)=>sum+this.masses[i],0);
      const mean=[0,1,2].map(a=>stars.reduce((sum,i,k)=>sum+offsets[k][a]*this.masses[i],0)/mass);
      stars.forEach((i,k)=>{const id=this.nodes[i].id;this.positions[id]=center.map((v,a)=>v+offsets[k][a]-mean[a]);this.velocities[id]=[0,0,0];});
    }else if(this.coreId){this.positions[this.coreId]=[...center];this.velocities[this.coreId]=[0,0,0];}
    this.lockPlanetOrbits();
    for(const n of this.nodes)if(!this.starIds.has(n.id)&&!this.orbits[n.id]){
      const o=this.freeOrbits.get(n.id),a=o.phase+this.steps*.0007,r=o.radius;
      const frame=o.frame;this.positions[n.id]=center.map((x,k)=>x+(frame.u[k]*Math.cos(a)+frame.v[k]*Math.sin(a))*r);this.velocities[n.id]=[0,0,0];
    }
    advanceSharedTours(this);
  }
  lockPlanetOrbits({advance=true}={}){
    const shifts=new Map(),boosts=new Map();
    for(const n of this.orbitOrder){
      const orbit=this.orbits[n.id];if(!orbit||orbit.kind==='star')continue;
      const p=this.positions[n.id],v=this.velocities[n.id],oldP=[...p],oldV=[...v];
      for(let a=0;a<3;a++){p[a]+=shifts.get(orbit.host)?.[a]||0;v[a]+=boosts.get(orbit.host)?.[a]||0;}
      {
        const i=this.nodeIndices.get(n.id),host=this.nodeIndices.get(orbit.host),q=this.positions[orbit.host],u=this.velocities[orbit.host];
        const baseRadius=Math.max(orbit.targetRadius,this.bodyMinimum(i,host));
        const initialPhase=orbit.phase??Math.atan2(p[2]-q[2],p[0]-q[0]);
        // A shared ring has one angular speed, preserving its eight nonoverlapping slots.
        // Visual orbit periods stay observable even after clearance enlarges a ring.
        const omega=orbit.kind==='planet'?.003/(1+(orbit.ring||0)*.14):orbit.knowledgePlane?.008*(.85+.3*phaseOf(orbit.host)/(Math.PI*2)):.008/(1+(orbit.localShell||0)*.08);
        // Persistent clocks survive sync(): background imports must not reset
        // any descendant's revolution. Co-orbiting bodies share a phase clock.
        const clockKey=JSON.stringify([orbit.host,orbit.kind==='planet'?'planet':orbit.knowledgePlane?'knowledge':'satellite',orbit.knowledgePlane?0:orbit.kind==='planet'?orbit.ring:orbit.localShell]);
        let clock=this.orbitClocks.get(clockKey);
        if(!clock){clock={angle:0,lastStep:-1};this.orbitClocks.set(clockKey,clock);}
        if(advance&&clock.lastStep!==this.steps){clock.angle-=omega;clock.lastStep=this.steps;}
        orbit.angularVelocity=omega;orbit.lockAngle=initialPhase+clock.angle;
        // Only local satellites receive a bounded, differential tidal response.
        const parentOrbit=this.orbits[orbit.host],ancestor=parentOrbit&&this.nodeIndices.get(parentOrbit.host);
        let perturbation=0;
        if(orbit.kind!=='planet'&&ancestor!==undefined){
          const remote=this.positions[parentOrbit.host],d=Math.hypot(...remote.map((x,a)=>x-q[a]));
          const tide=this.masses[ancestor]/this.masses[host]*(baseRadius/Math.max(d,baseRadius))**3;
          const delta=remote.map((x,a)=>x-q[a]),project=axis=>delta.reduce((sum,x,a)=>sum+x*axis[a],0);
          const amplitude=Math.min(.02,Math.max(0,tide)*.1),direction=Math.atan2(project(orbit.frame.v),project(orbit.frame.u));
          perturbation=amplitude*Math.cos(2*(orbit.lockAngle-direction));
        }
        const radius=Math.max(this.bodyMinimum(i,host),baseRadius*(1+perturbation));
        orbit.radialPerturbation=perturbation;
        const c=Math.cos(orbit.lockAngle),s=Math.sin(orbit.lockAngle);
        const frame=orbit.frame;
        for(let a=0;a<3;a++){p[a]=q[a]+(frame.u[a]*c+frame.v[a]*s)*radius;v[a]=u[a]+(frame.u[a]*s-frame.v[a]*c)*radius*omega;}
      }
      shifts.set(n.id,p.map((x,a)=>x-oldP[a]));boosts.set(n.id,v.map((x,a)=>x-oldV[a]));
    }
  }

  settleEcliptic(){
    for(const n of this.nodes){const p=this.positions[n.id],v=this.velocities[n.id];p[1]=this.eclipticY+(p[1]-this.eclipticY)*.99;v[1]*=.94;}
  }

  balanceSharedOrbits(){
    if(!this.sharedOrbits.length)return;
    const changes=new Map(),counts=new Map(),add=(i,vector)=>{if(!changes.has(i))changes.set(i,[0,0,0]);const sum=changes.get(i);for(let a=0;a<3;a++)sum[a]+=vector[a];counts.set(i,(counts.get(i)||0)+1);};
    for(const group of this.sharedOrbits){
      const p=this.positions[group.id],distances=group.hosts.map(i=>Math.hypot(...p.map((v,a)=>v-this.positions[this.nodes[i].id][a])));
      const mean=Math.max(distances.reduce((s,d)=>s+d,0)/distances.length,...group.hosts.map(i=>this.bodyMinimum(group.index,i)));
      for(let k=0;k<group.hosts.length;k++){
        const host=group.hosts[k],q=this.positions[this.nodes[host].id],d=distances[k],phase=phaseOf(group.id+'|'+this.nodes[host].id),direction=d>.001?p.map((v,a)=>(v-q[a])/d):[Math.cos(phase),0,Math.sin(phase)];
        const error=d-mean,bridgeMobility=1/Math.sqrt(this.masses[group.index]),starMobility=1/Math.sqrt(this.masses[host]),total=bridgeMobility+starMobility;
        add(group.index,direction.map((v,a)=>a===1?0:-v*error*.035*bridgeMobility/total));
        add(host,direction.map((v,a)=>a===1?0:v*error*.035*starMobility/total));
      }
    }
    const shifts=new Map(),boosts=new Map();
    for(const n of this.orbitOrder){
      const i=this.nodeIndices.get(n.id),sum=changes.get(i)||[0,0,0],average=sum.map(v=>v/(counts.get(i)||1)),length=Math.hypot(...average),limit=this.spacing*(n.isMainTag?.004:.016)/Math.pow(this.masses[i],.1);
      const shift=average.map(v=>v*Math.min(1,limit/(length||1))),boost=shift.map(v=>v*.02),orbit=this.orbits[n.id];
      if(orbit&&orbit.kind!=='star'&&!this.sharedOrbitIds.has(n.id))for(let a=0;a<3;a++){shift[a]+=shifts.get(orbit.host)?.[a]||0;boost[a]+=boosts.get(orbit.host)?.[a]||0;}
      if(shift.some(v=>v!==0)){for(let a=0;a<3;a++){this.positions[n.id][a]+=shift[a];this.velocities[n.id][a]+=boost[a];}shifts.set(n.id,shift);boosts.set(n.id,boost);}
    }
  }

  systemGravity(positions,masses,G,softening){
    // Shared-system gravity remains full strength; remote systems perturb gently.
    const external=.18,result=gravityAccelerations(positions,masses,G,softening).map(a=>a.map(v=>v*external));
    const addGroup=ids=>{const local=gravityAccelerations(ids.map(i=>positions[i]),ids.map(i=>masses[i]),G,softening);for(let k=0;k<ids.length;k++)for(let a=0;a<3;a++)result[ids[k]][a]+=local[k][a]*(1-external);return local;};
    const starPull=addGroup(this.stellarIndices),starOrder=new Map(this.stellarIndices.map((i,k)=>[i,k]));
    for(const group of this.gravitySystems){
      addGroup(group);const root=group.find(i=>starOrder.has(i)),pull=starPull[starOrder.get(root)];
      // Carry the host's common external acceleration; attenuate only tidal shear.
      for(const i of group)if(i!==root)for(let a=0;a<3;a++)result[i][a]+=pull[a]*(1-external);
    }
    for(const group of this.sharedGravitySystems){
      addGroup(group.members);
      const common=[0,1,2].map(a=>group.hosts.reduce((sum,i)=>sum+starPull[starOrder.get(i)][a],0)/group.hosts.length);
      for(const i of group.members){
        for(let a=0;a<3;a++)result[i][a]+=common[a]*(1-external);
        for(const host of group.hosts){const delta=positions[host].map((v,a)=>v-positions[i][a]),r2=delta.reduce((s,v)=>s+v*v,softening*softening);if(!r2)continue;
          const scale=G*(1-external)/group.hosts.length/(r2*Math.sqrt(r2));for(let a=0;a<3;a++){result[i][a]+=delta[a]*masses[host]*scale;result[host][a]-=delta[a]*masses[i]*scale;}
        }
      }
    }
    return result;
  }

  orbitalClearance(i,host){return this.bodyMinimum(i,host);}

  protectPlanetOrbits(){
    const index=new Map(this.nodes.map((n,i)=>[n.id,i])),shifts=new Map(),boosts=new Map();
    for(const n of this.orbitOrder){
      const orbit=this.orbits[n.id];if(!orbit||orbit.kind==='star')continue;
      const p=this.positions[n.id],v=this.velocities[n.id],oldP=[...p],oldV=[...v],dp=shifts.get(orbit.host),dv=boosts.get(orbit.host);
      for(let a=0;a<3;a++){if(dp)p[a]+=dp[a];if(dv)v[a]+=dv[a];}
      const i=index.get(n.id),host=index.get(orbit.host),q=this.positions[orbit.host],u=this.velocities[orbit.host],delta=p.map((value,a)=>value-q[a]);
      const radius=Math.hypot(...delta),minimum=this.orbitalClearance(i,host),phase=phaseOf(n.id),normal=radius>.001?delta.map(x=>x/radius):[Math.cos(phase),0,Math.sin(phase)];
      // Compact display orbits need bounded radial drift as well as surface clearance.
      const desired=Math.max(minimum,orbit.radius),radial=normal.reduce((sum,x,a)=>sum+(v[a]-u[a])*x,0);
      const correction=(desired-radius)*.002;
      if(!n.isMainTag)for(let a=0;a<3;a++){p[a]+=normal[a]*correction;v[a]-=normal[a]*radial*.04;}
      if(radius<minimum*1.15){
        const radialVelocity=normal.reduce((sum,x,a)=>sum+(v[a]-u[a])*x,0);
        if(radius<minimum)for(let a=0;a<3;a++)p[a]=q[a]+normal[a]*minimum;
        if(radialVelocity<0&&radius<=minimum)for(let a=0;a<3;a++)v[a]-=normal[a]*radialVelocity;
        const currentRadial=normal.reduce((sum,x,a)=>sum+(v[a]-u[a])*x,0);
        const tangent=v.map((x,a)=>x-u[a]-normal[a]*currentRadial),speed=Math.hypot(...tangent),target=.95*Math.sqrt(this.G*(this.masses[i]+this.masses[host])/Math.max(radius,minimum));
        if(speed<target){const axis=orbit.axis,cross=[axis[1]*normal[2]-axis[2]*normal[1],axis[2]*normal[0]-axis[0]*normal[2],axis[0]*normal[1]-axis[1]*normal[0]],length=Math.hypot(...cross)||1,amount=Math.min(target*.08,target-speed);for(let a=0;a<3;a++)v[a]+=(speed>1e-6?tangent[a]/speed:cross[a]/length)*amount;}
      }
      const shift=p.map((x,a)=>x-oldP[a]),boost=v.map((x,a)=>x-oldV[a]);if(shift.some(x=>x!==0))shifts.set(n.id,shift);if(boost.some(x=>x!==0))boosts.set(n.id,boost);
    }
  }

  resolveCollisions(){
    const nodes=this.nodes,positions=nodes.map(n=>this.positions[n.id]);
    const inverse=nodes.map((n,i)=>1/this.masses[i]);
    // Sweep sphere bounds, without the repulsion sampler's neighbour limit.
    for(let pass=0;pass<(nodes.length<=180?128:32);pass++){
      const order=nodes.map((n,i)=>i).sort((i,j)=>(positions[i][0]-11*this.collisionRadii[i])-(positions[j][0]-11*this.collisionRadii[j]));
      let changed=false;
      for(let a=0;a<order.length;a++)for(let b=a+1;b<order.length;b++){
        const i=order[a],j=order[b],p=positions[i],q=positions[j],minimum=this.bodyMinimum(i,j);
        if(q[0]-11*this.collisionRadii[j]>p[0]+11*this.collisionRadii[i])break;
        let delta=q.map((v,axis)=>v-p[axis]),length=Math.hypot(...delta);
        if(length>=minimum-1e-7)continue;
        if(length<1e-8){const phase=phaseOf(nodes[i].id+'|'+nodes[j].id);delta=[Math.cos(phase),0,Math.sin(phase)];length=0;}else delta=delta.map(v=>v/length);
        const total=inverse[i]+inverse[j];if(!total)continue;
        const overlap=minimum-length+1e-6,vi=this.velocities[nodes[i].id],vj=this.velocities[nodes[j].id];
        const closing=delta.reduce((sum,v,axis)=>sum+(vj[axis]-vi[axis])*v,0);
        for(let axis=0;axis<3;axis++){
          p[axis]-=delta[axis]*overlap*inverse[i]/total;q[axis]+=delta[axis]*overlap*inverse[j]/total;
          if(closing<0){vi[axis]+=delta[axis]*closing*inverse[i]/total;vj[axis]-=delta[axis]*closing*inverse[j]/total;}
        }
        changed=true;
      }
      if(!changed)break;
    }
  }

  checkpoint() {
    return Object.fromEntries(
      this.nodes.filter(n=>!n.isMainTag).map((n) => [n.id, [...this.positions[n.id]]]),
    );
  }
}
