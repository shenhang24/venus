import test from 'node:test';import assert from 'node:assert/strict';
import {AffinityLayout} from '../public/layout.js';
for(const kind of ['vault','knowledge','skill'])test(kind+' compact overlapping groups retain continuous clocks and avoid body penetration',()=>{
 const nodes=[],edges=[];for(const [rank,count]of [100,40,12,2,1].entries()){
  const id=rank===0?'sun':'p'+rank;nodes.push({id,kind,isMainTag:true,domainConnectionCount:1000-rank});
  for(let i=0;i<count;i++){const child=id+'-child'+i;nodes.push({id:child,kind});edges.push({from:id,to:child,membershipLink:true,strength:1});}
 }
 const l=new AffinityLayout();l.sync({nodes,edges});const identity=JSON.stringify(nodes.map(n=>n.id)),rows=[...new Map(Object.values(l.orbits).filter(o=>o.kind==='planet').map(o=>[o.ring,o.rowActualGap])).values()];let maxStep=0,maxOffset=0,maxVelocityChange=0;
 for(let step=0;step<100;step++){
  const previous=structuredClone(l.positions),velocities=structuredClone(l.velocities),angles=new Map(nodes.map(n=>[n.id,l.orbits[n.id]?.lockAngle]));l.step();assert.ok(l.bodyAvoidanceStats.converged);
  for(let i=0;i<nodes.length;i++){
   const id=nodes[i].id,p=l.positions[id],o=l.orbits[id];assert.ok(p.every(Number.isFinite));
   if(o){assert.ok(Math.hypot(...p.map((x,k)=>x-l.positions[o.host][k]))>=l.orbitalClearance(i,l.nodeIndices.get(o.host))-1e-5);if(step)assert.ok(o.lockAngle<angles.get(id),'clock advances without phase reset');}
   maxOffset=Math.max(maxOffset,Math.hypot(...l.bodyAvoidance.get(id)));
   if(step){maxStep=Math.max(maxStep,Math.hypot(...p.map((x,k)=>x-previous[id][k])));if(step>1)maxVelocityChange=Math.max(maxVelocityChange,Math.hypot(...l.velocities[id].map((x,k)=>x-velocities[id][k])));}
   for(let j=i+1;j<nodes.length;j++){
    const q=l.positions[nodes[j].id];assert.ok(Math.hypot(...p.map((x,k)=>x-q[k]))>=l.bodyMinimum(i,j)-1e-5);
    if(step){const start=previous[id].map((x,k)=>x-previous[nodes[j].id][k]),end=p.map((x,k)=>x-q[k]),v=end.map((x,k)=>x-start[k]),v2=v.reduce((s,x)=>s+x*x,0),t=v2?Math.max(0,Math.min(1,-start.reduce((s,x,k)=>s+x*v[k],0)/v2)):0;
     assert.ok(Math.hypot(...start.map((x,k)=>x+t*v[k]))>=l.collisionRadii[i]+l.collisionRadii[j]-1e-5,'no swept sphere penetration');}
   }
  }
 }
 assert.equal(JSON.stringify(l.nodes.map(n=>n.id)),identity);assert.ok(maxStep<1);assert.ok(maxVelocityChange<1);
 console.log(JSON.stringify({kind,rows,maxStep,maxVelocityChange,maxLocalOffset:maxOffset,overlapPairFrames:0,parentGapViolations:0}));
});
