import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createAnalysisProvider,providerConfig,saveProviderConfig,describeProvider,budgetPayload,registerAnalysisAdapter} from '../src/analysis-providers.mjs';
const result=()=>({summary:'summary',mainTags:[],mainTagUpdates:[],newRelationTypes:[],tags:[],knowledge:[],relations:[],skills:[],vaultRelations:[],issues:[]});
const payload={source:{id:'s',text:'原文逐字保留'},existingCandidates:[{id:'k',excerpt:'candidate text'}],mainTagCandidates:[]};
function directory(t){const meta=fs.mkdtempSync(path.join(os.tmpdir(),'venus-provider-'));t.after(()=>fs.rmSync(meta,{recursive:true,force:true}));return meta;}
for(const provider of ['http','gemini','local'])test(provider+' adapter sends the common contract and parses a stub without model/account access',async t=>{
 const meta=directory(t);saveProviderConfig(meta,{provider,model:'synthetic-model',endpoint:provider==='local'?'http://127.0.0.1:11434/v1':provider==='gemini'?'https://generativelanguage.googleapis.com/v1beta':'https://example.invalid/v1',keyEnv:provider==='local'?'':'SYNTHETIC_KEY',reasoningEffort:provider==='local'?'':'low'});
 let request;const p=createAnalysisProvider(meta,{environment:{SYNTHETIC_KEY:'not-a-real-key'},fetchImpl:async(url,options)=>{request={url,options,body:JSON.parse(options.body)};return {ok:true,json:async()=>provider==='gemini'?{outputs:[{type:'text',text:JSON.stringify(result())}]}:{choices:[{message:{content:JSON.stringify(result())}}]}};}});
 assert.deepEqual(await p.runner(payload),result());assert.equal(request.options.redirect,'error');
 if(provider==='gemini'){assert.ok(request.url.endsWith('/interactions'));assert.equal(request.body.generation_config.thinking_level,'low');assert.equal(request.body.store,false);assert.ok(request.body.input.includes(payload.source.text));}
 else{assert.ok(request.url.endsWith('/chat/completions'));assert.equal(JSON.parse(request.body.messages[1].content).source.text,payload.source.text);}
 if(provider==='local'){assert.equal(request.options.headers.Authorization,undefined);assert.equal(request.body.max_tokens,4096);}
 assert.ok(!JSON.stringify(p.description).includes('not-a-real-key'));
});
test('local mode rejects remote addresses, credentials in URLs and cloud fallback',async t=>{
 assert.throws(()=>providerConfig({provider:'local',endpoint:'https://cloud.invalid/v1'}),/回环地址/);
 assert.throws(()=>providerConfig({provider:'local',endpoint:'http://user:secret@localhost:11434/v1'}),/凭据/);
 assert.throws(()=>providerConfig({apiKey:'secret'}),/凭据/);
 const meta=directory(t);saveProviderConfig(meta,{provider:'local',model:'local-test',endpoint:'http://localhost:11434/v1'});
 let calls=0;const p=createAnalysisProvider(meta,{codexFactory:()=>{throw Error('must not fall back');},fetchImpl:async()=>{calls++;throw Error('secret must not leak');}});
 await assert.rejects(p.runner(payload),/未尝试其他提供方/);assert.equal(calls,1);
});
test('explicit local context budgets never truncate source text or send oversized inputs',async t=>{
 const meta=directory(t),config=providerConfig({provider:'local',model:'test',endpoint:'http://localhost:11434/v1',maxInputCharacters:8000});saveProviderConfig(meta,config);
 const selected=budgetPayload({...payload,source:{text:'x'.repeat(12000)}},config);assert.equal(selected.source.text.length,12000);
 let calls=0;const p=createAnalysisProvider(meta,{fetchImpl:async()=>{calls++;}});await assert.rejects(p.runner(selected),/原文未截断/);assert.equal(calls,0);
});
test('saved provider settings do not change an existing runner or its in-flight provider',async t=>{
 const meta=directory(t),seen=[];const active=createAnalysisProvider(meta,{codexFactory:(_,options)=>async()=>{seen.push(options);return result();}});
 saveProviderConfig(meta,{provider:'local',model:'new-local',endpoint:'http://localhost:11434/v1'});await active.runner(payload);assert.equal(active.config.provider,'codex');assert.equal(seen[0].model,'');assert.equal(seen[0].reasoningEffort,'');
 assert.equal(createAnalysisProvider(meta,{fetchImpl:async()=>{throw Error('not called');}}).config.provider,'local');
});
test('unconfigured and malformed responses fail clearly and extension adapters share the schema',async t=>{
 assert.match(describeProvider(providerConfig({provider:'gemini'}),{}).status,/未配置/);
 const meta=directory(t);registerAnalysisAdapter('test-extension',()=>async()=>result());saveProviderConfig(meta,{provider:'test-extension',model:'fixture'});assert.deepEqual(await createAnalysisProvider(meta).runner(payload),result());
 saveProviderConfig(meta,{provider:'local',model:'test',endpoint:'http://localhost:11434/v1'});const p=createAnalysisProvider(meta,{fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'{}'}}]})})});await assert.rejects(p.runner(payload),/缺少/);
});
