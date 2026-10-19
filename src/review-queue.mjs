import {createHash} from 'node:crypto';
export const isRestrictedFailure=error=>/blocked by policy|permission denied|EACCES|EPERM|审批拒绝|权限拒绝|not logged in|authentication failed/i.test(error.message);
export function verifiedOffset(parts){let offset=0;for(const p of [...parts].sort((a,b)=>a.start-b.start)){if(p.start>offset)break;if(p.end>offset)offset=p.end;}return offset;}
export function quarantineRange(ledger,source,{index,start,end},error,now=new Date().toISOString()){
 const entry=ledger.entries[source.id],key=createHash('sha256').update(source.id+'|'+source.hash+'|'+start+'|'+end).digest('hex');ledger.exceptions||={};
 const old=ledger.exceptions[key];ledger.exceptions[key]={...old,key,sourceId:source.id,sourceHash:source.hash,file:source.title,index,start,end,checkpoint:entry.offset,error:String(error.message),firstFailedAt:old?.firstFailedAt||now,lastFailedAt:now,status:/人工|原文发生变化|来源变化|上下文预算/.test(error.message)?'needs-user':'pending-repair',attempts:(old?.attempts||0)+1,automaticBackfills:old?.automaticBackfills||0};
 entry.scanOffset=Math.max(entry.scanOffset||entry.offset,end);entry.status='incomplete';return ledger.exceptions[key];
}
export function recordCheckedRange(ledger,source,part,now=new Date().toISOString()){
 const e=ledger.entries[source.id];e.parts=[...e.parts.filter(p=>p.start!==part.start||p.end!==part.end),part];e.scanOffset=Math.max(e.scanOffset||0,part.end);e.offset=verifiedOffset(e.parts);
 for(const gap of Object.values(ledger.exceptions||{}))if(gap.sourceId===source.id&&gap.sourceHash===source.hash&&part.start<=gap.start&&part.end>=gap.end){gap.status='resolved';gap.resolvedAt=now;}
 for(const gap of e.skipped||[])if(part.start<=gap.start&&part.end>=gap.end)gap.resolvedAt=now;
}
export function finalizeEntry(ledger,source){const e=ledger.entries[source.id],gaps=Object.values(ledger.exceptions||{}).some(x=>x.sourceId===source.id&&x.sourceHash===source.hash&&x.status!=='resolved');e.status=e.offset===source.body.length&&!gaps&&!(e.skipped||[]).some(s=>!s.resolvedAt)?'complete':'incomplete';return e.status;}
