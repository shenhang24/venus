import {execFile} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {promisify} from 'node:util';
import {createAnalysisProvider,describeProvider,readProviderConfig,providerConfig} from './analysis-providers.mjs';
import {resolveCodex} from './analysis-model.mjs';
const execute=promisify(execFile);
const families=['claude','gemini','gpt','local'];
const steps={claude:['安装或打开 Claude 本机客户端，并由你完成登录。','若使用模型 API，在“模型接入配置”填写兼容服务地址、模型名与已由你设置的密钥环境变量名；不在页面填写密钥。'],gemini:['安装或打开 Gemini 本机客户端，并由你完成登录。','若使用 Gemini API，由你设置密钥环境变量，再在“模型接入配置”选择 Gemini 接入并填写模型名。'],gpt:['安装 Codex 本机客户端并完成登录。','本入口只读取登录状态，不会打开授权流程或切换现有分析。'],local:['启动本机 Ollama、LM Studio 或已配置的兼容模型服务。','在本机服务中加载模型；本入口仅定点检查配置地址及 127.0.0.1:11434、127.0.0.1:1234。']};
async function locate(family){
 if(family==='gpt'){try{return await resolveCodex();}catch{return null;}}
 const command=family==='claude'?'claude':'gemini';
 if(process.platform==='win32'){try{const {stdout}=await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$c=Get-Command ${command} -ErrorAction SilentlyContinue; if($c){$c.Source}`],{windowsHide:true,timeout:4000});return stdout.trim()||null;}catch{return null;}}
 try{const {stdout}=await execute('which',[command],{timeout:2000});return stdout.trim()||null;}catch{return null;}
}
export class AIConnections {
 constructor(meta,{active,findClient=locate,fetchImpl=fetch,environment=process.env,exec=execute}={}){Object.assign(this,{meta,active,findClient,fetchImpl,environment,exec});this.results=new Map();this.profiles=new Map();}
 runnerFor(family){const profile=this.profiles.get(family);if(!profile||!this.results.get(family)?.ready)throw Object.assign(Error('请先在对应 AI 入口开始检测并确认可用连接'),{status:409});return createAnalysisProvider(this.meta,{config:profile,fetchImpl:this.fetchImpl,environment:this.environment,usageFamily:family}).runner;}
 saved(){try{return JSON.parse(fs.readFileSync(path.join(this.meta,'ai-connection-profiles.json')));}catch{return {};}}
 configure({family,...input}){if(!families.includes(family))throw Object.assign(Error('未知 AI 入口'),{status:400});const config=providerConfig(input),allowed={claude:['http'],gemini:['gemini','http'],gpt:['codex','http'],local:['local']};if(!allowed[family].includes(config.provider))throw Error('该入口的接入方式不匹配');const profiles=this.saved();profiles[family]=config;const file=path.join(this.meta,'ai-connection-profiles.json');fs.writeFileSync(file+'.tmp',JSON.stringify(profiles,null,2));fs.renameSync(file+'.tmp',file);this.results.delete(family);this.profiles.delete(family);return {saved:true,family,config:describeProvider(config,this.environment),currentAnalysisUnchanged:true,modelCallsStarted:false};}
 summary(){return {families:families.map(id=>({id,detected:false,...this.results.get(id)})),saved:Object.fromEntries(Object.entries(this.saved()).map(([id,config])=>[id,describeProvider(config,this.environment)])),active:this.active,modelCallsStarted:false,mcp:{purpose:'只读知识检索，不能代替模型推理连接',automaticallyEnabled:false}};}
 async detect({family}){
  if(!families.includes(family))throw Object.assign(Error('未知 AI 入口'),{status:400});
  this.profiles.delete(family);
  const stored=this.saved()[family],config=stored||(family==='gpt'&&this.active?.provider==='codex'?this.active:readProviderConfig(this.meta)),configured=describeProvider(config,this.environment),result={id:family,detected:true,checkedAt:new Date().toISOString(),clientFound:false,ready:false,status:'尚未发现可直接复用的模型连接',steps:steps[family],modelCallsStarted:false,mcp:{purpose:'只读知识检索',enabledByThisCheck:false}};
  const matches=!!stored||(family==='gpt'?config.provider==='codex':family==='gemini'?config.provider==='gemini':family==='claude'?config.provider==='http'&&/claude/i.test(config.model):config.provider==='local');
  if(family!=='local'){
   const client=await this.findClient(family);result.clientFound=!!client;
   if(family==='gpt'&&client){try{const {stdout,stderr}=await this.exec(client,['login','status'],{windowsHide:true,timeout:5000,maxBuffer:16000});result.authenticated=/logged in|已登录/i.test(stdout+' '+stderr)&&!/not logged in|未登录/i.test(stdout+' '+stderr);}catch{result.authenticated=false;}}
   if(matches&&configured.configured&&(config.provider!=='codex'||result.authenticated)){result.ready=true;result.status='已有模型连接可复用；本次未调用模型';result.connection={provider:config.provider,model:config.model};this.profiles.set(family,config);}
   else if(client)result.status=family==='gpt'?'已发现本机客户端，尚未确认登录':'已发现本机客户端；网页或客户端登录不等于可用的模型 API，需配置兼容连接';
  }else{
   const endpoints=new Set(['http://127.0.0.1:11434/v1/models','http://127.0.0.1:1234/v1/models']);
   if(matches&&config.endpoint){const u=new URL(config.endpoint);if(['localhost','127.0.0.1','[::1]'].includes(u.hostname))endpoints.add(config.endpoint.replace(/\/$/,'')+'/models');}
   result.services=[];
   for(const endpoint of endpoints){try{const response=await this.fetchImpl(endpoint,{signal:AbortSignal.timeout(1400)});if(!response.ok)continue;const data=await response.json(),models=(data.data||[]).map(n=>n.id).filter(n=>typeof n==='string').slice(0,20);result.services.push({endpoint,models});}catch{}}
   const configuredService=matches&&configured.configured?result.services.find(s=>s.models.includes(config.model)):null,service=configuredService||result.services.find(s=>s.models.length);
   result.ready=!!service;result.status=result.ready?'已有本地模型服务可复用；未调用推理':result.services.length?'已发现本地服务，请先加载模型':'未发现上述定点地址的可用模型服务';
   if(result.ready){const model=configuredService?config.model:service.models[0],profile={provider:'local',model,endpoint:service.endpoint.replace(/\/models$/,''),reasoningEffort:'low'};result.connection={provider:'local',model};this.profiles.set(family,profile);}
  }
  this.results.set(family,result);return result;
 }
}
