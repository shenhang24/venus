import test from 'node:test';
import assert from 'node:assert/strict';
import {knowledgeForSource, knowledgeInScope, knowledgeListPage, chooseKnowledgeSource, knowledgeStatus, taskPresentation, activityState, fileStageProgress} from '../public/knowledge-view.js';

test('all knowledge is the default scope; source selection is explicit and every result is reachable by paging or search',()=>{
 const nodes=[{id:'source',kind:'vault'},...Array.from({length:4117},(_,i)=>({id:'k'+i,kind:'knowledge',title:'Knowledge '+i,sources:[{id:i<5?'source':'other'}]})),{id:'merged',kind:'knowledge',mergedInto:'k0'},{id:'skill',kind:'skill'}];
 const all=knowledgeInScope(nodes);assert.equal(all.length,4117);assert.equal(knowledgeInScope(nodes,'source').length,5);
 const seen=new Set();for(let page=0;page<52;page++)for(const n of knowledgeListPage(all,{page}).items)seen.add(n.id);
 assert.equal(seen.size,4117);assert.equal(knowledgeListPage(all,{query:'Knowledge 4116'}).items[0].id,'k4116');assert.equal(knowledgeListPage(all,{page:999}).page,51);
});

test('knowledge view opens saved results and restores explicitly selected source', () => {
  const nodes = [{id:'empty',kind:'vault'}, {id:'a',kind:'vault',mergedFrom:['child']},
    {id:'b',kind:'vault'}, {id:'ka',kind:'knowledge',sources:[{id:'child',quote:'original'}]},
    {id:'kb',kind:'knowledge',sources:[{id:'b',quote:'evidence'}]}];
  assert.equal(chooseKnowledgeSource(nodes,null),'a');
  assert.equal(chooseKnowledgeSource(nodes,'b'),'b');
  assert.equal(chooseKnowledgeSource(nodes,'missing'),'a');
  assert.deepEqual(knowledgeForSource(nodes,'a').map(n=>n.id),['ka']);
  assert.deepEqual(knowledgeForSource(nodes,'b').map(n=>n.id),['kb']);
  assert.equal(knowledgeForSource(nodes,'b')[0].sources[0].quote,'evidence');
  nodes.push({id:'new',kind:'knowledge',sources:[{id:'b',quote:'new evidence'}]});
  assert.equal(knowledgeForSource(nodes,'b').length,2);
  assert.equal(chooseKnowledgeSource(JSON.parse(JSON.stringify(nodes)),'b'),'b');
});
test('empty state distinguishes completed analysis from queued and failed work', () => {
  assert.match(knowledgeStatus({fileProgress:{a:{status:'done'}}},'a')[0],/已分析/);
  assert.match(knowledgeStatus({fileProgress:{a:{status:'working'}}},'a')[0],/正在/);
  assert.match(knowledgeStatus({fileProgress:{a:{status:'review'}}},'a')[0],/核对/);
  assert.match(knowledgeStatus({},'a')[0],/尚无/);
});
test('task status reports saved offsets, unknown totals, cooldown and pause honestly', () => {
  assert.match(taskPresentation({}).progress,/未知/);
  const state={analysis:{enabled:true,running:true,total:10,completed:3,current:{sourceId:'a',title:'Example',offset:40,total:100},fileProgress:{a:{offset:30}}}};
  const active=taskPresentation(state,100);
  assert.match(active.status,/正在处理/);
  assert.match(active.progress,/剩余 7/);
  assert.match(active.stage,/30 \/ 100/);
  assert.match(active.stage,/合并执行/);
  state.analysis.cooldownUntil=200;
  assert.match(taskPresentation(state,100).status,/重试/);
  state.analysis.enabled=false;
  assert.match(taskPresentation(state,100).status,/暂停/);
});
test('activity never treats a completed segment or unknown queue as 100 percent', () => {
  assert.equal(activityState({enabled:true,running:true,total:10,completed:3}).mode,'running');
  assert.equal(activityState({enabled:true,running:false,total:10,completed:3}).mode,'idle');
  assert.equal(activityState({enabled:true,running:false,total:10,completed:10}).mode,'complete');
  for (const state of [{enabled:false,running:true},{enabled:true,cancelled:true},{enabled:true,needsReview:1},{enabled:true,cooldownUntil:200},{enabled:true,completed:10}])
    assert.equal(activityState(state,100).mode,'idle');
});
test('file progress uses actual saved sections and the current segmentation plan, never three fixed stages',()=>{
  const state={enabled:true,activeFiles:[{sourceId:'a'}],fileProgress:{a:{status:'working',phase:2,offset:40,parts:7,totalParts:31}}};
  let stage=fileStageProgress(state,'a');
  assert.equal(stage.current,8);assert.equal(stage.completed,7);assert.equal(stage.total,31);assert.equal(stage.animating,true);
  state.fileProgress.a.phase=3;
  stage=fileStageProgress(state,'a');assert.equal(stage.current,8);assert.equal(stage.completed,7);assert.equal(stage.done,false);
  state.fileProgress.a.parts=31;
  state.fileProgress.a.status='done';
  stage=fileStageProgress(state,'a');assert.equal(stage.completed,31);assert.equal(stage.animating,false);assert.equal(stage.done,true);
  for(const status of ['retry','review','paused']){
    state.fileProgress.a={status,phase:2};assert.equal(fileStageProgress(state,'a').animating,false);
  }
  state.fileProgress.a.status='working';state.enabled=false;
  assert.equal(fileStageProgress(state,'a').animating,false);
});
