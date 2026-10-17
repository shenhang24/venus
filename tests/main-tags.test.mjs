import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {Store} from '../src/store.mjs';
import {AffinityLayout} from '../public/layout.js';
import {buildMainTagGraph,matchesMainTag,effectiveDegrees,displayedRadius,mainTagHeat} from '../public/main-tags.js';

test('music and game domains overlap without hiding cross-domain edges in all three networks',()=>{
  for(const kind of ['vault','knowledge','skill']){
    const nodes=[{id:'learn',kind,mainTags:[{name:'音乐'}]},{id:'score',kind,mainTags:[{name:'音乐'},{name:'游戏'}]},{id:'art',kind,mainTags:[{name:'美术'}]}];
    const edges=[{from:'score',to:'art',type:'related',strength:.6}],before=JSON.stringify(nodes);
    const grouped=buildMainTagGraph(nodes,edges);
    assert.deepEqual(nodes.filter(n=>matchesMainTag(n,'音乐')).map(n=>n.id),['learn','score']);
    assert.deepEqual(nodes.filter(n=>matchesMainTag(n,'游戏')).map(n=>n.id),['score']);
    assert.equal(grouped.nodes.filter(n=>n.isMainTag).length,3);
    assert.ok(grouped.edges.includes(edges[0]));
    assert.equal(JSON.stringify(nodes),before);
  }
});
test('main domains never connect to each other, while membership and cross-domain content links remain',()=>{
  for(const kind of ['vault','knowledge','skill']){
    const nodes=[{id:'a',kind,mainTags:[{name:'音乐'}]},{id:'b',kind,mainTags:[{name:'游戏'}]}];
    const music='@main:'+kind+':音乐',game='@main:'+kind+':游戏';
    const cross={from:'a',to:'b',type:'related'};
    const graph=buildMainTagGraph(nodes,[cross,{from:music,to:game,type:'related'},{from:game,to:music,type:'@semantic'}]);
    const cores=new Set(graph.nodes.filter(n=>n.isMainTag).map(n=>n.id));
    assert.ok(graph.edges.every(e=>!(cores.has(e.from)&&cores.has(e.to))));
    assert.ok(graph.edges.includes(cross));
    assert.equal(graph.edges.filter(e=>e.membershipLink).length,2);
    assert.equal(effectiveDegrees(graph.edges)[music],1);
  }
});

test('an explicit central restart begins every star and domain at the same origin, then separates naturally',()=>{
  const nodes=[{id:'a',kind:'knowledge',mainTags:[{name:'音乐'}]},{id:'b',kind:'knowledge',mainTags:[{name:'游戏'}]}];
  const graph=buildMainTagGraph(nodes,[],{a:[0,0,0],b:[0,0,0]});
  const layout=new AffinityLayout();layout.sync({...graph,seeds:graph.positions});
  for(const n of graph.nodes){assert.deepEqual(layout.positions[n.id],[0,0,0]);assert.deepEqual(layout.velocities[n.id],[0,0,0]);}
  assert.deepEqual(layout.center,[0,0,0]);layout.step();
  assert.ok(Object.values(layout.positions).some(p=>p.some(v=>v!==0)));
  for(const p of Object.values(layout.positions))assert.ok(p.every(Number.isFinite));
});

test('each unique real connection adds one percent to both endpoint diameters, without a legacy cap',()=>{
  const edges=['a','b','c'].map(to=>({from:'hub',to,type:'related'}));
  const degrees=effectiveDegrees([...edges,...edges,{from:'@core',to:'hub',semanticAnchor:true}]);
  const settings={baseRadius:2,growth:.01,maxRadius:2};
  assert.equal(displayedRadius({},settings,degrees.hub)/2,1.03);
  for(const leaf of ['a','b','c'])assert.equal(displayedRadius({},settings,degrees[leaf])/2,1.01);
  assert.equal(displayedRadius({isMainTag:true},settings)/2,1.4);
});
test('centre volume never exceeds ten base planets and render radius matches collision radius',()=>{
  for(const baseRadius of [1,2,5])for(const count of [0,3,50,100,100000]){
    const n={id:'centre',isMainTag:true,domainConnectionCount:count},settings={baseRadius,growth:.01};
    const radius=displayedRadius(n,settings),layout=new AffinityLayout();layout.sync({nodes:[n],edges:[],...settings});
    assert.ok((radius/baseRadius)**3<=10+1e-10);assert.ok(Math.abs(layout.collisionRadii[0]-radius)<1e-10);
    if(count>=100)assert.ok(Math.abs((radius/baseRadius)**3-10)<1e-10);
  }
});

test('large domain cores grow one percent per unique member and change colors at documented thresholds',()=>{
  const settings={baseRadius:2,growth:.01};
  assert.equal(displayedRadius({isMainTag:true,domainConnectionCount:3},settings),2*1.4*1.03);
  const colors=[[0,'#eeeeee'],[2,'#eeeeee'],[3,'#63cf8b'],[9,'#63cf8b'],[10,'#61a7f5'],[25,'#b18af2'],[50,'#f5a451'],[100,'#f3ce60']];
  for(const [count,color]of colors)assert.equal(mainTagHeat(count).color,color);
  const nodes=Array.from({length:3},(_,i)=>({id:'n'+i,kind:'knowledge',mainTags:[{name:'音乐'},{name:'音乐'}]}));
  const graph=buildMainTagGraph(nodes,[]);
  assert.equal(graph.nodes.find(n=>n.isMainTag).domainConnectionCount,3);
  assert.equal(graph.nodes.find(n=>n.isMainTag).heat.color,'#63cf8b');
});
test('visible membership links connect all assigned domains with evidence and count once at both endpoints',()=>{
  const nodes=[{id:'score',kind:'knowledge',mainTags:[{name:'音乐',reason:'讨论配乐创作',quote:'配乐'},{name:'游戏',reason:'讨论游戏场景',quote:'游戏'}]}];
  const grouped=buildMainTagGraph(nodes,[]),links=grouped.edges.filter(e=>e.membershipLink);
  assert.equal(links.length,2);
  for(const edge of links){
    assert.equal(edge.to,'score');assert.ok(grouped.nodes.some(n=>n.id===edge.from&&n.isMainTag));
    assert.ok(edge.reason);assert.ok(edge.sources[0].quote);
  }
  const degree=effectiveDegrees([...links,...links]);
  assert.equal(degree.score,2);
  for(const core of grouped.nodes.filter(n=>n.isMainTag))assert.equal(degree[core.id],1);
});
test('semantic anchors produce compact multiple clusters while selection/highlight input leaves coordinates stable',()=>{
  const nodes=Array.from({length:16},(_,i)=>({id:'n'+i,kind:'knowledge',mainTags:[{name:i<8?'音乐':'美术'}]}));
  const data=buildMainTagGraph(nodes,[]),layout=new AffinityLayout();layout.sync({...data,seeds:data.positions});
  for(let i=0;i<1200;i++)layout.step({floating:false});
  const distance=(a,b)=>Math.hypot(...layout.positions[a].map((v,i)=>v-layout.positions[b][i]));
  let within=0,between=0,wc=0,bc=0;
  for(let i=0;i<16;i++)for(let j=i+1;j<16;j++)if((i<8)===(j<8)){within+=distance('n'+i,'n'+j);wc++;}else{between+=distance('n'+i,'n'+j);bc++;}
  assert.ok(within/wc<between/bc*.5);
  const checkpoint=layout.checkpoint();
  layout.sync({...data,seeds:{}});assert.deepEqual(layout.checkpoint(),checkpoint);
  assert.equal(Object.keys(checkpoint).length,16);
});
test('main labels cite exact content, discover unlisted domains and persist without rewriting source files; type colors persist',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'venus-domains-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const store=new Store(root),source=store.import({name:'fictional-example',body:'虚构示例：观测行星光谱，比较恒星辐射。'}).node;
  const before=source.hash;
  store.setMainTags({id:source.id,sourceHash:source.hash,tags:[{name:'天文',reason:'材料讨论恒星与行星观测',quote:'观测行星光谱'}]});
  assert.equal(store.find(source.id).hash,before);
  assert.throws(()=>store.setMainTags({id:source.id,sourceHash:source.hash,tags:[{name:'体育',reason:'无依据示例',quote:'not in source'}]}));
  store.type({id:'custom',name:'比较依据',color:'#aabbcc'});
  store.type({id:'custom',name:'比较依据',color:'#11cc88',update:true});
  const restored=new Store(root);
  assert.equal(restored.find(source.id).mainTags[0].name,'天文');
  assert.equal(restored.state.types.find(t=>t.id==='custom').color,'#11cc88');
});
