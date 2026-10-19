import test from 'node:test';import assert from 'node:assert/strict';
import {branchVisibility,aggregateDisplayRadius,radiusTransition} from '../public/branch-visibility.js';
import {buildMainTagGraph,displayedRadius} from '../public/main-tags.js';
import {AffinityLayout} from '../public/layout.js';
import {VAULT_HEAT_LEVELS,vaultActivityHeat} from '../public/vault-heat.js';
import {NetworkAnimationClock} from '../public/animation-clock.js';
test('all four networks collapse descendants, retain loose bodies, expand only the chosen branch',()=>{
 for(const kind of ['vault','knowledge','concept','skill']){
  const nodes=[{id:'A',isMainTag:true,kind},{id:'B',isMainTag:true,kind},...['a','b','c','loose'].map(id=>({id,kind}))],edges=[{from:'A',to:'a',membershipLink:true},{from:'A',to:'b',membershipLink:true},{from:'A',to:'b',membershipLink:true},{from:'B',to:'c',membershipLink:true}],orbits={a:{host:'A'},b:{host:'a'},c:{host:'B'},B:{host:'A'}};
  const overview=branchVisibility(nodes,edges,orbits);assert.deepEqual([...overview.visibleIds].sort(),['A','B','loose']);assert.equal(overview.aggregateCounts.get('A'),2);
  const selected=branchVisibility(nodes,edges,orbits,'A');assert.ok(selected.visibleIds.has('a')&&selected.visibleIds.has('b'));assert.ok(!selected.visibleIds.has('c'));assert.ok(!selected.aggregateCounts.has('A'));assert.equal(selected.aggregateCounts.get('B'),1);
  const found=branchVisibility(nodes,edges,orbits,'b');assert.ok(found.visibleIds.has('a')&&found.visibleIds.has('b'));assert.ok(!found.visibleIds.has('c'));assert.equal(branchVisibility(nodes,edges,orbits).visibleIds.size,3);
 }
});
test('collapsed volume is uncapped, detail cap and physical layout remain unchanged',()=>{
 const node={id:'core',isMainTag:true,domainConnectionCount:10000},settings={baseRadius:2,growth:.01};
 assert.ok(aggregateDisplayRadius(2,10000)>2*Math.cbrt(10));assert.ok(displayedRadius(node,settings)<=2*Math.cbrt(10));
 const layout=new AffinityLayout();layout.sync({nodes:[node],edges:[],...settings});const before=layout.collisionRadii[0];aggregateDisplayRadius(2,10000);assert.equal(layout.collisionRadii[0],before);
 assert.deepEqual(radiusTransition(10,2,450),{radius:2,done:true});assert.equal(radiusTransition(10,2,225).radius,6);
});
test('hidden orbital positions, velocities, tour state and clocks freeze; resume advances only one frame',()=>{
 const source=[{id:'a',kind:'knowledge',mainTags:[{name:'音乐'}]},{id:'b',kind:'knowledge',mainTags:[{name:'游戏'}]}],graph=buildMainTagGraph(source,[]),layout=new AffinityLayout();layout.sync({...graph,seeds:graph.positions});
 const cores=graph.nodes.filter(n=>n.isMainTag).map(n=>n.id);layout.setActiveNodes(new Set(cores));layout.step();
 const p=[...layout.positions.a],b=[...layout.positions.b],v=[...layout.velocities.a],clock={...layout.visibilityClocks.get('a')};for(let i=0;i<80;i++)layout.step();
 assert.deepEqual(layout.positions.a,p);assert.deepEqual(layout.velocities.a,v);assert.deepEqual(layout.visibilityClocks.get('a'),clock);
 layout.setActiveNodes(new Set([...cores,'a']));layout.lockPlanetOrbits({advance:false});assert.equal(layout.visibilityClocks.get('a').angle,clock.angle);layout.step();assert.ok(Math.abs(layout.visibilityClocks.get('a').angle-clock.angle)<.1);assert.deepEqual(layout.positions.b,b);
 assert.ok(layout.activeNodes.every(n=>cores.includes(n.id)||n.id==='a'));assert.equal(layout.activeAvoidance.nodes.length,cores.length+1);
});
test('Vault alone has thirteen stable evidence-based colors and designated priority stays gold',()=>{
 assert.equal(VAULT_HEAT_LEVELS.length,13);assert.equal(new Set(VAULT_HEAT_LEVELS.map(h=>h.color)).size,13);
 const examples=[[0,1,1],[2,1,1],[3,1,1],[4,1,1],[5,1,1],[6,1,1],[3,2,1],[5,2,1],[5,3,1],[6,3,1],[8,3,1],[12,4,1],[16,5,1]];
 assert.deepEqual(examples.map(([userTurns,activeDays,sourceConversations])=>vaultActivityHeat({userTurns,activeDays,sourceConversations}).level),examples.map((_,i)=>i));
 assert.equal(vaultActivityHeat({basis:'user-project',userTurns:0}).level,12);
});
test('nested satellites and shared tours remain dormant, including while selection changes under pause',()=>{
 const nodes=[{id:'sun',kind:'concept',isMainTag:true,domainConnectionCount:1000},{id:'planet',kind:'concept',isMainTag:true,domainConnectionCount:10},...['moon','submoon','shared'].map(id=>({id,kind:'concept'}))],edges=[{from:'planet',to:'moon',membershipLink:true,strength:1},{from:'moon',to:'submoon',type:'contains',sources:[{quote:'Explicit synthetic hierarchy'}]},{from:'sun',to:'shared',membershipLink:true,strength:1},{from:'planet',to:'shared',membershipLink:true,strength:1}],layout=new AffinityLayout();layout.sync({nodes,edges});
 const visible=branchVisibility(nodes,edges,layout.orbits);layout.setActiveNodes(visible.visibleIds);const frozen=structuredClone(layout.positions),tours=JSON.stringify([...layout.sharedTours||[]]);for(let i=0;i<30;i++)layout.step();for(const id of ['moon','submoon','shared'])assert.deepEqual(layout.positions[id],frozen[id]);assert.equal(JSON.stringify([...layout.sharedTours||[]]),tours);
 const clock=new NetworkAnimationClock(0,true),before=layout.steps;layout.setActiveNodes(branchVisibility(nodes,edges,layout.orbits,'submoon').visibleIds);layout.lockPlanetOrbits({advance:false});if(!clock.paused)layout.advance(clock.sample(90000));assert.equal(layout.steps,before);assert.equal(clock.paused,true);assert.ok(layout.activeIds.has('moon')&&layout.activeIds.has('submoon'));assert.ok(!layout.activeIds.has('shared'));
 clock.setPaused(false,90000);layout.advance(clock.sample(90016));assert.ok(layout.steps-before<2);assert.ok(layout.positions.submoon.every(Number.isFinite));
});
