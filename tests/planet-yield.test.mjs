import test from 'node:test';
import assert from 'node:assert/strict';
import {AffinityLayout} from '../public/layout.js';
for(const kind of ['vault','knowledge','skill'])test(kind+' independent planet clocks yield continuously on fixed coplanar rings',()=>{
 const nodes=[{id:'sun',kind,isMainTag:true,domainConnectionCount:10000},...Array.from({length:20},(_,i)=>({id:'planet-'+((i+1)*2654435761>>>0).toString(36),kind,isMainTag:true,domainConnectionCount:100-i}))];
 const layout=new AffinityLayout();layout.sync({nodes,edges:[]});layout.step();
 const planets=nodes.slice(1),preferred=new Map(planets.map(n=>[n.id,layout.orbits[n.id].preferredAngularVelocity]));
 assert.ok(new Set(preferred.values()).size>10);let yielded=false;
 for(let step=0;step<12000;step++){
  const angles=new Map(planets.map(n=>[n.id,layout.orbits[n.id].phase+layout.orbitClocks.get(JSON.stringify(['sun','planet:'+n.id,0])).angle]));layout.step();
  for(const n of planets){const o=layout.orbits[n.id],p=layout.positions[n.id].map((v,k)=>v-layout.positions.sun[k]);
   assert.ok(o.angularVelocity>0);assert.ok(o.lockAngle<angles.get(n.id));assert.ok(angles.get(n.id)-o.lockAngle<.004);
   assert.ok(Math.abs(Math.hypot(...p)-o.targetRadius)<1e-6);assert.ok(Math.abs(p.reduce((s,v,k)=>s+v*o.frame.normal[k],0))<1e-6);
   assert.equal(o.preferredAngularVelocity,preferred.get(n.id));if(o.angularVelocity<o.preferredAngularVelocity*.99)yielded=true;
  }
  for(let i=0;i<planets.length;i++)for(let j=i+1;j<planets.length;j++){const a=planets[i].id,b=planets[j].id;if(layout.orbits[a].ring!==layout.orbits[b].ring)continue;
   const gap=Math.hypot(...layout.positions[a].map((v,k)=>v-layout.positions[b][k]))-layout.systemExtents[layout.nodeIndices.get(a)]-layout.systemExtents[layout.nodeIndices.get(b)];assert.ok(gap>=.02-1e-6,'group surface clearance');
  }
  if(step===6000)layout.sync({nodes:nodes.map(n=>({...n,sources:[{id:'metadata'}]})),edges:[]});
 }
 assert.ok(yielded,'catch-up temporarily constrains actual speed');
});
