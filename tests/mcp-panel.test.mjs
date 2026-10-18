import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {once} from 'node:events';
import {parsers} from 'prettier/plugins/acorn.mjs';import {createApp} from '../src/server.mjs';
export async function renderMcpPanel(source){
 const ast=parsers.acorn.parse(source,{}),extract=name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(n.start,n.end);};
 const elements=new Map();
 function element(id){if(elements.has(id))return elements.get(id);const e={id,value:'',hidden:false,disabled:false,open:false,attributes:{},showModal(){this.open=true;},textContent:''};Object.defineProperty(e,'innerHTML',{get(){return this.html||'';},set(html){this.html=html;for(const match of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const child=element(match[3]);child.tag=match[1];for(const attr of match[2].matchAll(/([\w-]+)="([^"]*)"/g))child.attributes[attr[1]]=attr[2];child.value=child.attributes.value||'';}}});elements.set(id,e);return e;}
 const calls=[],fetchStub=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({token:'synthetic-nonce',localMcpReady:true,processRunning:false,ready:false})};};
 const run=new Function('$','tr','esc','fetch','AbortSignal','setInterval','clearInterval','toast',"let submitAction;\n"+extract('modal')+'\n'+extract('mcpDialog')+'\nreturn mcpDialog();');
 await run(selector=>element(selector.slice(1)),s=>s,s=>String(s).replaceAll('<','&lt;'),fetchStub,AbortSignal,()=>1,()=>{},()=>{});
 return {elements,calls};
}
test('the actual MCP dialog renderer opens a masked input and enabled start/refresh controls without a feature gate',async()=>{
 const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),{elements,calls}=await renderMcpPanel(source);
 assert.equal(elements.get('modal').open,true);assert.equal(elements.get('modal-title').textContent,'MCP 连接');assert.equal(elements.get('tunnel-key').attributes.type,'password');assert.equal(elements.get('tunnel-key').attributes.autocomplete,'off');
 for(const id of ['tunnel-start','tunnel-refresh']){assert.equal(typeof elements.get(id).onclick,'function');assert.equal(elements.get(id).hidden,false);assert.equal(elements.get(id).disabled,false);}
 assert.equal(elements.get('tunnel-id').value,'YOUR_TUNNEL_ID');assert.equal(elements.get('tunnel-stop').disabled,true);
 assert.ok(calls.every(c=>c.url.startsWith('/api/mcp-control/')));assert.equal(calls[0].url,'/api/mcp-control/status');
 elements.get('tunnel-key').value='synthetic-runtime-key';await elements.get('tunnel-start').onclick();assert.equal(elements.get('tunnel-key').value,'');assert.ok(calls.some(c=>c.url==='/api/mcp-control/start'));
});
test('same-origin MCP routes work without expanding CSP and retain cross-site write rejection',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'venus-mcp-panel-')),calls=[];
 const {app}=createApp({root,port:10001,tunnelControlTransport:async(op,options)=>{calls.push({op,options});return {status:200,data:{localMcpReady:true,ready:false}};}});app.listen(0,'127.0.0.1');await once(app,'listening');t.after(()=>{app.close();app.closeAllConnections();fs.rmSync(root,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+app.address().port;
 const page=await fetch(base+'/');assert.match(page.headers.get('content-security-policy'),/connect-src 'self';/);assert.match(await page.text(),/id="mcp-connect-open"/);
 assert.equal((await fetch(base+'/api/mcp-control/status')).status,200);
 const options={method:'POST',headers:{Origin:'http://127.0.0.1:10001','Content-Type':'application/json','X-Venus-Token':'synthetic-nonce'},body:JSON.stringify({key:'synthetic-runtime-key',tunnelId:'YOUR_TUNNEL_ID'})};
 assert.equal((await fetch(base+'/api/mcp-control/start',options)).status,200);assert.equal(calls.at(-1).options.token,'synthetic-nonce');
 assert.equal((await fetch(base+'/api/mcp-control/start',{...options,headers:{...options.headers,Origin:'https://attacker.example'}})).status,403);
 for(const name of fs.readdirSync(root,{recursive:true})){const file=path.join(root,name);if(fs.statSync(file).isFile())assert.ok(!fs.readFileSync(file,'utf8').includes('synthetic-runtime-key'));}
});
