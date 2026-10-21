import fs from 'node:fs';import path from 'node:path';
import {analysisSchema,analysisInstructions,createModelRunner} from './analysis-model.mjs';
import {UsageRequest} from './usage-meter.mjs';
import {currentMaterialInput} from './current-material.mjs';

const adapters=new Map();
export function registerAnalysisAdapter(name,factory){if(!/^[a-z][a-z0-9-]*$/.test(name)||typeof factory!=='function')throw Error('无效适配器');adapters.set(name,factory);}
const integer=(v,fallback,min,max)=>{const n=v===undefined?fallback:Number(v);if(!Number.isInteger(n)||n<min||n>max)throw Error('分段或上下文预算超出范围');return n;};
export function providerConfig(input={}){
  const provider=input.provider||'codex';if(!['codex','http','gemini','local',...adapters.keys()].includes(provider))throw Error('未配置支持的模型适配器');
  const local=provider==='local',model=String(input.model||'').trim(),reasoningEffort=String(input.reasoningEffort||'');
  if(reasoningEffort&&!['none','minimal','low','medium','high','xhigh','max'].includes(reasoningEffort))throw Error('推理强度无效');
  const endpoint=String(input.endpoint||'').trim();
  if(endpoint){const url=new URL(endpoint);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('地址不能包含凭据、查询参数或片段');
    if(local&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('本地模式只允许回环地址，禁止发送到外部');
    if(!local&&url.protocol!=='https:')throw Error('云端接入须使用 HTTPS');}
  const keyEnv=String(input.keyEnv||'').trim();if(keyEnv&&!/^[A-Za-z_][A-Za-z0-9_]*$/.test(keyEnv))throw Error('仅填写密钥环境变量名，不填写密钥');
  if(input.apiKey||input.key||input.token)throw Error('凭据不能通过配置写入；请使用本机环境变量');
  return {provider,model,reasoningEffort,endpoint,keyEnv,chunkCharacters:integer(input.chunkCharacters,local?6000:40000,1000,40000),maxInputCharacters:integer(input.maxInputCharacters,local?48000:300000,8000,2000000),maxOutputTokens:integer(input.maxOutputTokens,local?4096:16000,512,64000),candidateLimit:integer(input.candidateLimit,local?6:44,0,44),candidateExcerptCharacters:integer(input.candidateExcerptCharacters,local?1000:8000,200,8000),mainTagCandidateLimit:integer(input.mainTagCandidateLimit,local?2:20,0,20),format:input.format==='json'?'json':'schema'};
}
const fileOf=meta=>path.join(meta,'analysis-provider.json');
export function readProviderConfig(meta){return providerConfig(fs.existsSync(fileOf(meta))?JSON.parse(fs.readFileSync(fileOf(meta),'utf8')):{});}
export function saveProviderConfig(meta,input){const config=providerConfig(input);fs.mkdirSync(meta,{recursive:true});const file=fileOf(meta),temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(config,null,2),{mode:0o600});fs.renameSync(temp,file);return config;}
export function describeProvider(config,environment=process.env){
  const missing=[];if(config.provider!=='codex'&&!config.model)missing.push('模型名');if(['http','local'].includes(config.provider)&&!config.endpoint)missing.push('服务地址');
  if(['http','gemini'].includes(config.provider)&&(!config.keyEnv||!environment[config.keyEnv]))missing.push('密钥环境变量');
  return {...config,keyConfigured:!!(config.keyEnv&&environment[config.keyEnv]),configured:missing.length===0,status:missing.length?'未配置：'+missing.join('、'):'已配置，尚未验证连接',modelResolved:false};
}
function contract(schema,value,label='result'){
  if(schema.type==='array'){if(!Array.isArray(value))throw Error(label+' 必须是数组');for(const x of value)contract(schema.items,x,label+'[]');}
  else if(schema.type==='object'){if(!value||typeof value!=='object'||Array.isArray(value))throw Error(label+' 必须是对象');for(const key of schema.required||[])if(!(key in value))throw Error(label+' 缺少 '+key);for(const [key,x]of Object.entries(value)){if(!schema.properties[key]){if(schema.additionalProperties===false)throw Error(label+' 含未知字段');}else contract(schema.properties[key],x,label+'.'+key);}}
  else if(schema.type==='number'){if(typeof value!=='number'||!Number.isFinite(value))throw Error(label+' 必须是数值');}
  else if(typeof value!==schema.type)throw Error(label+' 类型错误');
  if(schema.enum&&!schema.enum.includes(value))throw Error(label+' 取值无效');
}
export function budgetPayload(payload,config){
  // Only explicitly configured auxiliary excerpts are budgeted. Source text is
  // never sliced here: the scheduler processes every character in saved chunks.
  return {...payload,existingCandidates:(payload.existingCandidates||[]).slice(0,config.candidateLimit).map(c=>({...c,excerpt:c.excerpt.slice(0,config.candidateExcerptCharacters)})),mainTagCandidates:(payload.mainTagCandidates||[]).slice(0,config.mainTagCandidateLimit)};
}
export function createAnalysisProvider(meta,{fetchImpl=fetch,environment=process.env,codexFactory=createModelRunner,config:requestedConfig,usageFamily}={}){
  const config=requestedConfig?providerConfig(requestedConfig):readProviderConfig(meta),description=describeProvider(config,environment);let codex;
  const runner=async(payload,{signal}={})=>{
    if(config.provider==='codex'){codex||=codexFactory(path.join(meta,'analysis-runtime'),{...config,usageMeta:meta,usageFamily});return codex(payload,{signal});}
    if(!description.configured)throw Error(description.status+'；未发送资料，不会切换到云端备用服务');
    const selected=budgetPayload(currentMaterialInput(payload),config),instructions=analysisInstructions+'\n若输入有 analysisTemplates，以确认模板决定正文结构和分析项，知识/技能写 body、概念写 explanation；模板不是事实证据。保留来源、认可准入与立场边界。',prompt=instructions+JSON.stringify(selected);
    if(prompt.length+JSON.stringify(analysisSchema).length>config.maxInputCharacters)throw Error('输入字符预算不足；原文未截断、尚未发送，请调整明确的分段或上下文预算');
    if(adapters.has(config.provider)){const result=await adapters.get(config.provider)({config,schema:analysisSchema,instructions,environment})(selected,{signal});contract(analysisSchema,result);return result;}
    const headers={'Content-Type':'application/json'},key=config.keyEnv?environment[config.keyEnv]:null;
    let endpoint,body;
    if(config.provider==='gemini'){
      endpoint=(config.endpoint||'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/,'')+'/interactions';headers['x-goog-api-key']=key;
      body={model:config.model,input:prompt,store:false,response_format:{type:'text',mime_type:'application/json',schema:analysisSchema},generation_config:{max_output_tokens:config.maxOutputTokens,...(config.reasoningEffort?{thinking_level:config.reasoningEffort}:{})}};
    }else{
      endpoint=config.endpoint.replace(/\/$/,'');if(!endpoint.endsWith('/chat/completions'))endpoint+='/chat/completions';
      if(key)headers.Authorization='Bearer '+key;
      body={model:config.model,messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify(selected)}],max_completion_tokens:config.maxOutputTokens,response_format:config.format==='schema'?{type:'json_schema',json_schema:{name:'venus_analysis',strict:true,schema:analysisSchema}}:{type:'json_object'},...(config.reasoningEffort?{reasoning_effort:config.reasoningEffort}:{})};
      if(config.provider==='local'){body.max_tokens=body.max_completion_tokens;delete body.max_completion_tokens;}
      if(config.format==='json')body.messages[0].content+='\nJSON Schema: '+JSON.stringify(analysisSchema);
    }
    const requestSignal=signal?AbortSignal.any([signal,AbortSignal.timeout(12*60*1000)]):AbortSignal.timeout(12*60*1000);
    const usage=new UsageRequest(meta,{provider:config.provider,model:config.model,family:usageFamily});
    let response;try{response=await fetchImpl(endpoint,{method:'POST',headers,body:JSON.stringify(body),redirect:'error',signal:requestSignal});}catch{usage.finish(null,config.provider,{status:signal?.aborted?'cancelled':'failed'});if(signal?.aborted)throw Error('ANALYSIS_CANCELLED');throw Error('模型服务连接失败或超时；未尝试其他提供方');}
    let data;try{data=await response.json();}catch{usage.finish(null,config.provider,{status:'failed'});throw Error('模型服务未返回有效 JSON');}
    usage.finish(data.usage,config.provider,{providerRequestId:data.id||response.headers?.get?.('x-request-id'),model:data.model,status:response.ok?'completed':'failed'});
    if(!response.ok)throw Error('模型服务 HTTP '+response.status+'；未切换其他提供方');
    const text=config.provider==='gemini'?(data.output_text||data.outputs?.filter(o=>o.type==='text').map(o=>o.text||'').join('')):data.choices?.[0]?.message?.content;
    let result;try{result=typeof text==='string'?JSON.parse(text):null;}catch{throw Error('模型输出不是有效 JSON；断点保留');}
    contract(analysisSchema,result);return result;
  };
  runner.providerDescription=description;return {runner,config,description};
}
