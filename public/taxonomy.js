const ai=/\b(?:ai|artificial intelligence|machine learning|deep learning|llm|gpt|claude|gemini|openai|codex|lora|dino|sdxl|qwen|ollama|agentic)\b|人工智能|机器学习|深度学习|大模型|语言模型|智能体|模型训练|模型推理|提示词|扩散模型/i;
export function tagHierarchy(name){
 const text=String(name||'').trim();if(!text)return null;
 if(ai.test(text))return {primary:'人工智能',secondary:/^(?:AI|Artificial Intelligence|人工智能)$/i.test(text)?null:text};
 const project=text.match(/^(?:项目|Project)\s*[:：/·]\s*(.+)$/i);if(project)return {primary:'项目',secondary:project[1].trim()};
 const divided=text.split(/\s*(?:\/|::|＞|>)\s*/);return {primary:divided[0],secondary:divided.length>1?divided.slice(1).join(' / '):null};
}
export function nodeTagHierarchy(node){
 const map=new Map();for(const tag of node.mainTags||[]){const h=tagHierarchy(tag.name);if(!h)continue;if(!map.has(h.primary))map.set(h.primary,new Set());if(h.secondary)map.get(h.primary).add(h.secondary);}
 for(const project of node.projectScopes||[]){if(!map.has('项目'))map.set('项目',new Set());map.get('项目').add(project.name);}
 return [...map].map(([primary,sub])=>({primary,secondary:[...sub].sort()}));
}
export function branchRoot(title){let name=String(title||'').normalize('NFKC').trim(),branched=false;while(/^(?:分支|branch)\s*[·•:：\-]\s*/i.test(name)){name=name.replace(/^(?:分支|branch)\s*[·•:：\-]\s*/i,'');branched=true;}return {name,branched};}
export function projectGroups(nodes,jobs=[]){
 const order=new Map(jobs.map((j,i)=>[j.sourceId,i])),groups=new Map();for(const n of nodes.filter(n=>n.kind==='vault'&&!n.mergedInto)){
  const root=branchRoot(n.title);if(!root.name||/^(?:新聊天|new chat|untitled|无标题)$/i.test(root.name))continue;
  const key=root.name.toLocaleLowerCase();if(!groups.has(key))groups.set(key,{id:'project:'+encodeURIComponent(key),name:root.name,members:[],branched:false,explicitProject:/项目|\bproject\b|山河扇|yumeiren|venus/i.test(root.name)});const g=groups.get(key);g.branched||=root.branched;g.members.push({id:n.id,title:n.title,path:n.path,order:order.get(n.id)??Number.MAX_SAFE_INTEGER});
 }
 return [...groups.values()].filter(g=>g.branched||g.members.length>1||g.explicitProject).map(g=>({...g,members:g.members.sort((a,b)=>a.order-b.order),continuousObjectId:g.id}));
}
export function projectScopesFor(nodes,groups){
 const direct=new Map();for(const g of groups)for(const m of g.members)direct.set(m.id,[{id:g.id,name:g.name}]);const byId=new Map(nodes.map(n=>[n.id,n]));
 const get=(id,seen=new Set())=>{if(direct.has(id))return direct.get(id);if(seen.has(id))return [];seen.add(id);const result=new Map();for(const s of byId.get(id)?.sources||[])for(const scope of get(s.id,new Set(seen)))result.set(scope.id,scope);return [...result.values()];};return new Map(nodes.map(n=>[n.id,get(n.id)]));
}
