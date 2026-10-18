import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
const port=10002,origin='http://127.0.0.1:'+port,nonce=randomBytes(32).toString('hex');
const client=new URL('../work/tunnel-client-v0.0.16/tunnel-client.exe',import.meta.url);
const profile=new URL('./tunnel-profiles/',import.meta.url);
const {fileURLToPath}=await import('node:url');
let used=false;
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
 if(req.headers.host!=='127.0.0.1:'+port){res.writeHead(403).end();return;}
 if(req.method==='GET'&&req.url==='/'){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="zh"><meta charset="utf-8"><title>Venus Tunnel - 本机密钥输入</title><style>body{background:#111;color:#eee;font:14px system-ui;max-width:620px;margin:10vh auto;padding:24px}input{box-sizing:border-box;width:100%;padding:12px;margin:14px 0}button{padding:12px}code{overflow-wrap:anywhere}</style><h1>连接 Venus 私人隧道</h1><p>目标：<code>YOUR_TUNNEL_ID</code></p><p>仅六个只读工具。密钥只交给本机官方客户端，不保存到磁盘或日志。</p><form method="post" action="/connect" autocomplete="off"><input type="hidden" name="nonce" value="${nonce}"><label>运行 API 密钥<input type="password" name="key" required autocomplete="off" autofocus maxlength="4096"></label><button type="submit">连接 Venus</button></form></html>`);return;
 }
 if(req.method!=='POST'||req.url!=='/connect'||req.headers.origin!==origin||used){res.writeHead(403).end();return;}
 const chunks=[];let length=0;
 try{
  for await(const chunk of req){length+=chunk.length;if(length>8192){res.writeHead(413).end();return;}chunks.push(chunk);}
  const body=Buffer.concat(chunks),params=new URLSearchParams(body.toString('utf8'));body.fill(0);for(const chunk of chunks)chunk.fill(0);
  const supplied=Buffer.from(params.get('nonce')||'');
  if(supplied.length!==nonce.length||!timingSafeEqual(supplied,Buffer.from(nonce))){res.writeHead(403).end();return;}
  let key=(params.get('key')||'').trim();params.delete('key');
  if(!key||/[\r\n]/.test(key)){res.writeHead(400).end('Invalid key input');return;}
  used=true;
  // No key in argv, saved profile, logs, response text, or parent environment.
  const child=spawn(fileURLToPath(client),['run','--profile','venus-readonly','--profile-dir',fileURLToPath(profile)],{windowsHide:true,stdio:'ignore',env:{...process.env,VENUS_TUNNEL_RUNTIME_KEY:key}});key='';
  child.once('error',()=>{console.log(JSON.stringify({state:'client-start-failed'}));process.exitCode=1;});
  child.once('exit',code=>{console.log(JSON.stringify({state:'client-exited',code}));});
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<meta charset="utf-8"><title>Venus Tunnel</title><h1>已向本机客户端提交</h1><p>正在连接；就绪与云端工具调用仍需验证。可以关闭本页。</p>');
  server.close();
 }catch{res.writeHead(400).end('Unable to accept input');}
});
server.once('error',()=>{console.log(JSON.stringify({state:'input-not-started',reason:'port-unavailable'}));process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({state:'awaiting-local-key',url:origin,title:'Venus Tunnel - 本机密钥输入'})));
