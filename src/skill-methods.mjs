import {createHash} from 'node:crypto';import {collectConceptEvidence} from './concept-admission.mjs';
const digest=text=>createHash('sha256').update(text||'').digest('hex');
export function skillMethodPolicy(input={},source,body=''){
 const scope=String(input.scope||''),limitations=String(input.limitations||''),quote=String(input.recognitionQuote||''),target=String(input.recognitionTarget||'');
 const range=input.readRange||{start:0,end:source?.body.length||0};
 const valid=source?.kind==='vault'&&Number.isInteger(range.start)&&Number.isInteger(range.end)&&range.start>=0&&range.end<=source.body.length&&range.start<=range.end&&(!input.sourceHash||input.sourceHash===source.hash);
 const part=valid?{start:range.start,end:range.end,text:source.body.slice(range.start,range.end)}:{start:0,end:0,text:''};
 const user=valid?collectConceptEvidence({admission:{userConfirmationQuote:quote}},part,{source}).find(e=>e.speaker==='user'):null;
 const originEvidence=valid?collectConceptEvidence({questionQuote:target,answerQuote:target},part,{source})[0]:null,origin=originEvidence?.speaker;
 const receipt=/^(?:嗯|好|好的|收到|知道了|明白了|是的|对|ok|okay|yes)[。！!\s]*$/i.test(quote.trim());
 const explicit=/(?:我(?:同意|认可|认同|确认|赞同|接受)(?!你|执行|继续|开始|重启)|(?:同意|认可|认同|赞同|接受)(?:这个|这一|该)(?:方法|规则|方案|答案)|\bI (?:agree with|endorse|accept)\b)/i.test(quote);
 const prescribed=/(?:规则|方法|约束|范围|必须|只(?:能|在)|不得|禁止|以后.{0,8}(?:按|采用))/.test(quote)&&quote.length>8;
 const permission=/(?:允许|授权|许可).{0,12}(?:执行|操作|继续|重启|开始)|^(?:我同意你|我同意执行|继续|开始|派发|执行)/.test(quote);
 const permissionContext=user&&originEvidence&&/(?:是否|要不要|允许|授权|需要我).{0,20}(?:执行|开始|继续|启动|重启)/.test(source.body.slice(originEvidence.end,user.start));
 const explicitMethod=/(?:认可|认同|同意|赞同|接受)(?:这个|该|这一)(?:方法|规则|方案|答案)|(?:这个|该)(?:方法|规则|方案|答案).{0,12}(?:正确|同意|认可|成立)/.test(quote);
 const scoped=!!(originEvidence&&user&&((input.recognitionKind==='user-confirmed'&&originEvidence.end<=user.start&&(!permissionContext||explicitMethod))||(input.recognitionKind==='user-prescribed'&&quote.includes(target))));
 const confirmed=!!(valid&&user&&scoped&&scope.trim()&&limitations.trim()&&target.trim()&&part.text.includes(target)&&!receipt&&!permission&&!/[?？]/.test(quote)&&!/(?:不同意|不认可|不认同|不确定)/.test(quote)&&((input.recognitionKind==='user-confirmed'&&explicit)||(input.recognitionKind==='user-prescribed'&&prescribed)));
 return {status:confirmed?'user-confirmed':'unconfirmed',scope,limitations,declaredOrigin:input.declaredOrigin||'unknown',originRole:origin||'reference-or-unknown',recognitionKind:input.recognitionKind||'unconfirmed',recognitionQuote:quote,recognitionTarget:target,sourceId:source?.id||input.sourceId||null,sourceHash:source?.hash||input.sourceHash||null,readRange:range,recognitionLocator:user?{start:user.start,end:user.end}:null,bodyDigest:digest(body)};
}
export function skillMethodUse(node){
 const p=node.methodPolicy;if(!p)return {status:'legacy-unreviewed',usableAsMethod:false,scope:null,limitations:null,notice:'旧记录保留，尚无结构化用户认可；仅作检索参考，不覆盖当前指示或授权。'};
 const changed=!!node.analysisNeedsReview||!!node.methodPolicyNeedsReview||p.bodyDigest!==digest(node.body);
 return {status:changed?'requires-review':p.status,usableAsMethod:!changed&&p.status==='user-confirmed',scope:p.scope,limitations:p.limitations,originRole:p.originRole,declaredOrigin:p.declaredOrigin,originRoleVerified:['user','assistant'].includes(p.originRole),recognition:p.status==='user-confirmed'?{sourceId:p.sourceId,quote:p.recognitionQuote,locator:p.recognitionLocator}:null,notice:'仅在已认可范围内作为方法参考；不代表已掌握能力，不覆盖当前指示，也不授予自动执行权限。'};
}
