import test from 'node:test';import assert from 'node:assert/strict';import {AffinityLayout,KNOWLEDGE_LAYERS_PER_PLANE,orbitSweepDistance} from '../public/layout.js';
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const fixture=count=>{const nodes=[{id:'sun',kind:'knowledge',isMainTag:true,domainConnectionCount:count},...Array.from({length:count},(_,i)=>({id:'n'+String(i).padStart(4,'0'),kind:'knowledge'}))];return {nodes,edges:nodes.slice(1).map(n=>({from:'sun',to:n.id,type:'@semantic',membershipLink:true,strength:1}))};};
test('knowledge satellites restore six-based capacity and nine-row planes',()=>{
 const l=new AffinityLayout(),input=fixture(815);l.sync(input);const rows=new Map();for(const o of Object.values(l.orbits)){assert.ok(o.radialLayer>=0&&o.radialLayer<KNOWLEDGE_LAYERS_PER_PLANE);assert.equal(o.planePage,Math.floor(o.globalRow/9));rows.set(o.globalRow,(rows.get(o.globalRow)||0)+1);}
 assert.deepEqual([...rows.values()].slice(0,10),[6,12,18,24,30,36,42,48,54,6]);assert.ok(Math.max(...rows.keys())>9);assert.notDeepEqual(l.orbits.n0000.frame.normal,l.orbits.n0270.frame.normal);
 for(let step=0;step<10;step++){l.step();for(const n of input.nodes)assert.ok(l.positions[n.id].every(Number.isFinite));}
});
test('cross-plane sweep clearance is bounded analytically and survives time sampling',()=>{
 const l=new AffinityLayout(),input=fixture(290);l.sync(input);for(let i=1;i<input.nodes.length;i++)for(let j=i+1;j<input.nodes.length;j++){const a=l.orbits[input.nodes[i].id],b=l.orbits[input.nodes[j].id];if(a.planeKey===b.planeKey)continue;assert.ok(orbitSweepDistance(a,a.targetRadius,b,b.targetRadius)>=l.bodyMinimum(i,j)-1e-6);}
 for(let t=0;t<120;t++){l.step();for(let i=1;i<20;i++)for(let j=271;j<input.nodes.length;j++)assert.ok(distance(l.positions[input.nodes[i].id],l.positions[input.nodes[j].id])>=l.bodyMinimum(i,j)-1e-6);}
});
test('planet and satellite directions change relative to their own centres while spin stays disabled',()=>{
 const nodes=[{id:'sun',kind:'knowledge',isMainTag:true,domainConnectionCount:1000},{id:'planet',kind:'knowledge',isMainTag:true,domainConnectionCount:10},{id:'moon',kind:'knowledge'},{id:'submoon',kind:'knowledge'}],edges=[{from:'planet',to:'moon',membershipLink:true,strength:1},{from:'moon',to:'submoon',type:'contains',strength:1,sources:[{quote:'synthetic hierarchy'}]}],l=new AffinityLayout();l.sync({nodes,edges});l.step();const delta=id=>l.positions[id].map((v,k)=>v-l.positions[l.orbits[id].host][k]);const before=Object.fromEntries(['planet','moon','submoon'].map(id=>[id,delta(id)])),spin=l.spinAngle('sun');for(let t=0;t<180;t++)l.step();for(const id of Object.keys(before))assert.ok(distance(delta(id),before[id])>Math.hypot(...before[id])*.2);assert.equal(l.spinAngle('sun'),spin);
});
