import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const actualSave=e=>['CONCEPT_SAVED','SUPPLEMENT_SAVED','CONTENT_CHECK_SAVED','LAYER_SEGMENT_SAVED','DOCUMENT_CHECKED','ALL_CHECKED'].includes(e.action)&&(!['CONCEPT_SAVED','SUPPLEMENT_SAVED'].includes(e.action)||e.savedCount>0);
const text=(value,limit=180)=>String(value??'').replace(/(?:Bearer\s+|sk-)[A-Za-z0-9._-]+/gi,'[redacted]').replace(/([?&](?:token|key|secret|password)=)[^\s&]+/gi,'$1[redacted]').replace(/((?:api[_ -]?key|authorization|password|secret|token)\s*[:=]\s*)[^\s;,]+/gi,'$1[redacted]').slice(0,limit);
export function errorCode(message=''){
 if(/未知概念|已有概念|concept.?id/i.test(message))return 'invalid-concept-reference';
 if(/原文依据|原文定位|逐字|引文/.test(message))return 'source-evidence-invalid';
 if(/认可|准入/.test(message))return 'admission-rejected';
 if(/上下文预算/.test(message))return 'input-budget-exceeded';
 return 'execution-error';
}
export class ExecutionJournal{
 constructor(meta,work){this.dir=path.join(meta,'execution-journal');this.work=work;this.cursorFile=path.join(this.dir,'cursors.json');fs.mkdirSync(this.dir,{recursive:true});try{this.cursors=JSON.parse(fs.readFileSync(this.cursorFile));}catch{this.cursors={};}this.latestReview=null;this.latestTask=null;this.ranges=new Map();this.restoreLatest();}
 remember(e){this.reviewActions||=new Map();this.savedActions||=new Map();if(actualSave(e)&&e.sourceId&&(!this.savedActions.has(e.sourceId)||e.time>=this.savedActions.get(e.sourceId).time))this.savedActions.set(e.sourceId,e);if(e.sourceId&&(e.origin==='review-log'||/^(?:REVIEW_|RECOVERY_)/.test(e.action))){const old=this.reviewActions.get(e.sourceId);if(!old||e.time>=old.time)this.reviewActions.set(e.sourceId,e);}if(e.sourceId&&Number.isFinite(e.start)&&Number.isFinite(e.end)){this.rangeTimes||=new Map();if(!this.rangeTimes.has(e.sourceId)||e.time>=this.rangeTimes.get(e.sourceId)){this.ranges.set(e.sourceId,[e.start,e.end]);this.rangeTimes.set(e.sourceId,e.time);}}if(e.kind==='error'&&(!this.latestFailure||e.time>=this.latestFailure.time))this.latestFailure=e;if(e.origin==='review-log'&&(!this.latestReview||e.time>=this.latestReview.time))this.latestReview=e;if(!this.latestTask||e.time>=this.latestTask.time)this.latestTask=e;}
 refreshExternal(){const date=this.days()[0];if(!date)return;const stat=fs.statSync(path.join(this.dir,date+'.jsonl')),stamp=date+':'+stat.mtimeMs+':'+stat.size;if(stamp===this.externalStamp)return;this.externalStamp=stamp;for(const e of this.read(date,{limit:100}).items.slice().reverse())this.remember(e);}
 restoreLatest(){for(const date of this.days().slice(0,2).reverse())for(const e of this.read(date,{limit:100}).items.slice().reverse())this.remember(e);}
 append(input){
  const time=input.time&&Number.isFinite(Date.parse(input.time))?new Date(input.time).toISOString():new Date().toISOString();
  const e={time,kind:text(input.kind||'execution'),action:text(input.action),status:text(input.status||'observed'),origin:text(input.origin||'live'),sourceId:text(input.sourceId),file:text(input.file),step:text(input.step),code:text(input.code)};
  for(const field of ['index','start','end','offset','total','savedCount','pid'])if(Number.isFinite(input[field]))e[field]=input[field];
  if(input.files)e.files=input.files.filter(f=>/^[\w./-]+$/.test(f)).slice(0,20);
  if(input.error)e.error={original:text(input.error.original,4000),disposition:text(input.error.disposition),checkpoint:input.error.checkpoint};
  if(input.checkpoint)e.checkpoint=input.checkpoint;
  if(input.reason)e.reason=text(input.reason,200);
  e.id=createHash('sha256').update(JSON.stringify(e)).digest('hex').slice(0,24);
  const file=path.join(this.dir,day(time)+'.jsonl');fs.appendFileSync(file,JSON.stringify(e)+'\n');
  this.remember(e);if(this.latestTask===e)fs.writeFileSync(path.join(this.dir,'current-task-record.json'),JSON.stringify({...e,lastFailure:this.latestFailure||null},null,2));return e;
 }
 recordReview(r,{append=true}={}){
  const c={...r.current,...r},persisted=actualSave({action:r.event,savedCount:Array.isArray(r.saved)?r.saved.length:undefined}),event={time:r.time,kind:r.event==='ERROR'?'error':persisted?'saved':'execution',action:r.event,status:r.event==='ERROR'?'failed':r.event==='SKIP_COMPLETE'?'verified-skip':persisted?'saved':'running',origin:'review-log',sourceId:c.id,file:c.title,index:c.index,start:r.start,end:r.end,offset:c.savedOffset??c.offset,total:c.total,savedCount:Array.isArray(r.saved)?r.saved.length:undefined,step:r.event,code:r.event==='ERROR'?errorCode(r.message):undefined,error:r.event==='ERROR'?{original:r.message,disposition:r.disposition||'stopped',checkpoint:{sourceId:c.id,offset:c.savedOffset??c.offset,start:c.range?.[0],end:c.range?.[1]}}:null};
  event.checkpoint={sourceId:c.id,index:c.index,offset:c.savedOffset??c.offset,start:c.range?.[0]??r.start,end:c.range?.[1]??r.end};
  if(append)return this.append(event);this.remember(event);return event;
 }
 days(){return fs.readdirSync(this.dir).filter(f=>/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).map(f=>f.slice(0,10)).sort().reverse();}
 read(date=day(Date.now()),{limit=60,before=null}={}){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('日志日期无效');const file=path.join(this.dir,date+'.jsonl');let rows=[],start=0,end=0,anchor=before;
  const cursor=typeof before==='string'&&before.match(/^@(\d+):([a-f0-9]*)$/);if(cursor)anchor=cursor[2];
  if(fs.existsSync(file)){const size=fs.statSync(file).size,fd=fs.openSync(file,'r');end=cursor?Math.min(size,Number(cursor[1])):size;start=Math.max(0,end-512*1024);const buffer=Buffer.alloc(end-start);try{fs.readSync(fd,buffer,0,buffer.length,start);}finally{fs.closeSync(fd);}let raw=buffer;if(start){const newline=buffer.indexOf(10);if(newline>=0){raw=buffer.subarray(newline+1);start+=newline+1;}}rows=raw.toString('utf8').split('\n').filter(Boolean).map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(Boolean).reverse();}
  if(anchor){const at=rows.findIndex(e=>e.id===anchor);rows=at<0?[]:rows.slice(at+1);}const count=Math.max(1,Math.min(100,Number(limit)||60));return {day:date,items:rows.slice(0,count),next:rows.length>count?'@'+end+':'+rows[count-1].id:start>0?'@'+start+':':null,historyPolicy:'recorded-events-only',days:this.days()};
 }
 syncReview(){
  this.refreshExternal();
  const file=path.join(this.work,'concept-content-review-output.log');if(!fs.existsSync(file))return;
  const stat=fs.statSync(file),old=this.cursors.review||{offset:0},reset=stat.size<old.offset,cursor=reset?{offset:0}:old;
  if(stat.size===cursor.offset)return;const fd=fs.openSync(file,'r'),buffer=Buffer.alloc(Math.min(128*1024,stat.size-cursor.offset));let bytes;try{bytes=fs.readSync(fd,buffer,0,buffer.length,cursor.offset);}finally{fs.closeSync(fd);}const raw=buffer.subarray(0,bytes),end=raw.lastIndexOf(10);if(end<0)return;
  for(const line of raw.subarray(0,end).toString('utf8').split(/\r?\n/)){let r;try{r=JSON.parse(line);}catch{continue;}if(!r.time||!r.event)continue;
   this.recordReview(r,{append:!r.journaled});
  }
  this.cursors.review={offset:cursor.offset+end+1};fs.writeFileSync(this.cursorFile,JSON.stringify(this.cursors));
 }
}
