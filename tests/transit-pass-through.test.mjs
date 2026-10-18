import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveBodyAvoidance} from '../public/body-avoidance.js';
import {advanceSharedTours,createExteriorTransfer} from '../public/shared-tours.js';
const frame={u:[1,0,0],v:[0,0,1],normal:[0,-1,0]};
function bodies(passThrough){
 const nodes=[{id:'parent',isMainTag:true},{id:'resident'},{id:'transit'}];
 return {nodes,orbitOrder:nodes,positions:{parent:[0,0,0],resident:[12,0,0],transit:[12,0,0]},velocities:{parent:[0,0,0],resident:[0,0,0],transit:[0,0,0]},orbits:{resident:{host:'parent'},transit:{host:'parent'}},collisionRadii:[2,1,1],transferPassThroughIds:new Set(passThrough),bodyAvoidance:new Map([['transit',[4,0,0]]]),bodyMinimum:(i,j)=>[2,1,1][i]+[2,1,1][j]+.02,orbitalClearance:()=>11};
}
test('transit ignores collision correction and residual offsets without displacing residents',()=>{
 const l=bodies(['transit']);resolveBodyAvoidance(l);
 assert.deepEqual(l.positions.resident,[12,0,0]);assert.deepEqual(l.positions.transit,[12,0,0]);
 assert.deepEqual(l.bodyAvoidance.get('transit'),[0,0,0]);assert.equal(l.bodyAvoidanceStats.corrections,0);
});
test('residents retain body separation and parent clearance when the exemption ends',()=>{
 const l=bodies([]);l.bodyAvoidance.clear();resolveBodyAvoidance(l);
 assert.ok(Math.hypot(...l.positions.resident.map((x,k)=>x-l.positions.transit[k]))>=2.02-1e-6);
 for(const id of ['resident','transit'])assert.ok(Math.hypot(...l.positions[id])>=11-1e-6);
 assert.ok(l.bodyAvoidanceStats.corrections>0);
});
