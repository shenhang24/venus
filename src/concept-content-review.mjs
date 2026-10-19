// Content comparison is intentionally independent of extraction coverage.
export function normalizePendingReferences(result,existing){
 const copy=structuredClone(result),ids=new Set(existing.map(n=>n.id)),keys=new Set(copy.concepts.map(c=>c.key));
 for(const topic of copy.checkedTopics){
  const pending=(topic.conceptIds||[]).filter(id=>!ids.has(id));
  if(!pending.length)continue;
  if(copy.verdict!=='supplement'||pending.some(id=>!keys.has(id)))throw Error('内容核对引用未知概念；不能猜测持久 ID');
  // A proposed concept is still missing until the validated candidate is actually saved.
  topic.assessment='missing';topic.conceptIds=topic.conceptIds.filter(id=>ids.has(id));topic.reason='本轮待保存候选，尚不能算已表达。'+topic.reason;
 }
 return copy;
}
export function resolveConceptConnection(item,nodes,keyMap,part){
 const from=keyMap[item.from]||item.from,to=keyMap[item.to]||item.to,ids=new Set(nodes.filter(n=>n.kind==='concept').map(n=>n.id));
 if(!item.quote?.trim()||!part.text.includes(item.quote)||!item.reason?.trim())throw Error('对立方向关联缺少当前原文依据');
 if(!ids.has(from)||!ids.has(to))throw Error('概念关联必须引用已保存的同层节点');return {from,to};
}
export function validateReview(r,source,existing){
 if(!['complete','supplement','needs-review'].includes(r.verdict)||!r.summary?.trim()||!Array.isArray(r.checkedTopics)||!r.checkedTopics.length||!Array.isArray(r.concepts)||!Array.isArray(r.issues))throw Error('内容核对结果缺少主题清单或明确结论');
 const ids=new Set(existing.map(n=>n.id));
 for(const t of r.checkedTopics){
  if(!['represented','missing','not-admitted'].includes(t.assessment)||!t.topic?.trim()||!t.reason?.trim()||!t.sourceQuote?.trim()||!source.text.includes(t.sourceQuote)||!Array.isArray(t.conceptIds)||t.conceptIds.some(id=>!ids.has(id)))throw Error('内容核对主题缺少原文依据或引用未知概念');
  if(t.assessment==='represented'&&!t.conceptIds.length)throw Error('已表达主题必须指出已有概念');
 }
 if(r.verdict==='complete'&&(r.concepts.length||r.checkedTopics.some(t=>t.assessment==='missing')||r.issues.some(note=>/未读|未读取|原文缺失|无法定位|不完整|unread|missing source|incomplete/i.test(note))))throw Error('仍有遗漏或疑问，不能记录内容完整');
 if(r.verdict==='supplement'&&!r.concepts.length)throw Error('补齐结论没有可保存的补充内容');
}
