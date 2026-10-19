import test from 'node:test';import assert from 'node:assert/strict';
import {compactQuery,relevance} from '../codex-plugin/query.mjs';
test('compact query ranks names and aliases, caps bodies/sources, uses only search/node',async()=>{
 const calls=[];const client=async(op,args)=>{calls.push([op,args]);if(op==='search')return {total:40,searchScope:'saved-local-text',items:[{id:'k-1',title:'Mention AVT',excerpt:''},{id:'k-2',title:'AVT',excerpt:''},{id:'k-3',title:'Digital individual',auxiliary:{aliases:[{name:'AVT'}]}},{id:'k-4',title:'Other AVT'}]};return {id:args.id,title:args.id,body:'definition',offset:0,totalCharacters:2000,nextOffset:1200,sources:Array.from({length:5},(_,i)=>({id:'v-'+i,locator:'字符 1–20',quote:'x'.repeat(300),node:{title:'source'}}))};};
 const r=await compactQuery('AVT',{client,limit:2});assert.deepEqual(r.items.map(x=>x.id),['k-2','k-3']);assert.equal(calls.length,3);assert.equal(calls[0][1].limit,25);assert.ok(calls.slice(1).every(([op,a])=>op==='node'&&a.length===1200));assert.equal(r.items[0].sources.length,3);assert.equal(r.items[0].sources[0].quote.length,160);assert.equal(r.items[0].truncated,true);assert.equal(r.timing.bridgeQueueMs,null);
});
test('invalid/empty requests do no IO, partial read failures retain search evidence',async()=>{
 let calls=0;const client=async(op)=>{calls++;if(op==='search')return {total:1,items:[{id:'k-1',title:'AVT',excerpt:'evidence'}]};throw Error('unavailable');};
 await assert.rejects(()=>compactQuery('',{client}));await assert.rejects(()=>compactQuery('AVT',{client,limit:4}));assert.equal(calls,0);
 const r=await compactQuery('AVT',{client});assert.equal(r.items[0].excerpt,'evidence');assert.equal(r.items[0].error,'unavailable');assert.ok(relevance({title:'AVT'},'AVT')>relevance({title:'Other AVT'},'AVT'));
});
