import fs from 'node:fs';import path from 'node:path';
import {hash} from './store.mjs';
import {conceptAdmission,collectConceptEvidence} from './concept-admission.mjs';
import {validateContentTitle} from './content-titles.mjs';
import {projectGroups} from '../public/taxonomy.js';
export {conceptTemplate} from './concept-contract.mjs';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const checkpoint=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2));fs.renameSync(tmp,file);};
const nextEnd=(body,start)=>{let end=Math.min(body.length,start+40000);if(end<body.length){const at=body.lastIndexOf('\n',end);if(at>start+24000)end=at+1;}return end;};
export function locateConceptDiscussion(items,part){
 if(items===undefined)return []; // Older saved segment artifacts remain readable.
 if(!Array.isArray(items)||items.length>8)fail('概念讨论定位数量无效');
 return items.map(item=>{if(!['提问','回答','用户认可','修正','结论'].includes(item.role)||typeof item.quote!=='string'||!item.quote.trim()||item.quote.length>600)fail('讨论定位须包含环节与简短原句');const at=part.text.indexOf(item.quote);if(at<0)fail('讨论定位必须逐字存在于当前已读分段，不得跨段伪造');return {role:item.role,quote:item.quote,start:part.start+at,end:part.start+at+item.quote.length};});
}
// No independent scheduler or model runner: the existing five-lane pipeline
// dispatches forward concepts first, then missing historical concept segments.
export class ConceptExtractor{
 constructor(store){this.store=store;this.file=path.join(store.meta,'concept-analysis.json');this.state=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):{version:1,entries:{},pending:{}};}
 initializeBatch(){if(this.state.batch)return;const analyzer=this.store.analyzer;this.state.batch={createdAt:new Date().toISOString(),sources:Object.values(analyzer?.state.entries||{}).filter(e=>['queued','working','retry'].includes(e.status)&&this.store.state.jobs.find(j=>j.sourceId===e.sourceId)?.status!=='paused').map(e=>({id:e.sourceId,hash:e.sourceHash}))};checkpoint(this.file,this.state);}
 batchComplete(){return !!this.state.batch&&this.state.batch.sources.every(s=>{const n=this.store.nodeById.get(s.id),e=this.store.analyzer?.state.entries[s.id];return !n||n.hash!==s.hash||e?.status==='done';});}
 gaps(source){const entry=this.state.entries[source.id],coverage=entry?.sourceHash===source.hash?(entry.covered||[]):(entry?.fingerprints||[]).filter(p=>p.end<=source.body.length&&hash(source.body.slice(p.start,p.end))===p.hash).map(p=>[p.start,p.end]),result=[];let cursor=0;for(const [start,end]of [...coverage].sort((a,b)=>a[0]-b[0])){if(start>cursor)result.push([cursor,start]);cursor=Math.max(cursor,end);}if(cursor<source.body.length)result.push([cursor,source.body.length]);return result;}
 nextHistorical(now=Date.now()){
  if(!this.batchComplete())return null;
  const order=new Map(this.store.state.jobs.map((job,index)=>[job.sourceId,index]));
  const sources=this.store.nodes.filter(n=>n.kind==='vault'&&!n.mergedInto&&!this.store.layerPipeline?.activeSources().has(n.id)&&!this.store.state.archiveOnlySources?.[n.id]&&this.store.analyzer?.state.entries[n.id]?.status==='done'&&this.store.state.jobs.find(j=>j.sourceId===n.id)?.status!=='paused');
  sources.sort((a,b)=>(order.get(a.id)??Infinity)-(order.get(b.id)??Infinity));
  for(const source of sources)for(const [start,end]of this.gaps(source)){
    const part={start,end:Math.min(end,nextEnd(source.body,start))};part.text=source.body.slice(start,part.end);
    const key=hash(source.id+'|'+source.hash+'|'+start),failure=this.state.failures?.[key];if(failure&&(failure.attempts>=3||failure.retryAt>now))continue;
    return {source,part,key,pending:this.state.pending?.[key]||null};
  }
  return null;
 }
 failHistorical(key,error,now){this.state.failures||={};const attempts=(this.state.failures[key]?.attempts||0)+1;this.state.failures[key]={attempts,error:String(error.message||error).slice(0,500),retryAt:now+Math.min(900000,10000*2**attempts)};checkpoint(this.file,this.state);}
 retryFailed({keys}={}){
  if(!Array.isArray(keys)||!keys.length||keys.some(k=>typeof k!=='string'||!/^[a-f0-9]{64}$/.test(k)))fail('须指定需要恢复的概念分段');
  const active=new Set([...this.store.analyzer?.active.values()||[]].filter(f=>f.taskKind==='concept-only').map(f=>f.sourceId.slice('concept-only:'.length)));
  const retried=[],skipped=[];
  for(const key of new Set(keys)){
   const failure=this.state.failures?.[key];if(!failure||failure.attempts<3){skipped.push(key);continue;}
   const pending=this.state.pending?.[key];if(pending&&active.has(pending.sourceId)){skipped.push(key);continue;}
   this.state.failures[key]={...failure,previousAttempts:failure.attempts,attempts:0,retryAt:0,retriedAt:new Date().toISOString()};retried.push(key);
  }
  checkpoint(this.file,this.state);return {retried,skipped,...this.status()};
 }
 context(source,text=''){
  const entry=this.state.entries[source.id],same=new Set(entry?.sourceHash===source.hash?entry.outputs||[]:[]),all=this.store.nodes.filter(n=>n.kind==='concept'&&!n.mergedInto);
  const group=projectGroups(this.store.nodes,this.store.state.jobs||[]).find(g=>g.members.some(m=>m.id===source.id)),peerIds=new Set(group?.members.map(m=>m.id)||[]);
  const project=all.filter(n=>!same.has(n.id)&&n.sources.some(s=>peerIds.has(s.id))).slice(-4);
  const own=[...all.filter(n=>same.has(n.id)).slice(-4),...project],content=text.normalize('NFKC').toLowerCase();
  const ranked=all.filter(n=>!same.has(n.id)).map(n=>{const title=n.title.normalize('NFKC').toLowerCase(),tokens=[...new Set(title.match(/[a-z0-9_-]{3,}|[\u3400-\u9fff]{2}/g)||[])];return {n,score:(content.includes(title)?20:0)+tokens.reduce((s,t)=>s+(content.includes(t)?1:0),0)};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.n.id.localeCompare(b.n.id)).slice(0,4).map(x=>x.n);
  return [...own,...ranked].map(n=>{const core=n.body.split('## Reference')[0];return {id:n.id,hash:n.hash,title:n.title,body:core.slice(0,12000),excerptTruncated:core.length>12000,mergeAllowed:core.length<=12000&&!this.store.state.manualEdits?.[n.id]&&!n.analysisNeedsReview&&(n.conceptReferences||[]).some(r=>r.discussion?.some(d=>['用户认可','隐含认可','话题结束'].includes(d.role))),sourceIds:n.sources.map(s=>s.id)};});
 }
 knownDiscussion(source){
  const entry=this.state.entries[source.id],nodes=entry?.sourceHash===source.hash?(entry.outputs||[]).map(id=>this.store.nodeById.get(id)).filter(Boolean):[];
  const references=nodes.flatMap(n=>(n.conceptReferences||[]).filter(r=>r.sourceId===source.id&&r.sourceHash===source.hash).flatMap(r=>r.discussion||[]));
  const ignored=Object.values(this.state.ignoredQuestions||{}).filter(q=>q.sourceId===source.id&&q.sourceHash===source.hash).slice(-4).flatMap(q=>q.evidence||[]);
  return [...references,...ignored].filter(e=>source.body.slice(e.start,e.end)===e.quote).slice(-24);
 }
 ignoreQuestion(source,part,quote,reason,evidence=[]){
  const at=typeof quote==='string'?part.text.indexOf(quote):-1;this.state.ignoredQuestions||={};const key=hash(source.id+'|'+source.hash+'|'+part.start+'|'+quote);
  const known=evidence.find(e=>e.quote===quote);
  this.state.ignoredQuestions[key]={sourceId:source.id,sourceHash:source.hash,path:source.path,questionQuote:at>=0||known?quote:null,locator:{start:known?.start??(at>=0?part.start+at:part.start),end:known?.end??(at>=0?part.start+at+quote.length:part.end)},evidence,reason:String(reason).slice(0,500),ignorable:true,status:'ignored',createsTask:false};
 }
 status(){return {ignoredQuestions:Object.values(this.state.ignoredQuestions||{}).filter(q=>q.status==='ignored').length,forwardEnabled:true,backfillStarted:!!this.state.backfillStarted,batchInitialized:!!this.state.batch,batchSourceCount:this.state.batch?.sources.length||0,batchComplete:this.batchComplete(),historyMaxSlots:1,pendingSegments:Object.keys(this.state.pending||{}).length,failedSegments:Object.values(this.state.failures||{}).filter(f=>f.attempts>=3).length};}
 plan(){let segments=0,characters=0,sources=0,historyCharacters=0,historyCalls=0;for(const n of this.store.nodes.filter(n=>n.kind==='vault'&&!n.mergedInto&&!this.store.state.archiveOnlySources?.[n.id])){const old=this.store.analyzer?.state.entries[n.id];if(old?.status==='done'&&old.sourceHash===n.hash){for(const [a,b]of this.gaps(n)){historyCharacters+=b-a;for(let start=a;start<b;historyCalls++)start=Math.min(b,nextEnd(n.body,start));}continue;}const offset=old?.sourceHash===n.hash?old.offset:0;if(offset>=n.body.length)continue;sources++;characters+=n.body.length-offset;for(let start=offset;start<n.body.length;segments++)start=nextEnd(n.body,start);}return {...this.status(),sourceCount:sources,remainingCharacters:characters,estimatedModelCalls:segments,additionalModelCalls:0,historyMissingCharacters:historyCharacters,estimatedHistoryCalls:historyCalls,perCallConceptLimit:4,mode:'forward-then-history',automatic:'existing-five-lane-analysis',scope:'沿现有分段向后及新增 Vault；固定批次完成后只补历史缺失概念',existingAnalysisChanged:false};}
 defer(source,part,artifact,error){this.state.pending||={};this.state.pending[hash(source.id+'|'+source.hash+'|'+part.start)]={sourceId:source.id,sourceHash:source.hash,start:part.start,end:part.end,artifact:path.basename(artifact),error:String(error.message||error).slice(0,500)};checkpoint(this.file,this.state);}
 consume(source,part,items,unresolvedQuestions=[],{historical=false,template=null}={}){
  const {start,end,text}=part;
  if(this.store.nodeById.get(source.id)?.hash!==source.hash)fail('概念来源已变化，未保存本段输出',409);
  if(!Array.isArray(items)||items.length>4)fail('概念输出格式无效');
  if(!Array.isArray(unresolvedQuestions)||unresolvedQuestions.length>8)fail('可忽略问题记录格式无效');
  const evidenceContext={source,priorEvidence:this.knownDiscussion(source),historical};
  for(const q of unresolvedQuestions){const evidence=collectConceptEvidence(q,part,evidenceContext);if(typeof q.questionQuote!=='string'||!q.questionQuote.trim()||!evidence.some(e=>e.quote===q.questionQuote&&e.speaker==='user')||typeof q.reason!=='string'||!q.reason.trim())fail('可忽略问题须定位到已读原问题');this.ignoreQuestion(source,part,q.questionQuote,q.reason,evidence);}
  const savedEntry=this.state.entries[source.id],kept=(savedEntry?.fingerprints||[]).filter(p=>p.end<=source.body.length&&hash(source.body.slice(p.start,p.end))===p.hash),entry=savedEntry?.sourceHash===source.hash?savedEntry:{sourceHash:source.hash,offset:start,outputs:savedEntry?.outputs||[],covered:kept.map(p=>[p.start,p.end]),fingerprints:kept};if((entry.covered||[]).some(([a,b])=>a<=start&&b>=end))return {saved:0,duplicate:true};
  const candidateInfo=new Map(this.context(source,text).map(n=>[n.id,n])),allowed=new Map([...candidateInfo.keys()].map(id=>[id,this.store.nodeById.get(id)])),prepared=[];
  for(const item of items){
   if(['key','title','summary','explanation','quote','formation'].some(k=>typeof item[k]!=='string'||!item[k].trim())||!text.includes(item.quote)||!['用户观点','讨论假设','助手建议','已确认结论'].includes(item.stance)||!Array.isArray(item.mainTags)||!Array.isArray(item.referenceMaterials)||item.referenceMaterials.some(x=>typeof x!=='string')||item.referenceMaterials.length>12)fail('概念缺少内容、性质或原文定位依据');
   if(item.quote.length>1200||item.formation.length>400||item.referenceMaterials.some(x=>!x.trim()||!source.body.includes(x)))fail('Reference 须简短且参考资料名称来自原 Vault');
   const admission=conceptAdmission(item,part,evidenceContext);if(!admission.accepted){this.ignoreQuestion(source,part,item.admission?.questionQuote||item.discussion?.find(d=>d.role==='提问')?.quote||item.quote,admission.reason,collectConceptEvidence(item,part,evidenceContext));continue;}
   validateContentTitle(item.title,(item.mainTags||[]).map(t=>t.name));
   let old=item.existingId?allowed.get(item.existingId):null;if(item.existingId&&(!old||!candidateInfo.get(old.id)?.mergeAllowed||old.hash!==item.existingHash))fail('概念候选变化或有人工编辑，不能覆盖',409);
   if(old&&!['same-core','complement'].includes(item.mergeDecision))fail('仅相同核心或互补内容可合并概念');
   if(!Array.isArray(item.links||[])||(item.links||[]).some(link=>!allowed.has(link.targetId)||!['相关','条件不同','冲突','演进'].includes(link.relation)||!link.reason?.trim()||!link.quote?.trim()||!text.includes(link.quote)))fail('概念关联须引用有界候选并包含本段依据');
   if(item.mainTags.length>6||item.mainTags.some(t=>typeof t.name!=='string'||!t.name.trim()||t.name.trim().length>24||(/[\u3400-\u9fff]/.test(t.name)&&t.name.trim().length>4)||!t.reason?.trim()||!t.quote?.trim()||!item.explanation.includes(t.quote)))fail('概念分类须有正文依据');
   const id=old?.id||'c-'+hash(source.id+'|'+source.hash+'|'+start+'|'+item.key.normalize('NFKC').trim()).slice(0,20),recovered=this.store.nodeById.get(id);
   if(!old&&recovered){if(recovered.kind!=='concept'||recovered.managedBy!=='concept-extractor'||this.store.state.manualEdits?.[id])fail('已有概念有人工修订，保留本段待核对',409);old=recovered;}
   const locator={start:start+text.indexOf(item.quote),end:start+text.indexOf(item.quote)+item.quote.length};
   const located=locateConceptDiscussion(item.discussion,part).map(d=>historical&&admission.recognitionMethod!=='explicit'&&d.role==='用户认可'?{...d,role:admission.recognitionMethod==='topic-ended'?'话题结束':'隐含认可'}:d);
   const discussion=[...admission.evidence,...located].filter((d,i,all)=>all.findIndex(x=>x.role===d.role&&x.start===d.start&&x.end===d.end)===i);
   const sources=[...(old?.sources||[]).filter(s=>s.id!==source.id||s.locator?.start!==locator.start),{id:source.id,sourceHash:source.hash,quote:item.quote,locator}];
   const references=[...(old?.conceptReferences||[]).filter(r=>r.sourceId!==source.id||r.locator?.start!==locator.start),{path:source.path,sourceId:source.id,sourceHash:source.hash,readRange:{start,end},admission:item.admission,historicalRecognition:historical,recognitionMethod:admission.recognitionMethod||'explicit',executionAuthorization:false,locator,discussion,formation:item.formation,materials:item.referenceMaterials}];
   const recognition=historical?'\n历史认可方式：'+({explicit:'明确认可',implicit:'隐含认可（不是明确赞同）','topic-ended':'话题结束（不是明确赞同）'})[admission.recognitionMethod||'explicit']+'；不构成操作授权。':'';
   const body='# '+item.title+'\n\n## 综述\n'+item.summary+'\n\n## 概念\n'+item.explanation+'\n\n## 认识性质\n'+item.stance+recognition+'\n\n## Reference\n'+references.map(r=>'- '+r.path+' · 字符 '+r.locator.start+'–'+r.locator.end+'\n  - 形成线索：'+r.formation+(r.discussion||[]).map(d=>'\n  - '+d.role+' · 字符 '+d.start+'–'+d.end).join('')+(r.materials.length?'\n  - 原讨论参考资料：'+r.materials.join('；'):'')).join('\n');
   const templateBody=template?item.explanation+'\n\n'+body.slice(body.indexOf('## Reference')):body;
   prepared.push({item,input:{id,kind:'concept',title:item.title,body:templateBody,sources,expectedHash:old?.hash,conceptStance:item.stance,conceptReferences:references,managedBy:'concept-extractor',...(template?{analysisTemplate:{hash:template.hash,version:template.version}}:{})}});
  }
  if(new Set(prepared.map(p=>p.input.id)).size!==prepared.length)fail('本段概念名称重复');
  for(const {item,input}of prepared){const n=this.store.upsert(input);if(item.mainTags.length)this.store.setMainTags({id:n.id,sourceHash:n.hash,tags:item.mainTags,method:'codex'});if(!entry.outputs.includes(n.id))entry.outputs.push(n.id);const question=input.conceptReferences.at(-1).discussion.find(d=>d.role==='提问');for(const q of Object.values(this.state.ignoredQuestions||{}))if(q.sourceId===source.id&&q.sourceHash===source.hash&&q.locator.start===question?.start&&q.locator.end===question?.end){q.status='resolved';q.conceptId=n.id;}for(const link of item.links||[]){if(link.targetId===n.id)continue;const old=this.store.relations.find(r=>r.from===n.id&&r.to===link.targetId&&r.type==='related'),evidence={id:source.id,sourceHash:source.hash,quote:link.quote};this.store.relation({from:n.id,to:link.targetId,type:'related',strength:.5,summary:link.relation+'：'+link.reason.slice(0,35),reason:[...new Set([old?.reason,link.relation+'：'+link.reason].filter(Boolean))].join('\n'),sources:[...(old?.sources||[]),evidence],expectedHash:old?hash(JSON.stringify(old)):undefined,managedBy:'automatic'});}}
  entry.offset=Math.max(entry.offset,end);entry.covered=[...(entry.covered||[]),[start,end]].sort((a,b)=>a[0]-b[0]).reduce((all,item)=>{const last=all.at(-1);if(last&&item[0]<=last[1])last[1]=Math.max(last[1],item[1]);else all.push([...item]);return all;},[]);entry.fingerprints=entry.covered.map(([start,end])=>({start,end,hash:hash(source.body.slice(start,end))}));this.state.entries[source.id]=entry;const key=hash(source.id+'|'+source.hash+'|'+start);delete this.state.pending?.[key];delete this.state.failures?.[key];checkpoint(this.file,this.state);return {saved:prepared.length,offset:end};
 }
}
