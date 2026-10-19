import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isRestrictedFailure} from './review-queue.mjs';
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
export class ReviewControl{
 constructor({project,meta,journal,analysis,launcher=null}){Object.assign(this,{project,meta,journal,analysis,launcher});this.ledgerFile=path.join(meta,'concept-content-review.json');this.lock=path.join(project,'work/concept-content-review/executor.lock');this.requestLock=this.lock+'.request';this.starting=null;}
 ledger(){try{return JSON.parse(fs.readFileSync(this.ledgerFile));}catch{return {entries:{},status:'pending'};}}
 worker(){try{const lock=JSON.parse(fs.readFileSync(this.lock));if(alive(lock.pid))return lock.pid;}catch{}return this.starting&&alive(this.starting)?this.starting:null;}
 status(){
  this.journal.syncReview();const l=this.ledger(),pid=this.worker(),current=l.current,entry=current&&l.entries?.[current.id],last=this.journal.latestReview;
  const matching=this.journal.reviewActions?.get(current?.id)||(last?.sourceId===current?.id?last:null);
  const oldRange=this.journal.ranges.get(current?.id),savedAt=[entry?.parts?.at(-1)?.savedAt,this.journal.savedActions?.get(current?.id)?.time].filter(Boolean).sort().at(-1)||null,range=current?.range||(oldRange&&oldRange[0]===current?.offset?oldRange:null);
  const failed=!pid&&l.status==='needs-review',failureCurrent=l.lastError&&(!l.lastError.current?.id||l.lastError.current.id===current?.id)&&(!l.lastError.time||l.lastError.time>=([savedAt,matching?.time].filter(Boolean).sort().at(-1)||'')),blocked=!pid&&failureCurrent&&isRestrictedFailure(Error(l.lastError.message));
  const stopReason=l.status==='cancelled-semantic-review'?'用户已取消重复语义复核；原有结果和断点保留。':pid?null:blocked?'审批或认证阻塞，须先解决权限；保留断点且不自动越过。':l.status==='paused-with-skips'?'用户跳过后已暂停；缺口保留，尚未完成。':failed?l.lastError?.message:l.status==='working'?'执行器已停止，保留断点。':l.status==='complete'?null:'当前没有活动执行器，保留已保存断点。';
  return {enabled:!!l.enabled,status:pid?'working':l.status,current:current?{...current,savedOffset:current.savedOffset??entry?.offset??current.offset,range}:null,completed:Object.values(l.entries||{}).filter(e=>e.status==='complete').length,total:l.total||0,workerRunning:!!pid,pid,blocked:!!blocked,stopReason,queuePhase:l.phase||null,lastError:l.lastError||null,phase:pid?(matching?.step||'STARTING'):blocked?'BLOCKED':failed?'FAILED':l.status==='complete'?'COMPLETE':l.status==='working'?'STOPPED':'PAUSED',lastAction:matching?.action||null,lastUpdatedAt:matching?.time||l.lastError?.time||entry?.completedAt||savedAt,lastSavedAt:savedAt,lastTaskEvent:this.journal.latestTask,exceptions:Object.values(l.exceptions||{}).filter(e=>!['resolved','superseded'].includes(e.status)).map(e=>({key:e.key,file:e.file,sourceId:e.sourceId,index:e.index,start:e.start,end:e.end,checkpoint:e.checkpoint,status:e.status,attempts:e.attempts})),unresolvedSkips:Object.values(l.entries||{}).reduce((n,e)=>n+(e.skipped||[]).filter(s=>!s.resolvedAt).length,0),controls:current&&!pid&&l.status!=='cancelled-semantic-review'?{resume:!failed&&!blocked,retry:failed&&!blocked,skip:failed&&!blocked&&!!range,manualRequired:!this.launcher,reason:blocked?stopReason:!this.launcher?'执行器启动目前受限；此页面不会另行启动。':failed?'上次执行未通过校验，已保存断点保留。':'当前没有执行器，继续会接续已保存断点。'}:null};
 }
 async control({action,reason=''}){
  if(this.ledger().status==='cancelled-semantic-review')throw Error('重复语义复核已取消；仅允许现有覆盖缺口提取。');
  if(!['resume','retry','skip'].includes(action))throw Error('恢复操作无效');if(this.worker())throw Error('现有概念执行器仍在运行，不重复启动');
  const status=this.status(),l=this.ledger(),current=l.current;if(!current)throw Error('没有可继续的概念断点');
  if(status.blocked)throw Error(status.stopReason);
  if(action==='skip'){
   if(!status.controls?.skip)throw Error('只有明确失败区间可以跳过');if(!reason.trim())throw Error('跳过必须填写原因');const [start,end]=status.current.range,e=l.entries[current.id];
   e.skipped=[...(e.skipped||[]),{start,end,sourceHash:e.sourceHash,reason:String(reason).slice(0,200),at:new Date().toISOString()}];e.lastAction='REVIEW_SEGMENT_SKIPPED';e.updatedAt=new Date().toISOString();e.scanOffset=end;e.status='paused';l.current={...current,offset:end,savedOffset:e.offset,range:null};l.enabled=false;l.status='paused-with-skips';
   l.exceptions||={};const key=createHash('sha256').update(current.id+'|'+e.sourceHash+'|'+start+'|'+end).digest('hex');l.exceptions[key]={...(l.exceptions[key]||{}),key,sourceId:current.id,sourceHash:e.sourceHash,file:current.title,index:current.index,start,end,checkpoint:e.offset,status:'user-skipped',reason:String(reason).slice(0,200),automaticBackfills:0};
   fs.writeFileSync(this.ledgerFile+'.tmp',JSON.stringify(l,null,2));fs.renameSync(this.ledgerFile+'.tmp',this.ledgerFile);this.journal.append({kind:'recovery',action:'REVIEW_SEGMENT_SKIPPED',status:'skipped',sourceId:current.id,file:current.title,index:current.index,start,end,reason,code:'user-skipped-not-complete'});return {skipped:true,complete:false,offset:e.offset,scanOffset:end};
  }
  const a=this.analysis();if(a?.enabled||a?.activeFiles?.length)throw Error('先暂停联合提取并等待当前分段保存');
  const config=JSON.parse(fs.readFileSync(path.join(this.meta,'analysis-provider.json')));if(config.provider!=='codex'||config.model!=='gpt-6.1-sol'||config.reasoningEffort!=='low')throw Error('须保持 GPT-6.1-sol / low 配置');
  fs.mkdirSync(path.dirname(this.requestLock),{recursive:true});let fd;try{fd=fs.openSync(this.requestLock,'wx');fs.writeFileSync(fd,JSON.stringify({pid:process.pid}));}catch{throw Error('已有恢复请求正在受理，不重复启动');}
  try{
   if(!this.launcher){this.journal.append({kind:'recovery',action:'REVIEW_MANUAL_START_REQUIRED',status:'not-started',sourceId:current.id,file:current.title,index:current.index,offset:current.savedOffset??current.offset,code:'execution-start-restricted'});return {accepted:false,manualRequired:true,status:'not-started',message:'执行器启动目前受限；没有通过此接口启动任何进程。'};}
   const child=await this.launcher();
   this.starting=child.pid;this.journal.append({kind:'recovery',action:action==='retry'?'REVIEW_RETRY_REQUESTED':'REVIEW_RESUME_REQUESTED',status:'accepted',sourceId:current.id,file:current.title,index:current.index,offset:current.offset,pid:child.pid});return {accepted:true,pid:child.pid,status:'starting',offset:current.offset};
  }finally{fs.closeSync(fd);fs.unlinkSync(this.requestLock);}
 }
}
