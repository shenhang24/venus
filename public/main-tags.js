import {nodeRadiusFactor} from './layout.js';
import {nodeTagHierarchy,tagHierarchy} from './taxonomy.js';
import {VAULT_HEAT_LEVELS} from './vault-heat.js';
export function mainTagNames(node){return nodeTagHierarchy(node).filter(tag=>tag.kind!=='unassigned'||tag.secondary.length>0).map(tag=>tag.key||tag.primary);}
export function matchesMainTag(node,name){if(!name)return true;const [primary,secondary]=name.split('::');return node.isMainTag?node.mainTag===primary:nodeTagHierarchy(node).some(tag=>(tag.key||tag.primary)===primary&&(!secondary||tag.secondary.includes(secondary)));}
export function effectiveDegrees(edges){
  const seen=new Set(),degrees={};
  for(const edge of edges){
    if(edge.semanticAnchor&&!edge.membershipLink||edge.from===edge.to)continue;
    const endpoints=['step','procedure'].includes(edge.type)?[edge.from,edge.to]:[edge.from,edge.to].sort();
    const key=JSON.stringify([...endpoints,edge.type]);if(seen.has(key))continue;seen.add(key);
    degrees[edge.from]=(degrees[edge.from]||0)+1;degrees[edge.to]=(degrees[edge.to]||0)+1;
  }
  return degrees;
}
export function displayedRadius(node,settings,degree=0){return settings.baseRadius*nodeRadiusFactor(node.isMainTag,node.isMainTag?(node.domainConnectionCount??degree):degree,settings.growth??.01);}
export function buildMainTagGraph(nodes,edges,positions={},spacing=30){
  const names=[...new Set(nodes.flatMap(mainTagNames))].sort();
  const seeds={...positions},anchors=[],cores=[];
  const centered=nodes.length>0&&nodes.every(n=>positions[n.id]?.length===3&&positions[n.id].every(v=>v===0));
  for(const name of names){
    let value=2166136261;for(const c of name)value=Math.imul(value^c.charCodeAt(0),16777619);
    const angle=(value>>>0)/4294967296*Math.PI*2,id='@main:'+nodes[0]?.kind+':'+name;
    const members=nodes.filter(node=>mainTagNames(node).includes(name));
    const connectionCount=new Set(members.map(node=>node.id)).size;
    const hierarchy=members.flatMap(nodeTagHierarchy).find(h=>(h.key||h.primary)===name);
    cores.push({id,title:hierarchy?.kind==='project'?hierarchy.primary:tr(hierarchy?.primary||name),isMainTag:true,mainTag:name,mainTags:[],kind:nodes[0]?.kind,domainConnectionCount:connectionCount,heat:mainTagHeat(connectionCount)});
    if(centered)seeds[id]=[0,0,0];else seeds[id]||=[Math.cos(angle)*spacing*7,Math.sin(angle*2.3)*spacing*3,Math.sin(angle)*spacing*7];
    for(const node of members){
      const h=nodeTagHierarchy(node).find(h=>(h.key||h.primary)===name),evidence=h?.kind==='project'?{reason:tr('按来源项目映射归属')+' · '+h.primary,quote:''}:(node.mainTags||[]).find(tag=>tagHierarchy(tag.name)?.primary===name)||{reason:tr(h?.kind==='unassigned'?'暂无可靠项目归属':'同一项目范围（按分支标题归组）'),quote:''};
      anchors.push({id:'@anchor:'+id+':'+node.id,from:id,to:node.id,type:'@semantic',strength:1,semanticAnchor:true,membershipLink:true,mainTag:name,summary:evidence.reason,reason:evidence.reason,sources:[{id:node.id,quote:evidence.quote}]});
    }
  }
  const coreIds=new Set(cores.map(core=>core.id));
  const contentEdges=edges.filter(edge=>!(coreIds.has(edge.from)&&coreIds.has(edge.to)));
  const allEdges=[...contentEdges,...anchors],connections=effectiveDegrees(allEdges);
  for(const core of cores)core.relationConnectionCount=connections[core.id]||0;
  return {nodes:[...cores,...nodes],edges:allEdges,positions:seeds};
}
import {tr} from './i18n.js';

export const MAIN_TAG_HEAT_STEPS=VAULT_HEAT_LEVELS.map((h,i)=>({...h,minimum:[0,2,3,5,10,16,25,32,40,45,50,75,100][i]}));
export const VAULT_MAIN_TAG_HEAT_STEPS=MAIN_TAG_HEAT_STEPS;
export function mainTagHeat(count,steps=MAIN_TAG_HEAT_STEPS){
  const rank=steps.filter(step=>count>=step.minimum).at(-1)||steps[0];
  return {color:rank.color,name:tr(rank.name),label:tr('归属连接')+' '+count,reason:tr('按归属节点去重计数；颜色不代表技能程度。')};
}
