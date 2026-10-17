import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../src/store.mjs';
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'venus-merge-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return new Store(root);}
function docs(s){const a=s.import({name:'old',body:'# 旧标题\n\n- ChatGPT 对话 ID：thread-1\n\n第一段原文，逐字保留。'}).node,b=s.import({name:'new',body:'# 新标题\n\n- 原始对话／任务 ID：thread-1\n\n后续讨论原文。'}).node;return {a,b,args:{targetId:a.id,sourceIds:[b.id],expectedHashes:{[a.id]:a.hash,[b.id]:b.hash}}};}
test('同一对话合并保留来源ID与逐字正文，原来源可读且可还原',t=>{
  const s=fixture(t),{a,b,args}=docs(s),merged=s.mergeVault(args);
  assert.ok(merged.body.includes(a.body));assert.ok(merged.body.includes(b.body));
  assert.equal(s.find(b.id).mergedInto,a.id);assert.equal(s.find(b.id).body,b.body);
  assert.ok(s.history(a.id).length);
  const reopened=new Store(s.root);assert.equal(reopened.find(b.id).mergedInto,a.id);
  const undone=reopened.unmergeVault({targetId:a.id,expectedHash:merged.hash});
  assert.equal(undone.body,a.body);assert.equal(reopened.find(b.id).mergedInto,undefined);
});
test('不凭相似标题合并，拒绝不同对话和过期哈希',t=>{
  const s=fixture(t),{a,b,args}=docs(s);
  assert.throws(()=>s.mergeVault({...args,expectedHashes:{}}),/变化/);
  const c=s.import({name:'other',body:'# 新标题\n\n- ChatGPT 对话 ID：different\n\n不是连续资料'}).node;
  assert.throws(()=>s.mergeVault({...args,sourceIds:[c.id],expectedHashes:{[a.id]:a.hash,[c.id]:c.hash}}),/不一致/);
});
test('后续原文更新自动进入合并MD，人工改动不会被刷新覆盖',t=>{
  const s=fixture(t),{a,b,args}=docs(s);s.mergeVault(args);
  const update=b.body+'\n新增的一轮';s.edit({id:b.id,body:update,expectedHash:b.hash});
  assert.ok(s.find(a.id).body.includes(update));
  const merged=s.find(a.id);s.edit({id:a.id,body:merged.body+'\n人工注释',expectedHash:merged.hash});
  const child=s.find(b.id);s.edit({id:b.id,body:update+'\n下一轮',expectedHash:child.hash});
  assert.ok(s.find(a.id).body.endsWith('人工注释'));assert.equal(s.find(a.id).mergeConflict,true);
  assert.throws(()=>s.unmergeVault({targetId:a.id,expectedHash:s.find(a.id).hash}),/人工修改/);
});
