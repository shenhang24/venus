import test from 'node:test';
import assert from 'node:assert/strict';
import {runButtonAction,currentButtonAction,actionResult,SavedProgressObserver,processingState} from '../public/knowledge-view.js';
import {setLanguage} from '../public/i18n.js';
const button=()=>({id:'test-action',dataset:{},textContent:'Start',getAttribute:()=>null,setAttribute(){},removeAttribute(){}});
test('one pending action blocks duplicate invocation and stays pending until its real result',async()=>{
 let finish,calls=0;const b=button(),wait=new Promise(resolve=>finish=resolve);
 const first=runButtonAction(b,()=>{calls++;return wait;}),second=runButtonAction(b,()=>{calls++;});
 assert.equal(first,second);assert.equal(calls,1);assert.equal(b.dataset.actionBusy,'true');finish({queued:true});assert.deepEqual(await first,{queued:true});assert.equal(b.dataset.actionBusy,undefined);
});
test('API failure remains a failure even when an existing handler catches it',async()=>{
 let context;await runButtonAction(button(),async()=>{context=currentButtonAction();actionResult(context,{error:'source changed'});});assert.equal(context.error,'source changed');
 await assert.rejects(runButtonAction(button(),async()=>{throw Error('offline');}),/offline/);
});
test('a single action retains error feedback after asynchronous work resumes',async()=>{
 let context;await runButtonAction(button(),async()=>{await Promise.resolve();context=currentButtonAction();actionResult(context,{error:'second request failed'});});assert.equal(context.error,'second request failed');
});
test('saved progress only advances on changed saved offsets, never on elapsed time',()=>{
 const observer=new SavedProgressObserver();assert.equal(observer.observe('a',320000,100).lastAdvance,null);assert.equal(observer.observe('a',320000,20000).lastAdvance,null);assert.equal(observer.observe('a',384000,21000).lastAdvance,21000);assert.equal(observer.observe('a',384000,40000).lastAdvance,21000);assert.equal(observer.observe('b',0,40000).lastAdvance,null);
});
test('stopped review cannot appear running because old enabled or error state remains',()=>{
 setLanguage('en');const state={nodes:[],analysis:{enabled:false,completed:354,total:354},conceptContentReview:{workerRunning:false,status:'needs-review',completed:35,total:354,current:{id:'source',title:'Source',offset:320000,total:486089},lastError:{message:'rejected'}}};
 const stopped=processingState(state);assert.equal(stopped.mode,'failed');assert.equal(stopped.offset,320000);assert.equal(stopped.range,null);assert.deepEqual(stopped.count,[35,354]);state.conceptContentReview.workerRunning=true;assert.equal(processingState(state).mode,'running');setLanguage('zh');
});
test('queued independent tasks and main pause have distinct real states',()=>{
 assert.equal(processingState({independentLayers:{queued:1}}).mode,'queued');assert.equal(processingState({analysis:{enabled:false,completed:1,total:4}}).mode,'paused');assert.equal(processingState({analysis:{enabled:true,completed:4,total:4}}).mode,'complete');
});
