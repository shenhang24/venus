// This is a minimal structural check, not a model confidence or semantic score.
export function validateContentTitle(title,tagNames=[]){
 if(typeof title!=='string'||!title.trim()||/[\r\n]/.test(title))throw Error('标题须为单行内容核心');
 const plain=s=>s.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'').toLowerCase();
 let remainder=plain(title);if(/^(?:概念|知识点|技能|相关知识|内容概述|说明|concept|knowledge|skill)$/i.test(remainder))throw Error('标题不能只用泛词代替内容核心');
 for(const tag of [...new Set(tagNames.filter(Boolean))].sort((a,b)=>b.length-a.length)){const text=plain(tag);if(text)remainder=remainder.split(text).join('');}
 if(!remainder)throw Error('标题不能仅堆叠领域或项目标签');
 return title.trim();
}
