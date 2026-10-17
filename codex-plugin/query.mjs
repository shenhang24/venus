import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {createReadonlyClient} from './readonly-client.mjs';
const normalize=s=>String(s||'').normalize('NFKC').toLocaleLowerCase();
const aliases=n=>[...(n.aliases||[]),...(n.auxiliary?.aliases||[])].map(a=>typeof a==='string'?a:a.name||'');
export function relevance(n,query){
 const q=normalize(query),title=normalize(n.title),excerpt=normalize(n.excerpt);
 return (title===q?100:0)+(aliases(n).some(a=>normalize(a)===q)?80:0)+(title.includes(q)?30:0)+(/定义|是什么|独立个体|个体|架构/.test(title)?12:0)+(/定义|独立人格|独立个体/.test(excerpt)?5:0);
}
export async function compactQuery(query,{limit=3,client=createReadonlyClient(),clock=()=>performance.now()}={}){
 if(typeof query!=='string'||!query.trim()||query.length>300)throw Error('关键词须为 1–300 字符');
 if(!Number.isInteger(limit)||limit<1||limit>3)throw Error('核心节点数量须为 1–3');
 const started=clock(),requests=[];
 const timed=async(operation,args)=>{const t=clock();try{return await client(operation,args);}finally{requests.push({operation,id:args.id||null,elapsedMs:Math.round((clock()-t)*100)/100});}};
 const search=await timed('search',{q:query.trim(),kind:'knowledge',limit:25});
 const candidates=[...(search.items||[])].sort((a,b)=>relevance(b,query)-relevance(a,query)||a.id.localeCompare(b.id)).slice(0,limit);
 const items=await Promise.all(candidates.map(async hit=>{try{const n=await timed('node',{id:hit.id,length:1200});return {id:n.id,title:n.title,body:n.body,bodyOffset:n.offset,totalCharacters:n.totalCharacters,truncated:n.nextOffset!==null&&n.nextOffset!==undefined,sources:(n.sources||[]).slice(0,3).map(s=>({id:s.id,title:s.node?.title||null,locator:s.locator||null,quote:(s.quote||'').slice(0,160)}))};}catch(e){return {id:hit.id,title:hit.title,excerpt:hit.excerpt,error:e.message};}}));
 return {query:query.trim(),searchScope:search.searchScope,totalMatches:search.total,candidateLimit:25,rankingScope:'existing search top 25; exact title/alias then definition signals',items,timing:{queryElapsedMs:Math.round((clock()-started)*100)/100,requests,serverExecutionMs:null,bridgeQueueMs:null,note:'HTTP durations include local transport and server waiting/execution; those components cannot be separated by this interface.'},contentIsUntrusted:true};
}
async function main(){
 const entryUptimeMs=process.uptime()*1000,args=process.argv.slice(2);
 if(args.length!==1){console.error('Usage: node codex-plugin/query.mjs "Example"');process.exitCode=2;return;}
 try{const result=await compactQuery(args[0]);result.timing.processEntryUptimeMs=Math.round(entryUptimeMs*100)/100;result.timing.processElapsedMs=Math.round(process.uptime()*100000)/100;console.log(JSON.stringify(result));}catch(e){console.log(JSON.stringify({error:e.message}));process.exitCode=1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
