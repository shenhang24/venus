const TOUR_SURFACE_GAP = .02;
const length=a=>Math.hypot(...a);
const minus=(a,b)=>a.map((x,k)=>x-b[k]);
// The entire moving subtree must remain inside its owner's orbital territory.
// A transfer is allowed only when that territory also contains the route.
export function insideSatelliteTerritory(layout,group,position){
  let child=group.id,owner=layout.orbits[child]?.host;
  let reach=layout.systemExtents[group.index];
  while(owner){
    const outer=layout.orbits[owner];
    if(outer){
      const center=layout.positions[owner],primary=layout.positions[outer.host];
      if(center&&primary&&length(minus(position,center))+reach>length(minus(center,primary))-1e-7)return false;
    }
    child=owner;owner=outer?.host;
  }
  return true;
}
const point=(layout,visit,angle)=>layout.positions[visit.host].map((x,k)=>x+visit.radius*(visit.frame.u[k]*Math.cos(visit.phase+angle)+visit.frame.v[k]*Math.sin(visit.phase+angle)));

export function configureSharedTours(layout,frameOf){
  layout.sharedTours||=new Map();
  const groups=layout.sharedOrbits,byHost=new Map();
  for(const group of groups){
    group.visits=[];
    for(const host of [...group.hosts].sort((a,b)=>layout.nodes[a].id.localeCompare(layout.nodes[b].id))){
      if(!byHost.has(host))byHost.set(host,[]);byHost.get(host).push(group);
    }
  }
  for(const [host,visitors]of byHost){
    visitors.sort((a,b)=>a.id.localeCompare(b.id));
    const base=layout.systemExtents[host],maxExtent=Math.max(...visitors.map(g=>layout.systemExtents[g.index])),size=Math.max(layout.subtreeMaxRadius[host],...visitors.map(g=>layout.subtreeMaxRadius[g.index]));
    let previous=base+maxExtent+TOUR_SURFACE_GAP;
    for(let rank=0;rank<visitors.length;rank++){
      const shell=Math.floor((Math.sqrt(1+4*rank/3)-1)/2),start=3*shell*(shell+1),slots=6*(shell+1);
      // The straight segment between animation frames cuts slightly inside a
      // circle; reserve that chord sagitta without restoring a large gap.
      const radius=Math.max(previous,(2*maxExtent+TOUR_SURFACE_GAP)/(2*Math.sin(Math.PI/slots)))*1.001;
      visitors[rank].visits.push({host:layout.nodes[host].id,radius,phase:(rank-start)*Math.PI*2/slots,frame:frameOf(layout.membershipPlaneKeys.get(visitors[rank].id)||layout.nodes[host].id+':visits')});
      if(rank===start+slots-1)previous=radius+2*maxExtent+TOUR_SURFACE_GAP;
      layout.systemExtents[host]=Math.max(layout.systemExtents[host],radius+maxExtent);
    }
    layout.subtreeMaxRadius[host]=size;
  }
  for(const group of groups){
    group.visits.sort((a,b)=>a.host.localeCompare(b.host));
    const key=group.visits.map(v=>v.host).join('|');
    let state=layout.sharedTours.get(group.id);
    if(!state||state.key!==key){state={key,index:group.visits.findIndex(v=>v.host===layout.orbits[group.id].host),angle:0,progress:0,stage:'idle',completed:[],world:null,lastStarted:0,roundVisits:0};layout.sharedTours.set(group.id,state);}
    group.tour=state;group.arc=frameOf('transfer:'+group.id).normal;
    group.memberIndices=layout.nodes.map((n,i)=>{
      let id=n.id;while(layout.orbits[id]&&!layout.sharedOrbitIds.has(id))id=layout.orbits[id].host;
      return id===group.id?i:-1;
    }).filter(i=>i>=0);
  }
  for(const id of layout.sharedTours.keys())if(!layout.sharedOrbitIds.has(id))layout.sharedTours.delete(id);
}

// Spatial occupancy is a display geometry check, not a physical force.
class Occupancy{
  constructor(entries){this.entries=new Map();this.cells=new Map();this.cell=32;this.maximum=0;for(const entry of entries)this.add(entry);}
  key(p){return p.map(x=>Math.floor(x/this.cell)).join(',');}
  add(entry){this.entries.set(entry.id,entry);this.maximum=Math.max(this.maximum,entry.radius+TOUR_SURFACE_GAP);const key=this.key(entry.position);entry.cell=key;if(!this.cells.has(key))this.cells.set(key,new Set());this.cells.get(key).add(entry.id);}
  remove(id){const e=this.entries.get(id);if(e){this.cells.get(e.cell)?.delete(id);this.entries.delete(id);}}
  near(position,reach){
    const r=reach+this.maximum,lo=position.map(x=>Math.floor((x-r)/this.cell)),hi=position.map(x=>Math.floor((x+r)/this.cell));
    if((hi[0]-lo[0]+1)*(hi[1]-lo[1]+1)*(hi[2]-lo[2]+1)>this.entries.size)return this.entries.values();
    const result=[];for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++)for(const id of this.cells.get([x,y,z].join(','))||[])result.push(this.entries.get(id));return result;
  }
  blocked(start,end,radius,size){
    const delta=minus(end,start),d2=delta.reduce((s,x)=>s+x*x,0),middle=start.map((x,k)=>(x+end[k])/2);
    for(const e of this.near(middle,radius+TOUR_SURFACE_GAP+Math.sqrt(d2)/2)){
      const t=d2?Math.max(0,Math.min(1,e.position.reduce((s,x,k)=>s+(x-start[k])*delta[k],0)/d2)):0;
      if(length(e.position.map((x,k)=>x-start[k]-delta[k]*t))<radius+e.radius+TOUR_SURFACE_GAP+(e.margin||0)-1e-7)return true;
    }
    return false;
  }
  recover(position,radius,size){
    const p=[...position];
    for(let pass=0;pass<32;pass++){
      let changed=false;
      for(const e of this.near(p,radius+TOUR_SURFACE_GAP)){
        const d=minus(p,e.position),distance=length(d),minimum=radius+e.radius+TOUR_SURFACE_GAP+(e.margin||0)+1e-5;
        if(distance<minimum){const direction=distance>1e-8?d.map(x=>x/distance):[0,1,0];for(let k=0;k<3;k++)p[k]+=direction[k]*(minimum-distance);changed=true;}
      }
      if(!changed)break;
    }
    return p;
  }
}

export function advanceSharedTours(layout){
  if(!layout.sharedOrbits.length)return;
  let active=layout.sharedOrbits.filter(g=>g.tour.stage!=='idle').length;
  for(const g of [...layout.sharedOrbits].filter(g=>g.tour.stage==='idle').sort((a,b)=>a.tour.lastStarted-b.tour.lastStarted||a.id.localeCompare(b.id))){
    if(active>=12)break;const s=g.tour;s.stage='approach';s.index=Math.max(0,g.visits.findIndex(v=>v.host===layout.orbits[g.id].host));s.angle=0;s.progress=0;s.roundVisits=0;s.lastStarted=layout.tourDispatchCounter=(layout.tourDispatchCounter||0)+1;active++;
  }
  const moving=new Set(layout.sharedOrbits.flatMap(g=>g.memberIndices)),entries=[];
  layout.tourObstaclePrevious||=new Map();
  for(let i=0;i<layout.nodes.length;i++)if(!moving.has(i)){
    const id=layout.nodes[i].id,p=layout.positions[id],previous=layout.tourObstaclePrevious.get(id),margin=previous?length(minus(p,previous))*3:0;
    entries.push({id,position:p,radius:layout.collisionRadii[i],size:layout.collisionRadii[i],margin:0});layout.tourObstaclePrevious.set(id,[...p]);
  }
  for(const g of layout.sharedOrbits){const s=g.tour,host=layout.positions[g.visits[s.index].host];if(s.world&&s.stage!=='transfer'&&s.hostPosition)s.world=s.world.map((x,k)=>x+host[k]-s.hostPosition[k]);s.hostPosition=[...host];entries.push({id:g.id,position:s.world||layout.positions[g.id],radius:layout.systemExtents[g.index],size:layout.subtreeMaxRadius[g.index]});}
  const occupancy=new Occupancy(entries);
  for(const g of [...layout.sharedOrbits].sort((a,b)=>a.id.localeCompare(b.id))){
    const s=g.tour,visit=g.visits[s.index],radius=layout.systemExtents[g.index],size=layout.subtreeMaxRadius[g.index],original=[...layout.positions[g.id]];
    if(s.stage==='idle')continue;
    let start=s.world||original,goal,nextAngle=s.angle,nextProgress=s.progress;
    if(!insideSatelliteTerritory(layout,g,start)){start=original;s.world=null;s.stage='approach';s.progress=0;}
    occupancy.remove(g.id);
    if(occupancy.blocked(start,start,radius,size)){const recovered=occupancy.recover(start,radius,size);if(insideSatelliteTerritory(layout,g,recovered))start=recovered;}
    if(s.stage==='orbit'){nextAngle=Math.min(Math.PI*2,s.angle+.012);goal=point(layout,visit,nextAngle);}
    else if(s.stage==='transfer'){
      const destination=g.visits[(s.index+1)%g.visits.length],a=point(layout,visit,Math.PI*2),b=point(layout,destination,0);
      nextProgress=Math.min(1,s.progress+1/180);const t=nextProgress*nextProgress*(3-2*nextProgress),height=length(minus(b,a))*.3+radius*8;
      goal=a.map((x,k)=>x*(1-t)+b[k]*t+g.arc[k]*height*Math.sin(Math.PI*t)**2);
    }else goal=s.stage==='home'?original:point(layout,visit,0);
    const nextVisit=g.visits[(s.index+1)%g.visits.length],hostMotion=Math.max(length(layout.velocities[visit.host]||[0,0,0]),length(layout.velocities[nextVisit.host]||[0,0,0]));
    const delta=minus(goal,start),distance=length(delta),maxStep=Math.max(size*.2+hostMotion*2+visit.radius*.018,distance/8,.01);
    const within=p=>length(minus(p,layout.center||[0,0,0]))<=layout.tourWorldBound&&insideSatelliteTerritory(layout,g,p);
    let candidate=start.map((x,k)=>x+delta[k]*Math.min(1,maxStep/(distance||1))),accepted=within(candidate)&&!occupancy.blocked(start,candidate,radius,size);
    if(!accepted){
      // Go round a blocked corridor, keeping bounded continuous steps; otherwise wait.
      const directions=[g.arc,g.arc.map(x=>-x),visit.frame.u,visit.frame.u.map(x=>-x),visit.frame.v,visit.frame.v.map(x=>-x)];
      for(const direction of directions){const trial=start.map((x,k)=>x+direction[k]*maxStep);if(within(trial)&&!occupancy.blocked(start,trial,radius,size)){candidate=trial;accepted=true;break;}}
    }
    if(!accepted)candidate=start;
    s.blocked=!accepted;s.world=candidate;
    const arrived=length(minus(candidate,goal))<1e-5;
    if(arrived){
      if(s.stage==='approach'){s.stage='orbit';s.angle=0;}
      else if(s.stage==='orbit'){s.angle=nextAngle;if(s.angle>=Math.PI*2){s.completed.push(visit.host);s.roundVisits++;s.completed=s.completed.slice(-g.visits.length*3);s.stage='transfer';s.progress=0;}}
      else if(s.stage==='home'){s.stage='idle';s.world=null;}
      else{s.progress=nextProgress;if(s.progress>=1){s.index=(s.index+1)%g.visits.length;s.angle=0;s.stage=s.roundVisits>=g.visits.length?'home':'orbit';s.progress=0;s.hostPosition=[...layout.positions[g.visits[s.index].host]];}}
    }
    const shift=minus(candidate,original);
    for(const i of g.memberIndices){const id=layout.nodes[i].id;layout.positions[id]=layout.positions[id].map((x,k)=>x+shift[k]);}
    occupancy.add({id:g.id,position:candidate,radius,size});
  }
}
