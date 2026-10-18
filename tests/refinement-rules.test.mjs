import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {Store} from '../src/store.mjs';import {AutoAnalyzer} from '../src/analyzer.mjs';import {ConceptExtractor} from '../src/concepts.mjs';import {conceptAdmission} from '../src/concept-admission.mjs';import {conceptSchema,conceptInstructions} from '../src/concept-contract.mjs';import {knowledgeSimilarity} from '../src/knowledge-similarity.mjs';import {skillMethodPolicy} from '../src/skill-methods.mjs';import {createReadQuery} from '../src/readonly-query.mjs';import {validateContentTitle} from '../src/content-titles.mjs';
const question='为什么要明确方法范围？',answer='方法范围明确，才能避免把结论扩大到其他条件。',ack='我认同这个答案。';
const dialogue=(a=answer,u=ack)=>'### user · 1\n'+question+'\n### assistant · 2\n'+a+'\n'+(u?'### user · 3\n'+u+'\n':'');
const concept=(a=answer,u=ack)=>({key:'方法范围明确',existingId:'',existingHash:'',mergeDecision:'new',links:[],title:'明确范围避免扩大结论',summary:'讨论方法的适用条件。',explanation:'方法范围明确，结论只适用于已经讨论的条件，不能据此扩展到无关任务。',stance:'讨论假设',quote:a,formation:'问题经回答并由用户认可后形成有边界的认识。',admission:{questionQuote:question,answerQuote:a,userConfirmationQuote:u,conclusionQuote:a,confirmationTarget:a,confirmationMeaning:'answer-endorsement'},discussion:[],referenceMaterials:[],mainTags:[]});
const fixture=t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'venus-refinement-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return new Store(root);};
const part=s=>({start:0,end:s.body.length,text:s.body});
test('explicit user endorsement admits; AI-only conclusion and execution permission cannot enter concept nodes',t=>{
 for(const [suffix,u,accepted]of [['endorsed',ack,true],['ai-only','',false],['permission','允许你执行。',false]]){
  const s=fixture(t),v=s.import({name:suffix,body:dialogue(answer,u)}).node,c=new ConceptExtractor(s),item=concept(answer,u),before=JSON.stringify(s.state.jobs);c.consume(v,part(v),[item]);assert.equal(s.nodes.filter(n=>n.kind==='concept').length,accepted?1:0);assert.equal(JSON.stringify(s.state.jobs),before);
  if(accepted){const refs=s.nodes.find(n=>n.kind==='concept').conceptReferences[0].discussion;assert.ok(refs.some(d=>d.role==='用户认可'));}else assert.equal(c.status().ignoredQuestions,1);
 }
});
test('brief acknowledgement is scoped to the answer and cannot endorse execution or unrelated later conclusions',()=>{
 const p=body=>({start:0,end:body.length,text:body});assert.equal(conceptAdmission(concept(answer,'好'),p(dialogue(answer,'好'))).accepted,true);
 const permission=answer+'是否允许开始执行？';assert.equal(conceptAdmission(concept(permission,'好'),p(dialogue(permission,'好'))).accepted,false);
 const item=concept();item.admission.conclusionQuote='另一个领域的新结论。';assert.equal(conceptAdmission(item,p(dialogue()+'### assistant · 4\n另一个领域的新结论。')).accepted,false);
});
test('long discussion reuses only saved read evidence and becomes one concept when later endorsed',t=>{
 const s=fixture(t),prefix=dialogue(answer,''),tail='### user · 3\n'+ack+'\n',v=s.import({name:'long-discussion',body:prefix+tail}).node,c=new ConceptExtractor(s);
 c.consume(v,{start:0,end:prefix.length,text:prefix},[],[{questionQuote:question,answerQuote:answer,conclusionQuote:answer,reason:'尚无用户认可'}]);assert.equal(s.nodes.filter(n=>n.kind==='concept').length,0);
 const item=concept();item.quote=ack;c.consume(v,{start:prefix.length,end:v.body.length,text:tail},[item]);const n=s.nodes.find(n=>n.kind==='concept');assert.ok(n);assert.equal(c.status().ignoredQuestions,0);assert.equal(s.nodes.filter(n=>n.kind==='concept').length,1);assert.ok(n.conceptReferences[0].discussion.some(d=>d.role==='提问'&&d.start<prefix.length));
});
test('bounded cross-source integration preserves ID and all endorsement references; different conditions link separately; manual edits are protected',t=>{
 const s=fixture(t),v1=s.import({name:'one',body:dialogue()}).node,c=new ConceptExtractor(s);c.consume(v1,part(v1),[concept()]);let n=s.nodes.find(n=>n.kind==='concept');const id=n.id;
 const a2=answer+'还须明确例外条件。',v2=s.import({name:'two',body:dialogue(a2)}).node,item=concept(a2);assert.ok(c.context(v2,v2.body).some(x=>x.id===id));item.existingId=id;item.existingHash=n.hash;item.mergeDecision='complement';c.consume(v2,part(v2),[item]);n=s.find(id);assert.equal(s.nodes.filter(n=>n.kind==='concept').length,1);assert.equal(n.sources.length,2);assert.equal(n.conceptReferences.filter(r=>r.discussion.some(d=>d.role==='用户认可')).length,2);
 const a3=answer+'另一任务的条件不同。',v3=s.import({name:'three',body:dialogue(a3)}).node,related=concept(a3);related.title='另一条件下的结论';related.links=[{targetId:id,relation:'条件不同',reason:'适用条件不同，不能归为同一结论',quote:a3}];c.consume(v3,part(v3),[related]);assert.equal(s.nodes.filter(n=>n.kind==='concept').length,2);assert.ok(s.relations.some(r=>r.to===id&&r.reason.includes('条件不同')));
 n=s.find(id);s.edit({id,body:n.body+'\n人工保留的限制。',expectedHash:n.hash});const v4=s.import({name:'four',body:dialogue(answer+'新增条件。')}).node,unsafe=concept(answer+'新增条件。');unsafe.existingId=id;unsafe.existingHash=s.find(id).hash;unsafe.mergeDecision='same-core';assert.throws(()=>c.consume(v4,part(v4),[unsafe]),/人工编辑/);assert.ok(s.find(id).body.includes('人工保留的限制'));
 assert.ok(c.context(v4,v4.body).length<=8);assert.ok(conceptInstructions.includes('不逐问逐答切碎'));
});
test('knowledge similarity is measured at the exact 95 percent boundary and Store blocks lower-score overwrites',t=>{
 const a='a'.repeat(101),b='a'.repeat(96)+'b'.repeat(5),low='a'.repeat(95)+'b'.repeat(6);assert.equal(knowledgeSimilarity(a,b),.95);assert.ok(knowledgeSimilarity(a,low)<.95);
 const s=fixture(t),v=s.import({name:'evidence',body:'证据原文'}).node,n=s.upsert({id:'k',kind:'knowledge',title:'独立事实核心',body:a,sources:[{id:v.id,quote:'证据'}]});assert.throws(()=>s.upsert({...n,body:low,expectedHash:n.hash}),/不足95%/);assert.equal(s.find('k').body,a);assert.equal(s.upsert({...n,body:b,expectedHash:n.hash}).id,'k');
 assert.ok(knowledgeSimilarity('# one\n## 提取的知识\n'+a+'\n## 原文依据\n共同证据','# two\n## 提取的知识\n'+low+'\n## 原文依据\n共同证据')<.95);
});
test('AI knowledge reuse does not append new meaning below threshold and preserves existing reference IDs',t=>{
 const s=fixture(t),oldSource=s.import({name:'old',body:'旧证据'}).node,source=s.import({name:'new',body:'新证据'}).node,a='a'.repeat(101),body='# 独立事实核心\n\n## 提取的知识\n'+a+'\n\n## 判断边界\n有据知识';s.upsert({id:'k',kind:'knowledge',title:'独立事实核心',body,sources:[{id:oldSource.id,quote:'旧证据'}]});const analyzer=new AutoAnalyzer(s,{runner:async()=>{throw Error('must not call');}}),entry={outputs:[],issues:[]},make=text=>({newRelationTypes:[],knowledge:[{key:'same',existingId:'k',title:'独立事实核心',body:text,quote:'新证据',category:'事实',categoryReason:'内容依据',epistemic:'有据知识',mainTags:[]}],skills:[],relations:[],vaultRelations:[]});
 analyzer.apply(make('a'.repeat(96)+'b'.repeat(5)),source,entry,[s.find('k')],part(source));assert.equal(s.nodes.filter(n=>n.kind==='knowledge').length,1);assert.equal(s.find('k').sources.length,2);assert.equal(entry.similarityDecisions.at(-1).similarity,.95);
 analyzer.apply(make('a'.repeat(95)+'b'.repeat(6)),source,entry,[s.find('k')],part(source));assert.equal(s.nodes.filter(n=>n.kind==='knowledge').length,2);assert.equal(entry.similarityDecisions.at(-1).action,'separate');assert.ok(s.find('k').body.includes(a));
});
test('skill scope and endorsement survive storage/read; permission and edited methods never become executable methods',t=>{
 const s=fixture(t),v=s.import({name:'method',body:dialogue()}).node,k=s.upsert({id:'knowledge',kind:'knowledge',title:'事实依据',body:'用于支撑方法的知识原文。',sources:[{id:v.id,quote:answer}]}),body='在认可范围内采用该方法，保留条件边界。';
 const policy=skillMethodPolicy({scope:'仅限已讨论案例',limitations:'不扩展到其他任务',recognitionKind:'user-confirmed',recognitionQuote:ack,recognitionTarget:answer,sourceHash:v.hash,sourceId:v.id,readRange:{start:0,end:v.body.length}},v,body);
 const n=s.upsert({id:'skill',kind:'skill',title:'按范围采用方法',body,sources:[{id:k.id,quote:'方法'}],level:'涉及',methodPolicy:policy});assert.equal(n.methodUse.usableAsMethod,true);const read=createReadQuery(s)('node',{id:n.id});assert.equal(read.methodUse.scope,'仅限已讨论案例');assert.ok(read.methodUse.notice.includes('不覆盖当前指示'));
 assert.throws(()=>s.upsert({...n,body:'助手另一个未确认建议',methodPolicy:undefined,expectedHash:n.hash}),/未确认建议/);
 const permission=s.import({name:'permission',body:dialogue(answer,'允许你执行。')}).node,p=skillMethodPolicy({scope:'案例',limitations:'保留边界',recognitionKind:'user-confirmed',recognitionQuote:'允许你执行。',recognitionTarget:answer},permission,body);assert.equal(p.status,'unconfirmed');
 s.edit({id:n.id,body:n.body+' 人工改写待复核。',expectedHash:n.hash});assert.equal(s.find(n.id).methodUse.usableAsMethod,false);
});
test('content-core naming and existing icon system are wired without changing Vault or adding model calls',()=>{
 assert.throws(()=>validateContentTitle('软件工程 / 人工智能',['软件工程','人工智能']),/标签/);assert.equal(validateContentTitle('边界条件决定方法适用范围',['方法']),'边界条件决定方法适用范围');
 const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');assert.ok(app.includes("concept:'<path"));for(const id of ['concept','concept-network'])assert.ok(html.includes('data-view="'+id+'"><span><svg'));assert.ok(conceptSchema.properties.concepts.items.properties.admission);
});
