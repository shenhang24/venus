import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTransferDistance,createExteriorTransfer,exteriorTransferPoint,advanceSharedTours,TRANSFER_LINEAR_SPEED} from '../public/shared-tours.js';
import {AffinityLayout} from '../public/layout.js';
const frame={u:[1,0,0],v:[0,0,1],normal:[0,-1,0]},distance=(a,b)=>Math.hypot(...a.map((x,k)=>x-b[k]));
function travel(radius,intervals){
 const r=createExteriorTransfer({start:[10,0,0],velocity:[0,0,.2],center:[0,0,0],frame,radius});r.elapsed=r.duration;r.motionSeconds=1;
 let p=exteriorTransferPoint(r,r.elapsed,[30,0,0],[0,0,0]),total=0,min=Infinity,max=0;
 for(const dt of intervals){const m=advanceTransferDistance(r,p,dt,t=>exteriorTransferPoint(r,t,[30,0,0],[0,0,0]));const v=distance(m.position,p)/dt;min=Math.min(min,v);max=Math.max(max,v);total+=m.travelled;r.elapsed=m.elapsed;p=m.position;}
 return {total,min,max,parameter:r.elapsed};
}
test('world-distance cruise is independent of exterior radius and render frequency',()=>{
 for(const radius of [100,1000,10000])for(const fps of [30,60]){
  const r=travel(radius,Array.from({length:fps*2},()=>1/fps));
  assert.ok(Math.abs(r.total-TRANSFER_LINEAR_SPEED*2)<.001);assert.ok(Math.abs(r.min-TRANSFER_LINEAR_SPEED)<.001);assert.ok(Math.abs(r.max-TRANSFER_LINEAR_SPEED)<.001);
  console.log(JSON.stringify({radius,fps,travelled:r.total,minSpeed:r.min,maxSpeed:r.max}));
 }
});
test('variable delta time and long-running cruise never compound velocity',()=>{
 const steps=Array.from({length:900},(_,i)=>[1/30,1/60,1/45][i%3]),r=travel(1000,steps),expected=steps.reduce((a,b)=>a+b,0)*TRANSFER_LINEAR_SPEED;
 assert.ok(Math.abs(r.total-expected)<.01);assert.ok(r.max-r.min<.001);
});
test('entry speed blends down from incoming speed, never radius-scaled acceleration',()=>{
 const r=createExteriorTransfer({start:[10,0,0],velocity:[.4,0,0],center:[0,0,0],frame,radius:1000});let p=[...r.start],last=Infinity;
 for(let i=0;i<30;i++){const m=advanceTransferDistance(r,p,1/30,t=>exteriorTransferPoint(r,t,[30,0,0],[0,0,0]));assert.ok(m.speed<=last+1e-8);assert.ok(m.speed<=12);last=m.speed;r.elapsed=m.elapsed;p=m.position;}
 assert.ok(Math.abs(last-TRANSFER_LINEAR_SPEED)<1e-9);
});
test('actual shared transit keeps constant speed through obstacles and keeps phase advancing',()=>{
 const route=createExteriorTransfer({start:[20,0,0],velocity:[0,0,.2],center:[0,0,0],frame,radius:1000});route.elapsed=route.duration;route.motionSeconds=1;
 const initial=exteriorTransferPoint(route,route.elapsed,[0,0,50],[0,0,0]);
 const g={id:'shared',index:2,memberIndices:[2],visits:[{host:'a',radius:20,phase:0,frame},{host:'b',radius:20,phase:0,frame}],tour:{stage:'transfer',index:0,angle:0,progress:0,completed:[],roundVisits:1,exterior:route,world:initial},arc:frame.normal};
 const l={nodes:[{id:'a'},{id:'b'},{id:'shared'},{id:'obstacle'}],nodeIndices:new Map([['a',0],['b',1],['shared',2],['obstacle',3]]),coreId:'a',center:[0,0,0],sharedOrbits:[g],positions:{a:[0,0,0],b:[0,0,50],shared:initial,obstacle:[0,0,0]},velocities:{a:[0,0,0],b:[0,0,0],shared:[0,0,.2],obstacle:[0,0,0]},orbits:{shared:{host:'a'}},collisionRadii:[2,2,1,10000],systemExtents:[25,25,1,10000],subtreeMaxRadius:[2,2,1,10000],tourWorldBound:500,orbitalClearance:()=>11};
 for(let i=0;i<60;i++){const before=[...l.positions.shared],angle=g.tour.angle;advanceSharedTours(l,1/30);assert.ok(Math.abs(distance(before,l.positions.shared)*30-TRANSFER_LINEAR_SPEED)<.001);assert.equal(g.tour.blocked,false);assert.ok(l.transferPassThroughIds.has('shared'));assert.ok(g.tour.angle>angle);}
});
test('distance-driven state machine finishes the whole outer lap and docks without a sprint',()=>{
 const route=createExteriorTransfer({start:[20,0,0],velocity:[0,0,.2],center:[0,0,0],frame,radius:40});
 const g={id:'shared',index:2,memberIndices:[2],visits:[{host:'a',radius:20,phase:0,frame},{host:'b',radius:20,phase:0,frame}],tour:{stage:'transfer',index:0,angle:0,progress:0,completed:[],roundVisits:1,exterior:route,world:[20,0,0]},arc:frame.normal};
 const l={nodes:[{id:'a'},{id:'b'},{id:'shared'}],nodeIndices:new Map([['a',0],['b',1],['shared',2]]),coreId:'a',center:[0,0,0],sharedOrbits:[g],positions:{a:[0,0,0],b:[0,0,50],shared:[20,0,0]},velocities:{a:[0,0,0],b:[0,0,0],shared:[0,0,.2]},orbits:{shared:{host:'a'}},collisionRadii:[2,2,1],systemExtents:[25,25,1],subtreeMaxRadius:[2,2,1],tourWorldBound:500,orbitalClearance:()=>11};
 let frames=0,maxSpeed=0;while(g.tour.stage==='transfer'&&frames<8000){const before=[...l.positions.shared];advanceSharedTours(l,1/30);maxSpeed=Math.max(maxSpeed,distance(before,l.positions.shared)*30);frames++;}
 assert.equal(g.tour.stage,'orbit');assert.equal(g.tour.index,1);assert.equal(route.elapsed,2*route.duration+route.lapDuration);assert.ok(maxSpeed<6.001);assert.ok(g.tour.orbitJoin);
 const before=[...l.positions.shared];advanceSharedTours(l,1/30);assert.ok(distance(before,l.positions.shared)<.3);assert.equal(l.transferPassThroughIds.has('shared'),false);
 console.log(JSON.stringify({fullRouteFrames:frames,maxSpeed,docked:true}));
});
test('the actual fixed-step browser clock preserves real-time cruise at 30 and 60 fps',()=>{
 for(const fps of [30,60]){
  const kind='knowledge',nodes=[{id:'a',kind,isMainTag:true,domainConnectionCount:100},{id:'b',kind,isMainTag:true,domainConnectionCount:50},{id:'shared',kind}],edges=[{from:'a',to:'shared',membershipLink:true,strength:1},{from:'b',to:'shared',membershipLink:true,strength:1}],l=new AffinityLayout();l.sync({nodes,edges});l.step();
  const g=l.sharedOrbits[0],r=createExteriorTransfer({start:[20,0,0],velocity:[0,0,.2],center:[0,0,0],frame,radius:1000});r.elapsed=r.duration;r.motionSeconds=1;
  g.tour.stage='transfer';g.tour.exterior=r;g.tour.world=exteriorTransferPoint(r,r.elapsed,[30,0,0],[0,0,0]);l.positions.shared=[...g.tour.world];l.accumulator=0;
  let travelled=0;for(let i=0;i<fps;i++){const p=[...l.positions.shared];l.advance(1/fps);travelled+=distance(p,l.positions.shared);}
  assert.ok(Math.abs(travelled-TRANSFER_LINEAR_SPEED)<.001);console.log(JSON.stringify({actualClockFps:fps,timeScale:l.timeScale,worldDistanceInOneRealSecond:travelled}));
 }
});
