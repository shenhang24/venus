import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store,hash} from '../src/store.mjs';
import {ConceptExtractor} from '../src/concepts.mjs';
import {AutoAnalyzer} from '../src/analyzer.mjs';

test('history follows original import queue and skips saved coverage despite reversed file scan order',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'venus-concept-order-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const s=new Store(root),first=s.import({name:'z-first',body:'先前区间。后续缺口。'}).node,second=s.import({name:'a-second',body:'第二份资料。'}).node,c=new ConceptExtractor(s),a=new AutoAnalyzer(s,{conceptExtractor:c});
 a.discover();for(const e of Object.values(a.state.entries))e.status='done';c.initializeBatch();
 c.consume(first,{start:0,end:5,text:first.body.slice(0,5)},[]);
 s.nodes.sort((x,y)=>x.id===second.id?-1:y.id===second.id?1:0);
 const next=c.nextHistorical();assert.equal(next.source.id,first.id);assert.equal(next.part.start,5);
 c.consume(first,{start:5,end:first.body.length,text:first.body.slice(5)},[]);
 assert.equal(c.nextHistorical().source.id,second.id);
});

test('targeted concept recovery regenerates rejected cache, preserves coverage and completed analysis',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'venus-recovery-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const s=new Store(root),v=s.import({name:'local-source',body:'已读内容。剩余内容。'}).node,c=new ConceptExtractor(s);
 const calls=[],a=new AutoAnalyzer(s,{conceptExtractor:c,maxConcurrent:5,runner:async p=>{calls.push(p);return {concepts:[],unresolvedQuestions:[]};}});
 a.discover();const e=a.state.entries[v.id];e.status='done';e.offset=v.body.length;c.initializeBatch();
 c.consume(v,{start:0,end:5,text:v.body.slice(0,5)},[]);
 const part={start:5,end:v.body.length,text:v.body.slice(5)},key=hash(v.id+'|'+v.hash+'|5');
 const cache='concept-'+hash(v.id+'|'+v.hash+'|5|'+part.end)+'.json';
 fs.writeFileSync(path.join(a.directory,cache),'invalid cached output');
 c.defer(v,part,cache,Error('可忽略问题须定位到已读原问题'));
 c.state.failures={[key]:{attempts:3,error:'可忽略问题须定位到已读原问题',retryAt:9999999999999}};
 const other='a'.repeat(64);c.state.failures[other]={attempts:3,error:'unrelated',retryAt:123};
 const saved=structuredClone(e);
 assert.equal(c.nextHistorical(),null);
 assert.deepEqual(c.retryFailed({keys:[key]}).retried,[key]);
 assert.equal(c.state.failures[other].attempts,3);
 await a.processConceptBackfill();
 assert.equal(calls.length,1);assert.equal(calls[0].purpose,'concept-only');
 assert.equal(calls[0].source.offset,5);assert.equal(calls[0].validationFeedback,'可忽略问题须定位到已读原问题');
 assert.deepEqual(c.gaps(v),[]);assert.deepEqual(e,saved);
 assert.equal(c.state.pending[key],undefined);assert.equal(c.state.failures[key],undefined);
 assert.ok(fs.readdirSync(a.directory).some(n=>n.startsWith(cache+'.previous-')));
 assert.throws(()=>c.retryFailed({keys:['../invalid']}),/须指定/);
});
