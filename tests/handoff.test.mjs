import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {Store} from '../src/store.mjs';import {AutoAnalyzer} from '../src/analyzer.mjs';import {createReadQuery} from '../src/readonly-query.mjs';
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'venus-handoff-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return new Store(root);}
test('dated imports retain original bytes and provenance while duplicate submissions do not requeue completed files',t=>{
 const store=fixture(t),body='# Original\n\n原文 preserved',first=store.import({name:'daily.md',body,originId:'conversation-1',sourceDate:'2026-10-17',originVersion:'v1'}).node;
 store.job({sourceId:first.id,status:'done',stage:'complete'});const duplicate=store.import({name:'renamed.md',body,originId:'conversation-1',sourceDate:'2026-10-17',originVersion:'v1'});
 assert.ok(duplicate.duplicate);assert.equal(store.state.jobs.find(j=>j.sourceId===first.id).status,'done');assert.equal(fs.readFileSync(path.join(store.root,first.path),'utf8'),body);
 const second=store.import({name:'daily.md',body:body+'\nnext',originId:'conversation-1',sourceDate:'2026-10-18',originVersion:'v2'}).node;
 assert.equal(second.importProvenance[0].previousVersionNodeId,first.id);assert.equal(first.id,duplicate.node.id);
 const read=createReadQuery(store);assert.equal(read('search',{date:'2026-10-17'}).items[0].id,first.id);assert.ok(read('node',{id:first.id}).updatedAt);
 read.setAuxiliary({id:first.id,expectedHash:first.hash,expectedVersion:0,aliases:[{name:'原始记录',quote:'原文'}]});assert.equal(createReadQuery(new Store(store.root))('search',{q:'原始记录'}).items[0].id,first.id);assert.equal(fs.readFileSync(path.join(store.root,first.path),'utf8'),body);
});
test('incremental handoff cursors deduplicate raw segments and archival full snapshots do not reanalyse saved deltas',t=>{
 const store=fixture(t),first=store.checkpoint({originId:'thread-1',eventId:'one',cursor:'1',body:'first raw\n',sourceDate:'2026-10-17'});
 const analyzer=new AutoAnalyzer(store,{runner:async()=>{throw Error('No model should be called');}});analyzer.discover();const entry=analyzer.state.entries[first.checkpoint.nodeId];entry.status='done';entry.offset='first raw\n'.length;
 const second=store.checkpoint({originId:'thread-1',eventId:'two',cursor:'2',expectedCursor:'1',body:'second raw\n'});
 const snapshot=store.checkpoint({originId:'thread-1',eventId:'closed',cursor:'3',expectedCursor:'2',body:'first raw\nsecond raw\n',mode:'snapshot',final:true});assert.ok(snapshot.checkpoint.archiveOnly);assert.equal(snapshot.platformEventObserved,false);
 analyzer.discover();assert.equal(analyzer.state.entries[first.checkpoint.nodeId].status,'done');assert.ok(analyzer.state.entries[second.checkpoint.nodeId]);assert.equal(analyzer.state.entries[snapshot.checkpoint.nodeId],undefined);
 const replay=store.checkpoint({originId:'thread-1',eventId:'two',cursor:'2',expectedCursor:'1',body:'second raw\n'});assert.ok(replay.duplicate);
 assert.throws(()=>store.checkpoint({originId:'thread-1',eventId:'two',cursor:'2',body:'different'}),/事件内容冲突/);assert.throws(()=>store.checkpoint({originId:'thread-1',eventId:'bad',cursor:'4',expectedCursor:'1',body:'not saved'}),/游标已变化/);
 const handoff=createReadQuery(store)('handoff',{originId:'thread-1'});assert.equal(handoff.latest.cursor,'3');assert.equal(handoff.platformSubscriptionConnected,false);assert.equal(store.find(snapshot.checkpoint.nodeId).body,'first raw\nsecond raw\n');
});
