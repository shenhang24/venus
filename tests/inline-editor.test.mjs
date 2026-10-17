import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {Store} from '../src/store.mjs';
import {InlineDrafts,saveInlineDraft,linkedNeighbours} from '../public/knowledge-view.js';

test('typing and paged body edits survive refreshed snapshots and edits made during save',()=>{
  const drafts=new InlineDrafts(),node={id:'a',hash:'h1',title:'title',body:'first\nsecond\nlast'},d=drafts.open(node);
  drafts.replaceRange('a',6,12,'changed');drafts.change('a',{title:'new'});
  assert.equal(drafts.open({...node,hash:'h2',body:'background'}),d);assert.equal(d.body,'first\nchanged\nlast');
  const version=d.version;drafts.change('a',{body:d.body+' typing'});drafts.accept('a',{...node,hash:'h3',body:'saved',title:'new'},version);
  assert.equal(d.hash,'h3');assert.ok(d.dirty);assert.ok(d.body.endsWith('typing'));
});

for(const legacy of [false,true])for(const kind of ['vault','knowledge','skill'])test(`direct ${kind} title/body save is versioned and persistent (${legacy?'running legacy API':'new API'})`,async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'venus-inline-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const store=new Store(root),v=store.import({name:'source.md',body:'# Source\n\nevidence'}).node;
  const k=store.upsert({id:'k',kind:'knowledge',title:'Knowledge',body:'# Knowledge\n\nknowledge evidence',sources:[{id:v.id,quote:'evidence'}]});
  const s=store.upsert({id:'s',kind:'skill',title:'Skill',body:'# Skill\n\nskill text',level:'涉及',sources:[{id:k.id,quote:'knowledge evidence'}]});
  const n=kind==='vault'?v:kind==='knowledge'?k:s,drafts=new InlineDrafts(),draft=drafts.open(n);
  drafts.change(n.id,{title:'Changed title',body:'# Before\n\nManually edited body'});
  const saved=await saveInlineDraft(n,draft,async(route,data)=>route==='edit'?store.edit(legacy?{id:data.id,body:data.body,expectedHash:data.expectedHash}:data):store.upsert(data),{inlineTitleEdit:!legacy});
  const restored=new Store(root).find(n.id);assert.equal(restored.title,'Changed title');assert.match(restored.body,/Manually edited body/);assert.equal(restored.path,n.path);assert.equal(saved.id,n.id);
  if(kind!=='vault')assert.ok(store.state.manualEdits[n.id]);
  await assert.rejects(saveInlineDraft(n,{...draft,hash:n.hash},async(_,data)=>store.edit(data)),/内容已变化/);
});

test('navigation includes every real endpoint and all parallel relationships without inventing semantic direction',()=>{
  const nodes=['a','b','c','d','e'].map(id=>({id,title:id,body:'body '+id})),edges=[{id:'ab1',from:'a',to:'b',type:'related',reason:'reason one',sources:[{id:'src',quote:'quote'}]},{id:'ab2',from:'b',to:'a',type:'same',reason:'reason two'},...['c','d','e'].map(id=>({id:'a'+id,from:id,to:'a',type:'related'}))];
  const before=JSON.stringify(edges),entries=linkedNeighbours(nodes,edges,'a');assert.equal(entries.length,4);assert.equal(entries.find(e=>e.id==='b').relations.length,2);assert.equal(entries.find(e=>e.id==='b').relations[0].sources[0].quote,'quote');assert.equal(JSON.stringify(edges),before);
  assert.equal(linkedNeighbours(nodes,edges,'b')[0].node.body,'body a');
});
