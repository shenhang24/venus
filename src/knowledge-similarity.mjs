export const KNOWLEDGE_SIMILARITY_THRESHOLD=.95;
export function normalizedKnowledge(body){
 const lines=String(body||'').split(/\r?\n/),core=[];let active=false,found=false;
 for(const line of lines){if(/^##\s+(?:提取的知识|Extracted knowledge)\s*$/i.test(line)){active=true;found=true;continue;}if(/^#{1,2}\s/.test(line))active=false;else if(active)core.push(line);}
 return (found?core.join('\n'):String(body||'').replace(/^# [^\n]*\n+/,'')).normalize('NFKC').replace(/\s+/gu,'');
}
// Multiset Sørensen–Dice over adjacent Unicode-character bigrams, O(n).
// Evidence quotations and repeated document wrappers cannot inflate the score.
export function knowledgeSimilarity(a,b){
 const x=[...normalizedKnowledge(a)],y=[...normalizedKnowledge(b)];if(!x.length||!y.length)return 0;if(x.length<2||y.length<2)return x.join('')===y.join('')?1:0;
 const counts=new Map();for(let i=1;i<x.length;i++){const key=x[i-1]+x[i];counts.set(key,(counts.get(key)||0)+1);}let common=0;
 for(let i=1;i<y.length;i++){const key=y[i-1]+y[i],n=counts.get(key)||0;if(n){common++;counts.set(key,n-1);}}
 return 2*common/(x.length+y.length-2);
}
