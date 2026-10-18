export const HEAT_LEVELS = [
  {name:'白色',color:'#eeeeee',label:'单次使用'},
  {name:'绿色',color:'#63cf8b',label:'多轮跟进'},
  {name:'蓝色',color:'#61a7f5',label:'反复推进'},
  {name:'紫色',color:'#b18af2',label:'跨天持续'},
  {name:'橙色',color:'#f5a451',label:'持续投入'},
  {name:'金色',color:'#f3ce60',label:'长期重点'},
];
export const DEFAULT_HEAT_RULES = [{id:'shanhefan',name:'山河扇',level:5,
  terms:['山河扇','ShanheFan'],reason:'用户指定：现在的山河扇项目可标为金色。'}];
const dayFormat = new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'});
function dayOf(value){
  if (!value) return null;
  const time=/^\d+(?:\.\d+)?$/.test(value)?Number(value)*1000:Date.parse(value);
  return Number.isFinite(time)?dayFormat.format(time):null;
}
export function messageActivity(body){
  const re=/^#{2,3} (user|assistant|tool|system|developer) · ([^\r\n]+)\r?\n\r?\n(?:消息节点：([^\s；]+)；父节点：[^\r\n]*|消息 ID：([^\s；]+)；阶段：[^\r\n]*)/gm;
  const matches=[...body.matchAll(re)],seen=new Set(),out=[];
  for(let i=0;i<matches.length;i++){
    const m=matches[i],id=m[3]||m[4];
    if(seen.has(id))continue;seen.add(id);
    const end=matches[i+1]?.index??body.length;
    const text=body.slice(m.index+m[0].length,end).trim();
    const substantive=!/^(?:好(?:的)?|嗯+|哦+|收到|谢谢(?:你)?|ok|okay|thanks)[。.!！\s]*$/i.test(text);
    out.push({id,role:m[1],day:dayOf(m[2]),start:m.index,end,substantive});
  }
  return out;
}
export function activityLevel(turns,days,sessions=1){
  if(days>=5&&turns>=16)return 5;
  if(days>=3&&turns>=8)return 4;
  if(days>=2&&turns>=3)return 3;
  if(turns>=4||sessions>=3)return 2;
  if(turns>=2||sessions>=2)return 1;
  return 0;
}
export function deriveHeat(nodes,{cache=new Map(),rules=DEFAULT_HEAT_RULES}={}){
  const byId=new Map(nodes.map(n=>[n.id,n])),events=new Map(),results=new Map();
  const citations=cache.citations||=new Map();
  for(const n of nodes.filter(n=>n.kind==='vault')){
    let entry=cache.get(n.id);
    if(!entry||entry.hash!==n.hash){entry={hash:n.hash,messages:messageActivity(n.body)};cache.set(n.id,entry);}
    events.set(n.id,entry.messages);
  }
  const projectFor=(n)=>rules.find(r=>r.terms.some(t=>(n.title+' '+(n.categories||[]).join(' ')).toLowerCase().includes(t.toLowerCase())));
  const collect=(n,seen=new Set())=>{
    if(seen.has(n.id))return {records:[],vaults:new Set(),project:null};
    seen=new Set([...seen,n.id]);
    if(n.kind==='vault')return {records:(events.get(n.id)||[]).filter(m=>m.role==='user'&&m.substantive),vaults:new Set([n.id]),project:projectFor(n)};
    const records=[],vaults=new Set();let project=projectFor(n)||null;
    for(const source of n.sources||[]){
      const parent=byId.get(source.id);
      if(!parent||!source.quote)continue;
      if(parent.kind==='vault'){
        const key=parent.id+'\0'+(parent.hash??parent.body)+'\0'+source.quote;
        let attribution=citations.get(key);
        if(!attribution){
          attribution={valid:false,records:[]};let from=0,at;const found=new Set();
          while((at=parent.body.indexOf(source.quote,from))>=0){
            attribution.valid=true;
            const m=(events.get(parent.id)||[]).find(m=>at>=m.start&&at<m.end);
            if(m&&!found.has(m.id)){found.add(m.id);attribution.records.push({...m,id:parent.id+':'+m.id});}
            from=at+Math.max(1,source.quote.length);
          }
          if(citations.size>=50000)citations.clear();citations.set(key,attribution);
        }
        if(!attribution.valid)continue;
        vaults.add(parent.id);project ||= projectFor(parent);
        // Attribute only the actually cited message, not the entire source conversation.
        records.push(...attribution.records);
      }else{
        if(!parent.body.includes(source.quote))continue;
        const upstream=collect(parent,seen);records.push(...upstream.records);upstream.vaults.forEach(id=>vaults.add(id));project ||= upstream.project;
      }
    }
    return {records,vaults,project};
  };
  for(const n of nodes){
    const {records,vaults,project}=collect(n),unique=new Map(records.map(m=>[m.id,m]));
    const days=new Set([...unique.values()].map(m=>m.day).filter(Boolean));
    const userTurns=[...unique.values()].filter(m=>m.role==='user'&&m.substantive).length;
    // Independent source discussions count as reuse; repeated machine citations do not.
    const count=n.kind==='vault'?userTurns:Math.max(userTurns,vaults.size);
    const automatic=activityLevel(count,days.size,vaults.size),level=project?project.level:automatic;
    const style=HEAT_LEVELS[level];
    results.set(n.id,{level,...style,userTurns,activeDays:days.size,sourceConversations:vaults.size,
      basis:project?'user-project':'source-activity',project:project?.name||null,
      reason:project?project.reason:`${userTurns} 条用户跟进，${days.size} 个讨论日期，${vaults.size} 份来源对话；按引用定位，未用字数或关键词出现次数计分。`});
  }
  for(const id of cache.keys())if(!byId.has(id))cache.delete(id);
  return results;
}
