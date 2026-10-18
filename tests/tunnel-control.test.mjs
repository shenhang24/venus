import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import {once} from 'node:events';
import {createTunnelControl,VENUS_TUNNEL_ID,classifyTunnelLog} from '../codex-plugin/tunnel-control.mjs';
test('authentication classification ignores timestamp and identifier digits and recognizes explicit failures',()=>{
 assert.equal(classifyTunnelLog('{"level":"info","time":"2026-10-17T12:00:00.401Z","msg":"ready","request_id":"req_401abc403"}'),'');
 assert.equal(classifyTunnelLog('duration_ms=403.4 poll success'),'');
 assert.equal(classifyTunnelLog('HTTP status 401'),'Runtime authentication failed');
 assert.equal(classifyTunnelLog('{"status_code":401,"msg":"request rejected"}'),'Runtime authentication failed');
 assert.equal(classifyTunnelLog('status=403'),'Runtime permission denied');
});
test('local tunnel controls reject cross-site requests and bad nonce, allow only selected tunnel, never echo a key, and stop only their child',async t=>{
 let receivedKey='',starts=0,stops=0;
 const child=new EventEmitter();Object.assign(child,{exitCode:null,killed:false,stdout:new EventEmitter(),stderr:new EventEmitter(),kill(){stops++;this.killed=true;this.exitCode=0;this.emit('exit',0);}});
 const {server}=createTunnelControl({port:0,handshake:Promise.resolve(true),probe:async()=>true,portBusy:async()=>false,spawnClient:key=>{receivedKey=key;starts++;return child;}});
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.close());const url='http://127.0.0.1:'+server.address().port;
 const headers={Origin:'http://127.0.0.1:10001','Content-Type':'application/json'};
 const status=await(await fetch(url+'/status',{headers})).json();assert.equal(status.processRunning,false);assert.equal(status.localMcpReady,true);assert.equal(status.tunnelId,VENUS_TUNNEL_ID);
 assert.equal((await fetch(url+'/status',{headers:{...headers,Origin:'https://attacker.example'}})).status,403);
 assert.equal((await fetch(url+'/start',{method:'POST',headers,body:JSON.stringify({key:'synthetic-test-only'})})).status,403);
 headers['X-Venus-Token']=status.token;
 assert.equal((await fetch(url+'/start',{method:'POST',headers,body:JSON.stringify({key:'synthetic-test-only',tunnelId:'tunnel_wrong'})})).status,400);assert.equal(starts,0);
 const started=await fetch(url+'/start',{method:'POST',headers,body:JSON.stringify({key:'synthetic-test-only',tunnelId:VENUS_TUNNEL_ID})});const text=await started.text();assert.equal(started.status,200);assert.ok(!text.includes('synthetic-test-only'));assert.equal(receivedKey,'synthetic-test-only');assert.equal(JSON.parse(text).ready,true);
 assert.equal((await fetch(url+'/start',{method:'POST',headers,body:JSON.stringify({key:'synthetic-test-only'})})).status,409);assert.equal(starts,1);
 child.stderr.emit('data',Buffer.from('401 invalid API key synthetic-test-only'));
 const failed=await(await fetch(url+'/status',{headers})).json();assert.equal(failed.error,'');assert.equal(failed.lastError,'Runtime authentication failed');assert.equal(failed.ready,true);assert.ok(!JSON.stringify(failed).includes('synthetic-test-only'));
 const stopped=await(await fetch(url+'/stop',{method:'POST',headers,body:'{}'})).json();assert.equal(stopped.processRunning,false);assert.equal(stops,1);assert.equal(stopped.cloudToolCallVerified,false);
});
test('an occupied health port prevents launch without stopping another process',async t=>{
 const {server}=createTunnelControl({port:0,handshake:Promise.resolve(true),portBusy:async()=>true,spawnClient(){throw Error('must not run');}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.close());
 const url='http://127.0.0.1:'+server.address().port,headers={Origin:'http://127.0.0.1:10001','Content-Type':'application/json'};const status=await(await fetch(url+'/status',{headers})).json();headers['X-Venus-Token']=status.token;
 const r=await fetch(url+'/start',{method:'POST',headers,body:JSON.stringify({key:'synthetic-test-only'})});assert.equal(r.status,409);assert.match((await r.json()).error,/occupied/);
});
