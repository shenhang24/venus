import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {Store} from '../src/store.mjs';import {ConceptExtractor,locateConceptDiscussion} from '../src/concepts.mjs';import {conceptInstructions,conceptTemplate,conceptSchema} from '../src/concept-contract.mjs';
test('question, answer and correction locations are saved inside the read segment Reference',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'venus-concept-discussion-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const s=new Store(root),prefix='前段尚未纳入本次输入。\n',text='用户：为什么会这样？\n助手：这是一种可能解释，结论仅适用于当前条件。\n用户：还要考虑条件差异。我认同这个答案。';
 const source=s.import({name:'question-discussion',body:prefix+text}).node,part={start:prefix.length,end:source.body.length,text},c=new ConceptExtractor(s);
 const discussion=[{role:'提问',quote:'为什么会这样？'},{role:'回答',quote:'这是一种可能解释，结论仅适用于当前条件。'},{role:'修正',quote:'还要考虑条件差异。'},{role:'结论',quote:'结论仅适用于当前条件。'}];
 c.consume(source,part,[{key:'有条件的解释',existingId:'',existingHash:'',mergeDecision:'new',links:[],title:'有条件的解释',summary:'针对已有问题，经回答和修正形成有条件的理解。',explanation:'解释需要结合问题所处的条件，暂时回答不等于已经证实的普遍定论。',stance:'讨论假设',quote:discussion[3].quote,formation:'提问后得到可能解释，讨论进一步补充了条件边界。',admission:{questionQuote:discussion[0].quote,answerQuote:discussion[1].quote,userConfirmationQuote:'我认同这个答案。',conclusionQuote:discussion[3].quote,confirmationTarget:discussion[3].quote,confirmationMeaning:'answer-endorsement'},discussion,referenceMaterials:[],mainTags:[]}]);
 const n=s.nodes.find(n=>n.kind==='concept'),refs=n.conceptReferences[0].discussion;assert.equal(refs.length,5);
 for(const ref of refs){assert.ok(ref.start>=part.start&&ref.end<=part.end);assert.equal(source.body.slice(ref.start,ref.end),ref.quote);assert.ok(n.body.includes(ref.role+' · 字符 '+ref.start));}
 assert.ok(!n.body.split('## Reference')[0].includes('用户：'));assert.equal(n.conceptStance,'讨论假设');
});
test('unread or fabricated cross-segment discussion quotations are rejected; older artifacts remain accepted',()=>{
 const part={start:20,end:27,text:'当前已读内容。'};assert.throws(()=>locateConceptDiscussion([{role:'回答',quote:'前段尚未读取的回答'}],part),/当前已读分段/);assert.deepEqual(locateConceptDiscussion(undefined,part),[]);
 assert.ok(conceptInstructions.includes('来源不限于项目设计或技术系统'));assert.ok(conceptInstructions.includes('暂时回答或 AI 建议'));assert.ok(conceptTemplate.includes('提问、回答、用户认可'));assert.ok(conceptSchema.properties.concepts.items.properties.discussion);
});
