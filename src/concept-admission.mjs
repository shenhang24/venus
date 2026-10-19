// Evidence comes only from the current read segment. Speaker labels are
// provenance in the source transcript, never model assertions about speakers.
function messages(text){
 const markdown=[...text.matchAll(/^#{1,6}\s+(user|assistant|human|用户|助手)\s*(?:·[^\n]*|[:：][^\n]*)?\r?$/gmi)];
 const headers=markdown.length?markdown:[...text.matchAll(/^(user|assistant|human|用户|助手)\s*[:：]/gmi)];
 return headers.map((m,i)=>({role:/^(user|human|用户)$/i.test(m[1])?'user':'assistant',start:m.index+m[0].length,end:headers[i+1]?.index??text.length,text:text.slice(m.index+m[0].length,headers[i+1]?.index??text.length)}));
}
function locate(text,quote,role,offset){
 if(typeof quote!=='string'||!quote.trim()||quote.length>600)return null;
 const blocks=messages(text);let at=text.indexOf(quote);
 while(at>=0){const message=blocks.find(m=>m.role===role&&at>=m.start&&at+quote.length<=m.end);if(message)return {quote,start:offset+at,end:offset+at+quote.length,message:{...message,start:offset+message.start,end:offset+message.end}};at=text.indexOf(quote,at+1);}return null;
}
function knownLocate(quote,role,part,{source,priorEvidence=[]}={}){
 const current=locate(part.text,quote,role,part.start);if(current)return current;if(!source||typeof quote!=='string'||!quote.trim()||quote.length>600)return null;
 const candidates=[...priorEvidence.filter(e=>e.quote===quote&&e.end-e.start===quote.length&&source.body.slice(e.start,e.end)===quote)];
 const local=part.text.indexOf(quote);if(local>=0)candidates.unshift({quote,start:part.start+local,end:part.start+local+quote.length});
 for(const e of candidates){const context=source.body.slice(0,Math.max(part.end,e.end)),message=messages(context).find(m=>m.role===role&&e.start>=m.start&&e.end<=m.end);if(message)return {quote,start:e.start,end:e.end,message};}return null;
}
export function collectConceptEvidence(item,part,context={}){
 const a=item.admission||item,requested=[['questionQuote','user'],['answerQuote','assistant'],['userConfirmationQuote','user'],['conclusionQuote','user'],['conclusionQuote','assistant']];
 return requested.map(([key,role])=>knownLocate(a[key],role,part,context)).filter(Boolean).map(e=>({quote:e.quote,start:e.start,end:e.end,speaker:e.message.role})).filter((e,i,all)=>all.findIndex(x=>x.start===e.start&&x.end===e.end)===i);
}
export function conceptAdmission(item,part,context={}){
 if(context.historical)return historicalAdmission(item,part,context);
 const a=item.admission;if(!a||a.confirmationMeaning!=='answer-endorsement')return {accepted:false,reason:'没有可核对的用户答案认可'};
 const q=knownLocate(a.questionQuote,'user',part,context),answer=knownLocate(a.answerQuote,'assistant',part,context),ack=knownLocate(a.userConfirmationQuote,'user',part,context);
 const conclusion=knownLocate(a.conclusionQuote,'user',part,context)||knownLocate(a.conclusionQuote,'assistant',part,context);
 if(!q||!answer||!ack||!conclusion)return {accepted:false,reason:'缺少已读原文内的提问、回答、用户认可或结论定位'};
 if(q.start>=answer.start||answer.start>=ack.start||conclusion.start<answer.start)return {accepted:false,reason:'认可与问答形成顺序不符'};
 if(typeof a.confirmationTarget!=='string'||!a.confirmationTarget.trim()||!a.answerQuote.includes(a.confirmationTarget))return {accepted:false,reason:'用户认可指向未定位到该答案'};
 const spoken=ack.quote.trim(),plain=spoken.replace(/[\s，。！？、,.!?]/g,'');
 if(/[?？]/.test(spoken))return {accepted:false,reason:'疑问表达不是明确认可'};
 if(/(?:不|未|没)(?:同意|认可|认同|确认|赞同|接受)|(?:不同意|不对|再想想|还不确定)/.test(spoken))return {accepted:false,reason:'用户未认可该答案'};
 const adoption=/(?:就拿|就用|采用)(?:这个|这一|上述|上面的|该)(?:方案|模板|设计|方法|结构)?(?:作为|做为)(?:我们的)?(?:模板|基准|标准)/.test(spoken)&&!/(?:不要|不能|别|不想|不愿).{0,20}(?:作为|做为)/.test(spoken);
 if(adoption){const preceding=messages(context.source?context.source.body.slice(0,ack.end):part.text).filter(m=>m.end<=(context.source?ack.message.start:ack.message.start-part.start)).at(-1);if(!preceding||preceding.start!==(context.source?answer.message.start:answer.message.start-part.start))return {accepted:false,reason:'采用模板须明确指向紧邻的答案内容'};}
 const explicitObject=adoption||/(?:(?:同意|认可|认同|赞同|接受)(?:这个|这一|该|你的)(?:答案|解释|判断|结论|理解|说法|方案|观点)|(?:这个|这一|该)(?:答案|解释|判断|结论|理解|说法|方案|观点).{0,12}(?:正确|成立|认同|认可|同意)|你说得对|说得有道理|确实如此|就是这个意思|(?:your|that|this) (?:answer|explanation|conclusion) is correct|I agree with (?:your|that|this) (?:answer|explanation|conclusion))/i.test(spoken);
 const explicit=explicitObject||/我(?:确实|也|很)?(?:同意|认可|认同|赞同|接受)(?!\s*(?:你|执行|继续|开始|重启|派发|操作|去做))/.test(spoken);
 const brief=/^(?:嗯|好|好的|对|是|是的|没错|确实|yes|ok|okay|agreed)$/i.test(plain);
 const execute=/(?:允许|许可|授权).{0,12}(?:执行|操作|继续|启动|重启)|(?:开始|执行|继续|去做|照做|派发|发过去|重启)(?:吧|就行|可以了)?[。！!\s]*$/.test(spoken);
 const permissionPrompt=/(?:是否|要不要|可以|允许|授权|需要我).{0,20}(?:执行|开始|继续|派发|启动|重启)|(?:shall I|may I|proceed|permission to)/i.test(answer.message.text);
 if(permissionPrompt&&!explicitObject)return {accepted:false,reason:'许可执行的回应不能替代对答案内容的认可'};
 if(execute&&!explicit)return {accepted:false,reason:'执行许可不是对答案的认可'};
 if(brief){const body=context.source?context.source.body.slice(0,ack.end):part.text,offset=context.source?0:part.start,blocks=messages(body).map(m=>({...m,start:m.start+offset,end:m.end+offset})),before=blocks.filter(m=>m.end<=ack.message.start).at(-1);if(permissionPrompt||before?.start!==answer.message.start)return {accepted:false,reason:'简短回应无法明确指向答案认可'};}
 else if(!explicit&&!/\b(?:I agree with|I accept|I endorse|your answer is correct|that explanation is correct)\b/i.test(spoken))return {accepted:false,reason:'收到消息或含糊回应不能作为答案认可'};
 if(conclusion.message.start!==answer.message.start&&conclusion.message.start!==ack.message.start)return {accepted:false,reason:'不能把用户认可扩展到未认可的后续结论'};
 return {accepted:true,evidence:[['提问',q],['回答',answer],['用户认可',ack],['结论',conclusion]].map(([role,e])=>({role,quote:e.quote,start:e.start,end:e.end,speaker:e.message.role}))};
}

// A historical interpretation rule only. Never used to authorize operations,
// grant skill proficiency, or claim an explicit endorsement that did not occur.
function historicalAdmission(item,part,context){
 const a=item.admission;if(!a)return {accepted:false,reason:'缺少历史讨论的定位依据'};
 const q=knownLocate(a.questionQuote,'user',part,context),answer=knownLocate(a.answerQuote,'assistant',part,context),ack=knownLocate(a.userConfirmationQuote,'user',part,context),conclusion=knownLocate(a.conclusionQuote,'user',part,context)||knownLocate(a.conclusionQuote,'assistant',part,context);
 if(!q||!answer||!conclusion||q.start>=answer.start||conclusion.start<answer.start||!a.confirmationTarget?.trim()||!a.answerQuote.includes(a.confirmationTarget))return {accepted:false,reason:'历史概念的问答、结论或认可对象没有原文定位'};
 const source=context.source?.body||part.text,offset=context.source?0:part.start;
 const blocks=messages(source).map(m=>({...m,start:m.start+offset,end:m.end+offset}));
 const end=ack?.message.end??part.end;
 const opposed=blocks.filter(m=>m.role==='user'&&m.start>answer.message.start&&m.start<=end).find(m=>/(?:不|未|没)(?:同意|认可|认同|赞同|接受)|不对|并不是|(?:^|\n)\s*不是|撤回|纠正|更正|应该改为|你.{0,6}(?:说错|理解错|分析错)|\bI (?:disagree|do not agree|don't agree)|\b(?:that's|that is) (?:wrong|incorrect)|\bI retract/i.test(m.text));
 if(opposed)return {accepted:false,reason:'存在明确反对、纠正或撤回，不作隐含认可'};
 for(const quote of a.counterEvidence||[]){const contrary=knownLocate(quote,'user',part,context);if(!contrary||contrary.start<answer.start)return {accepted:false,reason:'反对或撤回依据缺少用户原文定位'};return {accepted:false,reason:'原文有明确反对、纠正或撤回，保留差异而不作认可'};}
 if(conclusion.message.start!==answer.message.start&&conclusion.message.start!==ack?.message.start)return {accepted:false,reason:'不得把历史认可扩展到后续新增解释'};
 const explicit=conceptAdmission(item,part,{...context,historical:false});
 if(explicit.accepted&&!/^(?:嗯|好|好的|对|是|是的|没错|确实|yes|ok|okay|agreed)[\s，。！？,.!?]*$/i.test(ack?.quote.trim()||''))return {...explicit,recognitionMethod:'explicit',executionAuthorization:false};
 let method='implicit',anchor=ack;
 if(ack){if(ack.start<=answer.start)return {accepted:false,reason:'历史回应发生在答案之前'};if(a.confirmationMeaning==='topic-ended'){method='topic-ended';if(conclusion.message.start!==answer.message.start)return {accepted:false,reason:'话题结束只认可原答案，不能把新话题当作原结论'};}}
 else{
  const last=blocks.at(-1);if(a.confirmationMeaning!=='topic-ended'||part.end!==context.source?.body.length||last?.start!==answer.message.start||conclusion.message.start!==answer.message.start)return {accepted:false,reason:'没有实际回应，且未定位到原对话话题结束'};
  method='topic-ended';anchor={quote:'',start:part.end,end:part.end,message:{role:null}};
 }
 const evidence=[['提问',q],['回答',answer],[method==='topic-ended'?'话题结束':'隐含认可',anchor],['结论',conclusion]].map(([role,e])=>({role,quote:e.quote,start:e.start,end:e.end,speaker:e.message.role}));
 return {accepted:true,recognitionMethod:method,executionAuthorization:false,evidence};
}
