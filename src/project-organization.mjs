import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const digest=s=>createHash('sha256').update(s).digest('hex').slice(0,16);
// A saved backup receipt is provenance, never an inferred project from keywords.
export function attachBackupProjectLineage(nodes,ledger={}){
 const available=new Set(nodes.filter(n=>n.kind==='vault').map(n=>n.id)),parents=new Map();
 for(const record of Object.values(ledger)){if(!available.has(record.vaultId))continue;for(const receipt of record.incrementalBatches||[]){if(!available.has(receipt.vaultId)||receipt.vaultId===record.vaultId)continue;const ids=parents.get(receipt.vaultId)||new Set();ids.add(record.vaultId);parents.set(receipt.vaultId,ids);}}
 return nodes.map(n=>parents.has(n.id)?{...n,projectSourceIds:[...parents.get(n.id)]}:n);
}
export function sourceProjectAssignments({threads,ledger={},nodes,catalog}){
 const names=new Map(catalog.map(p=>[p.id||p.projectId,p.name||p.label])),byThread=new Map(),available=new Map(nodes.filter(n=>n.kind==='vault').map(n=>[n.id,n]));
 for(const row of threads){if(!row.id||!row.projectId||!names.has(row.projectId))continue;if(!byThread.has(row.id))byThread.set(row.id,new Set());byThread.get(row.id).add(row.projectId);}
 const assignments=new Map();for(const [threadId,projects]of byThread){if(projects.size!==1)continue;const id=[...projects][0],sourceIds=new Set(Object.values(ledger).filter(r=>r.id===threadId).flatMap(r=>[r.vaultId,...(r.incrementalBatches||[]).map(b=>b.vaultId)]).filter(id=>available.has(id))),prefixes=['GPT-'+digest(threadId)+'-','GPT-'+digest('chatgpt:'+threadId)+'-'];for(const n of available.values())if(prefixes.some(p=>path.basename(n.path).startsWith(p)))sourceIds.add(n.id);for(const sourceId of sourceIds)assignments.set(sourceId,[{id,name:names.get(id),basis:'thread-project-metadata',origin:'saved-thread-index',threadId}]);}return assignments;
}
export function fillProjectClassifications(file,assignments){
 const raw=fs.readFileSync(file,'utf8'),match=raw.match(/^<!-- venus:(.*?) -->\r?\n/s);if(!match)throw Error('Classification header is missing');const metadata=JSON.parse(match[1]);metadata.entries||={};let added=0,preserved=0;
 for(const [id,members]of assignments){const old=metadata.entries[id];if(!old||old.projectMemberships?.length){preserved++;continue;}metadata.entries[id]={...old,projectMemberships:members};added++;}
 if(added){if(fs.readFileSync(file,'utf8')!==raw)throw Error('Classification changed; retry at a safe boundary');const temp=file+'.project-tmp';fs.writeFileSync(temp,'<!-- venus:'+JSON.stringify(metadata)+' -->\n'+raw.slice(match[0].length));fs.renameSync(temp,file);}return {added,preserved,originalTextPreserved:true};
}
