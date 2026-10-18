import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createReadQuery} from '../src/readonly-query.mjs';import {createReadonlyClient} from '../codex-plugin/readonly-client.mjs';
const store=()=>({nodes:[{id:'v-one',title:'AIOS task planning',kind:'vault',body:'# AIOS\n\nBudget-based task planning',sources:[]},{id:'k-one',title:'Task planning',kind:'knowledge',body:'# Planning\n\nBreak tasks into sections.',sources:[{id:'v-one',quote:'Budget-based task planning',locator:'字符 8–34'}]},{id:'k-two',title:'Resource budget',kind:'knowledge',body:'Resource budget details',sources:[]}],relations:[{id:'r1',from:'k-one',to:'k-two',type:'logic',reason:'Planning uses resource limits',sources:[{id:'v-one',quote:'Budget-based task planning'}]},{id:'r2',from:'k-two',to:'k-one',type:'related',reason:'Related budget',sources:[]}],state:{types:[]}});
test('read-only search, paged bodies, source locations and all parallel neighbor reasons remain unchanged',()=>{
 const s=store(),before=JSON.stringify(s),read=createReadQuery(s);assert.equal(read('search',{q:'AIOS',kind:'vault'}).items[0].id,'v-one');
 const part=read('node',{id:'k-one',offset:2,length:7});assert.equal(part.body,s.nodes[1].body.slice(2,9));assert.ok(part.nextOffset);assert.equal(part.sources[0].locator,'字符 8–34');
 const adjacent=read('neighbors',{id:'k-one'});assert.equal(adjacent.total,1);assert.equal(adjacent.neighbors[0].relations.length,2);assert.equal(adjacent.neighbors[0].relations[0].reason,'Planning uses resource limits');assert.equal(JSON.stringify(s),before);
 assert.throws(()=>read('node',{id:'../../outside.md'}),/节点 ID/);assert.throws(()=>read('delete',{id:'k-one'}),/只读操作/);assert.throws(()=>read('search',{q:''}),/按需查询/);
});
test('symlink/outside paths cannot be read through a recorded node',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'venus-readonly-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const s=store();s.root=root;s.nodes[0].path='../../outside.md';assert.throws(()=>createReadQuery(s)('node',{id:'v-one'}),/允许范围/);
});
test('readonly local bridge has only GET operations and a metadata-only legacy fallback',async()=>{
 const requests=[],snapshot={...store(),types:[]};snapshot.nodes=snapshot.nodes.map(({body,...n})=>({...n,classification:{summary:n.title}}));
 const client=createReadonlyClient({fetchImpl:async(url,options)=>{requests.push({url,options});if(url.includes('/api/read/'))return {ok:false,status:404};return {ok:true,json:async()=>url.includes('/api/node')?store().nodes[1]:snapshot};}});
 const result=await client('search',{q:'planning'});assert.match(result.searchScope,/metadata-only/);assert.ok(result.items.length);assert.equal((await client('node',{id:'k-one',length:6})).body,'# Plan');
 assert.ok(requests.every(r=>r.options.method==='GET'&&r.options.redirect==='error'));assert.ok(!requests.some(r=>/\/api\/state$/.test(r.url)));
 await assert.rejects(client('edit',{id:'k-one',body:'unsafe'}),/只读/);await assert.rejects(client('node',{id:'k-one',path:'file'}),/额外路径/);
 assert.throws(()=>createReadonlyClient({baseUrl:'https://external.invalid'}),/本机/);
});

test('auxiliary aliases and projects support filters and incremental search without changing original labels or bodies',()=>{
 const s=store(),n=s.nodes[1];n.hash='h1';n.body+='\nAIOS';n.mainTags=[{name:'工作流'}];const before=JSON.stringify(s.nodes),read=createReadQuery(s);
 const saved=read.setAuxiliary({id:n.id,expectedHash:'h1',expectedVersion:0,tags:[{name:'Granularity',quote:'Break tasks into sections.'},{name:'granularity',quote:'Break tasks into sections.'}],aliases:[{name:'分段规划',quote:'Break tasks into sections.'}],projects:[{name:'AIOS',quote:'AIOS'}]});
 assert.equal(saved.auxiliary.tags.length,1);assert.equal(JSON.stringify(s.nodes),before);
 assert.equal(read('search',{q:'分段规划',kind:'knowledge',mainTag:'工作流',project:'aios',source:'v-one'}).items[0].id,n.id);
 assert.equal(read('search',{q:'not-found'}).total,0);assert.throws(()=>read.setAuxiliary({id:n.id,expectedHash:'h1',expectedVersion:0,aliases:[]}),/版本已变化/);
 assert.throws(()=>read.setAuxiliary({id:n.id,expectedHash:'h1',expectedVersion:1,body:'overwrite'}),/只允许/);
 n.hash='h2';n.body='New replacement text';assert.equal(read('search',{q:'分段规划'}).total,0);assert.equal(read('search',{q:'replacement'}).total,1);assert.equal(read('node',{id:n.id}).auxiliary.needsReview,true);
});

test('source fragments preserve recorded locations and distinguish forbidden sources from missing nodes',()=>{
 const read=createReadQuery(store()),fragment=read('source-fragment',{id:'k-one',sourceId:'v-one',length:8});assert.equal(fragment.offset,8);assert.ok(fragment.body.length===8);
 assert.throws(()=>read('source-fragment',{id:'k-one',sourceId:'k-two'}),e=>e.status===403);assert.throws(()=>read('node',{id:'not-existing'}),e=>e.status===404);
});

test('auxiliary writes are a separately enabled narrow capability and offline failures are distinct',async()=>{
 const readOnly=createReadonlyClient({fetchImpl:async()=>{throw Error('offline');}});await assert.rejects(readOnly('search',{q:'AIOS'}),e=>e.code==='VENUS_UNREACHABLE');
 await assert.rejects(readOnly.setAuxiliary({id:'k-one'}),/默认只读/);let request;
 const writer=createReadonlyClient({allowAuxiliaryTags:true,fetchImpl:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({contentChanged:false})};}});
 await writer.setAuxiliary({id:'k-one',expectedHash:'h1',expectedVersion:0,aliases:[]});assert.ok(request.url.endsWith('/api/read/aux-tags'));assert.equal(request.options.method,'POST');await assert.rejects(writer.setAuxiliary({id:'k-one',body:'overwrite'}),/只允许/);
});
