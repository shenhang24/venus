import test from 'node:test';import assert from 'node:assert/strict';
import {validateReview,normalizePendingReferences} from '../src/concept-content-review.mjs';
const result=()=>({verdict:'complete',summary:'对照原文已表达该认识。',checkedTopics:[{topic:'条件边界',sourceQuote:'保留条件',assessment:'represented',conceptIds:['c-1'],reason:'既有正文明确说明条件。'}],issues:[],concepts:[]});
test('content review requires actual topic evidence and existing concept identity',()=>{
 const source={text:'应当保留条件。'},existing=[{id:'c-1'}];validateReview(result(),source,existing);
 assert.throws(()=>validateReview(result(),{text:'覆盖标记不是原文。'},existing),/原文依据/);
 assert.throws(()=>validateReview(result(),source,[]),/未知概念/);
 const empty=result();empty.checkedTopics=[];assert.throws(()=>validateReview(empty,source,existing),/主题清单/);
});
test('coverage or missing themes cannot justify a complete content verdict',()=>{
 const source={text:'应当保留条件。'},existing=[{id:'c-1'}];
 const missing=result();missing.checkedTopics[0].assessment='missing';assert.throws(()=>validateReview(missing,source,existing),/不能记录内容完整/);
 const issue=result();issue.issues=['尚未读取原文后半部'];assert.throws(()=>validateReview(issue,source,existing),/不能记录内容完整/);
 const bad=result();bad.checkedTopics[0].conceptIds=[];assert.throws(()=>validateReview(bad,source,existing),/必须指出已有概念/);
 const excluded=result();excluded.checkedTopics[0].assessment='not-admitted';excluded.checkedTopics[0].conceptIds=[];excluded.checkedTopics[0].reason='原文没有用户认可，不能补造。';validateReview(excluded,source,[]);
});
test('new candidate keys stay missing until saved; unknown and complete references remain strict',()=>{
 const r=result();r.verdict='supplement';r.concepts=[{key:'pending'}];r.checkedTopics[0].conceptIds=['pending'];const normalized=normalizePendingReferences(r,[]);assert.equal(normalized.checkedTopics[0].assessment,'missing');assert.deepEqual(normalized.checkedTopics[0].conceptIds,[]);assert.equal(r.checkedTopics[0].assessment,'represented');validateReview(normalized,{text:'应当保留条件。'},[]);
 r.checkedTopics[0].conceptIds=['unknown'];assert.throws(()=>normalizePendingReferences(r,[]),/未知概念/);r.verdict='complete';r.checkedTopics[0].conceptIds=['pending'];assert.throws(()=>normalizePendingReferences(r,[]),/未知概念/);
});
