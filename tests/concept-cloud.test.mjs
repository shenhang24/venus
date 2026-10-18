import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {Store} from '../src/store.mjs';import {ConceptExtractor,conceptTemplate} from '../src/concepts.mjs';import {AutoAnalyzer} from '../src/analyzer.mjs';import {createReadQuery} from '../src/readonly-query.mjs';import {analysisSchema} from '../src/analysis-model.mjs';
import {buildMainTagGraph} from '../public/main-tags.js';import {AffinityLayout} from '../public/layout.js';
const fixture=t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'venus-concepts-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return new Store(root);};
const qa=answer=>'### user · 1\n为什么需要整体理解？\n### assistant · 2\n'+answer+'\n### user · 3\n我认同这个答案。\n';
const item=quote=>{const answer=quote.match(/### assistant · 2\n([\s\S]*?)\n### user/)?.[1]||quote;return {key:'结构化理解',existingId:'',existingHash:'',mergeDecision:'new',links:[],title:'结构化理解',summary:'对话要求把相关组件形成的认识整理为整体。',explanation:'结构化理解通过组织组件之间的理由与边界形成可使用的认识，而非记录执行日志。',stance:'讨论假设',quote,formation:'从组件分工讨论形成整体理解。',admission:{questionQuote:'为什么需要整体理解？',answerQuote:answer,userConfirmationQuote:'我认同这个答案。',conclusionQuote:answer,confirmationTarget:answer,confirmationMeaning:'answer-endorsement'},discussion:[],referenceMaterials:[],mainTags:[{name:'设计',reason:'说明组件组织及意义',quote:'结构化理解'}]};};
const result=text=>({summary:'形成结构化认识。',mainTags:[],mainTagUpdates:[],newRelationTypes:[],tags:[],knowledge:[],skills:[],relations:[],vaultRelations:[],issues:[],concepts:[item(text)]});
test('concept storage directly cites Vault; persisted references, edit history and query share one node',t=>{
 const s=fixture(t),v=s.import({name:'source',body:qa('讨论组件如何共同形成能力。')}).node,c=new ConceptExtractor(s),jobs=JSON.stringify(s.state.jobs);
 assert.ok(!fs.existsSync(c.file));c.consume(v,{start:0,end:v.body.length,text:v.body},[item(v.body)]);const n=s.nodes.find(n=>n.kind==='concept');
 assert.ok(n.path.startsWith('概念云/'));assert.equal(n.sources[0].id,v.id);assert.equal(n.sources[0].locator.start,0);assert.ok(n.body.includes('## Reference'));assert.ok(n.body.includes('## 认识性质'));assert.equal(s.state.jobs.length,JSON.parse(jobs).length);
 s.edit({id:n.id,body:n.body+'\n人工修订。',title:n.title,expectedHash:n.hash});assert.equal(JSON.stringify(s.state.jobs),jobs);assert.equal(s.history(n.id).length,1);
 const reopened=new Store(s.root);assert.ok(reopened.find(n.id).body.includes('人工修订'));const query=createReadQuery(reopened);assert.equal(query('search',{kind:'concept',q:'结构化理解'}).items[0].id,n.id);
 const graph=buildMainTagGraph(reopened.nodes.filter(n=>n.kind==='concept'),[]),layout=new AffinityLayout();layout.sync(graph);layout.step();assert.ok(graph.nodes.some(x=>x.id===n.id));assert.ok(layout.positions[n.id].every(Number.isFinite));assert.ok(layout.coreId.startsWith('@main:concept:'));
 assert.throws(()=>s.upsert({id:'bad',kind:'concept',title:'bad',body:'bad',sources:[{id:n.id,quote:'结构化理解'}]}),/Vault/);
});
test('coverage records only future segments, leaving the earlier prefix eligible for concept-only backfill',t=>{
 const s=fixture(t),v=s.import({name:'source',body:'旧内容。新内容。'}).node,c=new ConceptExtractor(s);c.consume(v,{start:4,end:v.body.length,text:v.body.slice(4)},[]);
 assert.deepEqual(c.gaps(v),[[0,4]]);assert.equal(c.consume(v,{start:4,end:v.body.length,text:v.body.slice(4)},[]).duplicate,true);assert.equal(s.nodes.filter(n=>n.kind==='concept').length,0);
});
test('existing analysis reuses one call for forward concepts then backfills only concepts after the frozen batch',async t=>{
 const s=fixture(t),old=s.import({name:'old',body:qa('过去讨论的整体认识。')}).node,v=s.import({name:'current',body:qa('新讨论的整体认识。')}).node,c=new ConceptExtractor(s),calls=[];
 const a=new AutoAnalyzer(s,{maxConcurrent:5,conceptExtractor:c,runner:async payload=>{calls.push({purpose:payload.purpose||'normal',id:payload.source.id});return result(payload.source.text);}});a.discover();const e=a.state.entries[old.id];e.status='done';e.offset=old.body.length;s.job({sourceId:old.id,status:'done',stage:'existing'});const preserved=structuredClone(e);
 await a.tick();assert.deepEqual(c.state.batch.sources.map(x=>x.id),[v.id]);assert.equal(calls.length,1);assert.equal(calls[0].id,v.id);assert.equal(a.state.entries[v.id].status,'done');assert.equal(c.batchComplete(),true);
 const later=s.import({name:'later',body:qa('后来新增的讨论认识。')}).node;await a.tick();assert.equal(c.state.batch.sources.length,1);assert.ok(calls.some(x=>x.purpose==='concept-only'&&x.id===old.id));assert.ok(calls.some(x=>x.purpose==='normal'&&x.id===later.id));assert.deepEqual(a.state.entries[old.id],preserved);assert.deepEqual(c.gaps(old),[]);assert.ok(!calls.some(x=>x.purpose==='normal'&&x.id===old.id));
});
test('paused/review sources do not silently count as finished batch work; later arrivals cannot extend its boundary',t=>{
 const s=fixture(t),v=s.import({name:'source',body:'一份等待处理的资料。'}).node,c=new ConceptExtractor(s),a=new AutoAnalyzer(s,{conceptExtractor:c,runner:async()=>{throw Error('not called');}});a.discover();c.initializeBatch();a.state.entries[v.id].status='review';assert.equal(c.batchComplete(),false);a.state.entries[v.id].status='done';assert.equal(c.batchComplete(),true);
});
test('invalid concept output stays pending without creating nodes or modifying completed knowledge',t=>{
 const s=fixture(t),v=s.import({name:'source',body:'真实原文。'}).node,c=new ConceptExtractor(s),part={start:0,end:v.body.length,text:v.body};assert.throws(()=>c.consume(v,part,[item('不存在的引句')]),/定位依据/);c.defer(v,part,'safe-result.json',Error('invalid output'));assert.equal(s.nodes.filter(n=>n.kind==='concept').length,0);assert.equal(Object.keys(c.state.pending).length,1);
});
test('template, separate directory and network entry exist without changing underlying AI kind identities',()=>{
 assert.ok(conceptTemplate.includes('## Reference'));assert.ok(analysisSchema.properties.concepts);const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');assert.ok(html.indexOf('data-view="concept"')>html.indexOf('data-view="skill"'));assert.ok(html.includes('data-view="concept-network"'));assert.ok(html.includes('AI 知识点'));assert.ok(html.includes('AI 技能'));
});
