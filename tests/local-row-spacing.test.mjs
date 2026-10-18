import test from 'node:test';import assert from 'node:assert/strict';
import {AffinityLayout,LOCAL_ROW_REACH_MULTIPLIER} from '../public/layout.js';
for(const kind of ['vault','knowledge','skill'])test(kind+' row gaps propagate preceding local centre reach, never cumulative radius',()=>{
 const nodes=[],edges=[];
 for(const [rank,count]of [100,40,12,2,1].entries()){
  const id=rank===0?'sun':'p'+rank;nodes.push({id,kind,isMainTag:true,domainConnectionCount:1000-rank});
  for(let i=0;i<count;i++){const child=id+'-child'+i;nodes.push({id:child,kind});edges.push({from:id,to:child,membershipLink:true,strength:1});}
 }
 const l=new AffinityLayout();l.sync({nodes,edges});const rows=new Map();
 for(const n of nodes){const o=l.orbits[n.id];if(o?.kind==='planet'){if(!rows.has(o.ring))rows.set(o.ring,[]);rows.get(o.ring).push(n.id);}}
 let previousRadius=0,reach=l.satelliteCenterExtents[l.nodeIndices.get('sun')],envelope=l.collisionRadii[l.nodeIndices.get('sun')];const data=[];
 for(const ids of rows.values()){
  const o=l.orbits[ids[0]],nextEnvelope=Math.max(...ids.map(id=>l.collisionRadii[l.nodeIndices.get(id)]));
  assert.equal(LOCAL_ROW_REACH_MULTIPLIER,1.15);assert.equal(o.rowBaselineGap,1.15*reach);assert.ok(o.rowActualGap>=1.15*reach-1e-7);assert.ok(o.rowActualGap>=envelope+nextEnvelope+.02-1e-7);
  assert.equal(o.rowActualGap,o.targetRadius-previousRadius);
  data.push({localR:reach,baselineGap:o.rowBaselineGap,actualGap:o.rowActualGap,radius:o.targetRadius});
  previousRadius=o.targetRadius;reach=Math.max(...ids.map(id=>l.satelliteCenterExtents[l.nodeIndices.get(id)]));envelope=nextEnvelope;
 }
 for(let i=1;i<data.length;i++)assert.ok(data[i].baselineGap<data[i-1].baselineGap);
 console.log(JSON.stringify({kind,rows:data}));
});
