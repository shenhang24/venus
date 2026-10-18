import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store,hash} from '../src/store.mjs';
test('aggregate tables save current data without new full snapshots; individual history remains',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'venus-aggregate-history-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const s=new Store(root);
 const source=s.import({name:'fixture',body:'依据原文'}).node;
 const history=path.join(s.meta,'history'),oldDir=path.join(history,hash('知识点/_关系.md').slice(0,16));fs.mkdirSync(oldDir,{recursive:true});fs.writeFileSync(path.join(oldDir,'old.json'),'existing history');
 for(const summary of ['first','second']){const n=s.find(source.id);s.classify({id:n.id,summary,tags:[{name:'测试',reason:'依据',quote:'依据原文'}],sourceHash:n.hash,expectedHash:n.classificationHash});}
 assert.ok(fs.readFileSync(path.join(s.meta,'classifications.md'),'utf8').includes('second'));
 s.relations=[];s.writeRelations();s.writeRelations();assert.ok(fs.existsSync(path.join(root,'知识点','_关系.md')));
 s.archive('.venus\\classifications.md','skip');s.archive('知识点\\_关系.md','skip');
 assert.deepEqual(fs.readdirSync(oldDir),['old.json']);assert.ok(!fs.existsSync(path.join(history,hash('.venus/classifications.md').slice(0,16))));
 s.archive(source.path,'single document');assert.equal(fs.readdirSync(path.join(history,hash(source.path).slice(0,16))).length,1);
 assert.equal(fs.readFileSync(path.join(oldDir,'old.json'),'utf8'),'existing history');
});
