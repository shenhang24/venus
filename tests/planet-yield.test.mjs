import test from 'node:test';
import assert from 'node:assert/strict';
import {AffinityLayout} from '../public/layout.js';
for(const kind of ['vault','knowledge','skill','concept'])test(kind+' same-ring planet clocks share speed while different rings remain asynchronous',()=>{
 const nodes=[{id:'sun',kind,isMainTag:true,domainConnectionCount:10000},...Array.from({length:20},(_,i)=>({id:'planet-'+((i+1)*2654435761>>>0).toString(36),kind,isMainTag:true,domainConnectionCount:100-i}))];
 const layout=new AffinityLayout();layout.sync({nodes,edges:[]});layout.step();
 const planets=nodes.slice(1),preferred=new Map(planets.map(n=>[n.id,layout.orbits[n.id].preferredAngularVelocity]));
 assert.ok(new Set(preferred.values()).size>1);
 for(let step=0;step<12000;step++){
  const angles=new Map(planets.map(n=>[n.id,layout.orbits[n.id].phase+layout.orbitClocks.get(JSON.stringify(['sun','planet:'+n.id,0])).angle]));layout.step();
  for(const n of planets){const o=layout.orbits[n.id],p=layout.positions[n.id].map((v,k)=>v-layout.positions.sun[k]);
   assert.ok(o.angularVelocity>0);assert.ok(o.lockAngle<angles.get(n.id));assert.ok(angles.get(n.id)-o.lockAngle<.004);
   assert.ok(Math.abs(Math.hypot(...p)-o.targetRadius)<1e-6);assert.ok(Math.abs(p.reduce((s,v,k)=>s+v*o.frame.normal[k],0))<1e-6);
   assert.equal(o.preferredAngularVelocity,preferred.get(n.id));assert.equal(o.angularVelocity,o.preferredAngularVelocity);
  }
  for(let i=0;i<planets.length;i++)for(let j=i+1;j<planets.length;j++){const a=planets[i].id,b=planets[j].id;if(layout.orbits[a].ring!==layout.orbits[b].ring){assert.notEqual(layout.orbits[a].angularVelocity,layout.orbits[b].angularVelocity);continue;}assert.equal(layout.orbits[a].angularVelocity,layout.orbits[b].angularVelocity);
   const gap=Math.hypot(...layout.positions[a].map((v,k)=>v-layout.positions[b][k]))-layout.systemExtents[layout.nodeIndices.get(a)]-layout.systemExtents[layout.nodeIndices.get(b)];assert.ok(gap>=.02-1e-6,'group surface clearance');
  }
  if(step===6000)layout.sync({nodes:nodes.map(n=>({...n,sources:[{id:'metadata'}]})),edges:[]});
 }

});

for(const kind of ['vault','knowledge','skill','concept'])test(kind+' nested satellite rings share local speed without locking different rings',()=>{
 const nodes=[{id:'sun',kind,isMainTag:true,domainConnectionCount:1000},{id:'planet',kind,isMainTag:true,domainConnectionCount:100},...Array.from({length:60},(_,i)=>({id:'moon'+i,kind})),...Array.from({length:20},(_,i)=>({id:'sub'+i,kind}))];
 const edges=nodes.slice(2).map(n=>({from:n.id.startsWith('sub')?'moon0':'planet',to:n.id,membershipLink:!n.id.startsWith('sub'),type:'contains',strength:1,sources:[{quote:'synthetic nested orbit'}]}));
 const l=new AffinityLayout();l.sync({nodes,edges});
 for(let i=0;i<20;i++)l.step();
 const groups=new Map();for(const n of nodes){const o=l.orbits[n.id];if(!o||o.kind==='planet'||o.kind==='star')continue;const key=JSON.stringify([o.host,o.localShell]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);}
 assert.ok([...groups.values()].some(g=>g.length>1));
 for(const group of groups.values())for(const o of group)assert.equal(o.angularVelocity,group[0].angularVelocity);
 const hosts=new Map();for(const group of groups.values()){const o=group[0];if(!hosts.has(o.host))hosts.set(o.host,[]);hosts.get(o.host).push(o);}
 assert.ok([...hosts.values()].some(g=>g.length>1));
 for(const rings of hosts.values())assert.equal(new Set(rings.map(o=>o.angularVelocity)).size,rings.length);
});
