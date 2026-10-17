import { tr, uiLocale } from './i18n.js';
export function knowledgeForSource(nodes, sourceId) {
  const source = nodes.find(n => n.id === sourceId);
  const ids = new Set([sourceId, ...(source?.mergedFrom || [])]);
  return nodes.filter(n => n.kind === 'knowledge' && !n.mergedInto &&
    (n.sources || []).some(s => ids.has(s.id)));
}
export function knowledgeInScope(nodes,sourceId=null){return sourceId?knowledgeForSource(nodes,sourceId):nodes.filter(n=>n.kind==='knowledge'&&!n.mergedInto);}
export function knowledgeListPage(nodes,{query='',page=0,pageSize=80}={}){
  const term=query.trim().toLocaleLowerCase(),matches=term?nodes.filter(n=>[n.title,n.path,...(n.mainTags||[]).map(t=>t.name)].join(' ').toLocaleLowerCase().includes(term)):nodes;
  const pages=Math.max(1,Math.ceil(matches.length/pageSize)),index=Math.max(0,Math.min(pages-1,page));
  return {items:matches.slice(index*pageSize,(index+1)*pageSize),total:matches.length,page:index,pages};
}
export function chooseKnowledgeSource(nodes, preferredId) {
  const vaults = nodes.filter(n => n.kind === 'vault' && !n.mergedInto);
  return vaults.find(n => n.id === preferredId)?.id ||
    vaults.find(n => knowledgeForSource(nodes, n.id).length)?.id || vaults[0]?.id || null;
}
export function knowledgeStatus(analysis, sourceId) {
  const status = analysis?.fileProgress?.[sourceId]?.status;
  if (status === 'done') return [tr('本篇已分析，未提取独立知识点'), tr('可查看原文；分析没有保存可独立成立的知识点。')];
  if (status === 'review') return [tr('本篇分析需要核对'), tr('处理遇到问题，请在自动处理进度中查看原因。')];
  if (status === 'working') return [tr('本篇正在分析'), tr('结果保存后会自动出现在这里，无需再次开始分析。')];
  return [tr('本篇尚无已保存的知识点'), tr('资料将按队列自动分析；可从左侧选择已有提取结果的资料。')];
}

export function taskPresentation(state, now = Date.now()) {
  const a = state.analysis;
  if (!a) return {status:tr('运行状态尚未取得'), current:tr('当前资料未知'), progress:tr('完成与剩余数量未知'), stage:tr('等待后端状态'), problem:''};
  const remaining = Number.isFinite(a.total) && Number.isFinite(a.completed) ? Math.max(0,a.total-a.completed) : null;
  const current = a.current;
  const progress = current && a.fileProgress?.[current.sourceId];
  return {
    status: !a.enabled ? tr('自动处理已暂停') : a.cooldownUntil > now ? tr('已启动 · 等待自动重试') : a.running ? tr('已启动 · 正在处理') : remaining === 0 ? tr('已启动 · 当前队列已完成') : tr('已启动 · 等待下一段'),
    current: (a.activeFiles?.length ? a.activeFiles.length + ' / ' + a.maxConcurrent + tr(' 个槽位正在处理 · ') : '') + (current ? tr('当前 MD：') + current.title : tr('当前没有正在处理的 MD')),
    progress: tr('已完成 ') + (a.completed ?? tr('未知')) + ' / ' + (a.total ?? tr('未知')) + tr(' 篇 · 剩余 ') + (remaining ?? tr('未知')) + tr(' 篇'),
    stage: current ? tr('知识提取、关系比较、分类归纳与技能整合合并执行；已落盘 ') + (progress?.offset ?? current.offset ?? 0) + ' / ' + (current.total ?? tr('未知')) + tr(' 字符') : tr('导入资料已入库；后台按顺序接续分析'),
    problem: a.cooldownUntil > now ? tr('重试时间：') + new Date(a.cooldownUntil).toLocaleString(uiLocale()) : a.needsReview ? a.needsReview + tr(' 篇处理失败，需核对') : a.retrying ? a.retrying + tr(' 篇等待重试') : '',
  };
}

export function activityState(analysis, now = Date.now()) {
  if (!analysis) return {mode:'idle',label:tr('等待运行状态')};
  if (!analysis.enabled) return {mode:'idle',label:tr('已暂停')};
  if (analysis.cancelled) return {mode:'idle',label:tr('已取消')};
  if (analysis.cooldownUntil > now) return {mode:'idle',label:tr('等待自动重试')};
  if (analysis.running) return {mode:'running',label:tr('正在处理')};
  if (analysis.needsReview) return {mode:'idle',label:tr('有处理失败的资料，待核对')};
  if (Number.isFinite(analysis.total) && analysis.total > 0 && analysis.completed === analysis.total)
    return {mode:'complete',label:tr('整队列已完成 · 100%')};
  return {mode:'idle',label:tr('等待下一段处理')};
}

export function fileStageProgress(analysis, sourceId, now = Date.now()) {
  const progress=analysis?.fileProgress?.[sourceId];
  const done=progress?.status==='done';
  const active=analysis?.activeFiles?.some(file=>file.sourceId===sourceId) || analysis?.current?.sourceId===sourceId;
  const stopped=!analysis?.enabled || analysis?.cancelled || analysis?.cooldownUntil>now || ['review','retry','paused'].includes(progress?.status);
  const completed=progress?.parts||0,total=progress?.totalParts??(done?completed:null);
  const current=done?completed:completed+1;
  const label=tr('当前分段 ')+current+(total===null?'':' / '+total)+tr(' · 已保存 ')+completed+tr(' 段');
  return {label,total,current,completed,animating:!!active&&!stopped&&!done,done};
}
// Drafts are independent of refreshed server snapshots and survive navigation.
export class InlineDrafts{
  constructor(){this.items=new Map();}
  open(node){let d=this.items.get(node.id);if(!d||(!d.dirty&&!d.saving&&d.hash!==node.hash)){d={id:node.id,title:node.title,body:node.body||'',hash:node.hash,baseTitle:node.title,version:0,dirty:false,saving:false,status:'已保存'};this.items.set(node.id,d);}return d;}
  change(id,fields){const d=this.items.get(id);Object.assign(d,fields);d.version++;d.dirty=true;d.status='未保存';return d;}
  replaceRange(id,start,end,text){const d=this.items.get(id);this.change(id,{body:d.body.slice(0,start)+text+d.body.slice(end)});return start+text.length;}
  accept(id,node,version){const d=this.items.get(id);d.hash=node.hash;d.baseTitle=node.title;d.saving=false;if(d.version===version){d.title=node.title;d.body=node.body;d.dirty=false;d.status='已保存';}else{d.dirty=true;d.status='有新的未保存修改';}return d;}
}
export async function saveInlineDraft(node,draft,transport,features={}){
  const title=draft.title.trim();if(!title||!draft.body.trim())throw Error('标题与正文不能为空');
  let body=draft.body;
  if(title!==draft.baseTitle)body=/^# .+$/m.test(body)?body.replace(/^# .+$/m,'# '+title):'# '+title+'\n\n'+body;
  let saved=await transport('edit',{id:node.id,body,title,expectedHash:draft.hash});
  // Older running backends already protect manual bodies through edit. Reuse
  // their versioned upsert only to persist the derived title, retaining metadata.
  if(node.kind!=='vault'&&saved.title!==title&&!features.inlineTitleEdit){
    try{saved=await transport('upsert',{id:node.id,kind:node.kind,title,body:saved.body,expectedHash:saved.hash,sources:saved.sources,level:saved.level,domain:saved.domain,occupations:saved.occupations,projects:saved.projects,decision:saved.decision});}
    catch(error){draft.hash=saved.hash;throw error;}
  }
  if(saved.title!==title)throw Error('正文已保存，标题尚未保存；草稿已保留');
  return saved;
}

export function linkedNeighbours(nodes,edges,id,types=[]){
  const byId=new Map(nodes.map(n=>[n.id,n])),result=new Map();
  for(const edge of edges){if(edge.from!==id&&edge.to!==id)continue;const other=edge.from===id?edge.to:edge.from;if(other===id||!byId.has(other))continue;
    if(!result.has(other))result.set(other,{id:other,node:byId.get(other),relations:[]});
    result.get(other).relations.push({...edge,typeName:types.find(t=>t.id===edge.type)?.name||edge.type});
  }
  return [...result.values()].sort((a,b)=>a.node.title.localeCompare(b.node.title));
}
