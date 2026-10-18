import http from 'node:http';
import net from 'node:net';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const VENUS_TUNNEL_ID='YOUR_TUNNEL_ID';
export function classifyTunnelLog(text){
 // Match an explicit HTTP status or authentication error, never digits in
 // timestamps, request identifiers, durations, or successful log messages.
 const t=String(text);
 if(/\bunauthorized\b|invalid[_ .-]*api[_ .-]*key|\b(?:http(?:\s+status)?|status(?:[_ ]?code)?|response(?:\s+status)?)\s*["']?\s*[:=]?\s*401\b/i.test(t))return 'Runtime authentication failed';
 if(/\bforbidden\b|permission[_ .-]*denied|\b(?:http(?:\s+status)?|status(?:[_ ]?code)?|response(?:\s+status)?)\s*["']?\s*[:=]?\s*403\b/i.test(t))return 'Runtime permission denied';
 if(/address.already.in.use/i.test(t))return 'Health port already in use';
 return '';
}
const binary=fileURLToPath(new URL('../work/tunnel-client-v0.0.16/tunnel-client.exe',import.meta.url)),profiles=fileURLToPath(new URL('./tunnel-profiles/',import.meta.url));
export function createTunnelControl({port=10003,spawnClient,probe,portBusy,handshake}={}){
 const nonce=randomBytes(32).toString('hex');let child=null,error='',starting=false;
 const allowed=new Set(['http://127.0.0.1:10001','http://127.0.0.1:'+port]);
 const launch=spawnClient||((key)=>spawn(binary,['run','--profile','venus-readonly','--profile-dir',profiles],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,VENUS_TUNNEL_RUNTIME_KEY:key}}));
 const check=probe||async function(path){try{return(await fetch('http://127.0.0.1:10002/'+path,{signal:AbortSignal.timeout(1000)})).status===200;}catch{return false;}};
 const busy=portBusy||(()=>new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port:10002});socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>resolve(false));}));
 const localMcp=handshake||new Promise(resolve=>{const c=spawn(process.execPath,[fileURLToPath(new URL('./tunnel-entry.mjs',import.meta.url))],{windowsHide:true,stdio:['pipe','pipe','ignore']});let out='';c.stdout.on('data',d=>{out+=d;if(out.length>100000)c.kill();});c.once('error',()=>resolve(false));c.once('close',()=>{try{const tools=JSON.parse(out.trim()).result.tools;resolve(tools.length===6&&tools.every(t=>t.annotations.readOnlyHint));}catch{resolve(false);}});c.stdin.end(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})+'\n');});
 async function status(){const running=!!child&&child.exitCode===null&&!child.killed,healthy=running&&await check('healthz'),ready=running&&await check('readyz');return {tunnelId:VENUS_TUNNEL_ID,processRunning:running,localMcpReady:await localMcp,healthy,ready,error:ready?'':error,lastError:error,platformRegistration:'not-verified',cloudToolCallVerified:false};}
 const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  const reply=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify(value));};
  if(req.headers.host!=='127.0.0.1:'+(port||server.address()?.port)||(origin&&!allowed.has(origin)))return reply(403,{error:'Origin or host rejected'});
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, POST');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Venus-Token');res.writeHead(204).end();return;}
  if(req.method==='GET'&&req.url==='/status')return reply(200,{...await status(),token:nonce});
  if(req.method==='GET'&&req.url==='/'){
   const s=await status();res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(`<!doctype html><meta charset="utf-8"><title>Venus Tunnel - 本机密钥输入</title><style>body{background:#111;color:#eee;font:14px system-ui;max-width:640px;margin:8vh auto;padding:24px}input{box-sizing:border-box;width:100%;padding:12px;margin:12px 0}button{padding:12px}code{overflow-wrap:anywhere}</style><h1>Venus MCP 连接</h1><p><code>${VENUS_TUNNEL_ID}</code></p><p>仅六个只读工具；密钥不保存。ChatGPT 认证选 None。</p><p>本地 MCP：${s.localMcpReady?'就绪':'未就绪'}；Tunnel：${s.ready?'READY':s.processRunning?'启动中':'未启动'}</p><form method="post" action="/start" autocomplete="off"><input type="hidden" name="token" value="${nonce}"><label>运行 API 密钥<input type="password" name="key" required autocomplete="off" maxlength="4096"></label><button>启动 Tunnel</button></form><form method="post" action="/stop"><input type="hidden" name="token" value="${nonce}"><button>停止本工具启动的 Tunnel</button></form>`);return;
  }
  if(req.method!=='POST'||!allowed.has(origin)||!['/start','/stop'].includes(req.url))return reply(403,{error:'Request rejected'});
  let data;try{const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>8192)return reply(413,{error:'Input too large'});chunks.push(chunk);}const bytes=Buffer.concat(chunks),text=bytes.toString('utf8');data=(req.headers['content-type']||'').includes('application/json')?JSON.parse(text):Object.fromEntries(new URLSearchParams(text));bytes.fill(0);for(const c of chunks)c.fill(0);}catch{return reply(400,{error:'Invalid input'});}
  const token=Buffer.from(req.headers['x-venus-token']||data.token||'');if(token.length!==nonce.length||!timingSafeEqual(token,Buffer.from(nonce)))return reply(403,{error:'Token rejected'});
  if(req.url==='/stop'){if(child&&child.exitCode===null&&!child.killed)child.kill();return reply(200,{stopped:true,...await status()});}
  if(starting||child&&child.exitCode===null&&!child.killed)return reply(409,{error:'Client already running'});
  if(data.tunnelId&&data.tunnelId!==VENUS_TUNNEL_ID)return reply(400,{error:'Only the user-selected Venus tunnel is allowed'});
  let key=String(data.key||'').trim();delete data.key;if(!key||key.length>4096||/[\r\n]/.test(key))return reply(400,{error:'Runtime key required'});
  starting=true;try{
   if(await busy())return reply(409,{error:'Port 10002 is occupied. No other process was stopped.'});
   error='';child=launch(key);key='';
   const classify=chunk=>{const classified=classifyTunnelLog(chunk);if(classified)error=classified;};
   child.stdout?.on('data',classify);child.stderr?.on('data',classify);
   child.once('error',()=>{error='Official client could not start';});child.once('exit',code=>{if(code&&!error)error='Official client exited with code '+code;});
   return reply(200,{started:true,...await status()});
  }catch{error='Official client could not start';return reply(500,{error});}finally{starting=false;key='';}
 });return {server,status};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){const {server}=createTunnelControl();server.once('error',()=>{console.log('Venus local control could not bind port 10003');process.exitCode=1;});server.listen(10003,'127.0.0.1',()=>console.log('Venus local control ready at http://127.0.0.1:10003'));}
