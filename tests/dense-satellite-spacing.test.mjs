import test from 'node:test';import assert from 'node:assert/strict';import {AffinityLayout,orbitSweepDistance} from '../public/layout.js';
for(const kind of ['vault','knowledge','skill'])test(kind+' dense Fibonacci satellite rows do not inflate exponentially and retain real pair clearance',()=>{
 const nodes=[{id:'sun',kind,isMainTag:true,domainConnectionCount:10000},{id:'host',kind,isMainTag:true,domainConnectionCount:100},...Array.from({length:700},(_,i)=>({id:'n'+String(i).padStart(4,'0'),kind}))],edges=nodes.slice(2).map(n=>({from:'host',to:n.id,membershipLink:true,strength:1})),l=new AffinityLayout();l.sync({nodes,edges});
 assert.ok(Math.max(...nodes.slice(2).map(n=>l.orbits[n.id].targetRadius))<10000);const ids=nodes.slice(2).map(n=>l.nodeIndices.get(n.id));
 for(let step=0;step<25;step++){l.step();for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const a=ids[i],b=ids[j],p=l.positions[nodes[a].id],q=l.positions[nodes[b].id];assert.ok(Math.hypot(...p.map((x,k)=>x-q[k]))>=l.bodyMinimum(a,b)-1e-6);}}
});
