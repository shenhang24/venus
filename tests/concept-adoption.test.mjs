import test from 'node:test';import assert from 'node:assert/strict';
import {conceptAdmission} from '../src/concept-admission.mjs';
const question='请给出角色模板。',answer='每个职业有不同属性和技能。',ack='就拿这个作为模板，我们写一个CardsDatabase 的GD';
function check(spoken=ack,conclusion=answer){const text=`### user · 1\n${question}\n### assistant · 2\n${answer}\n### user · 3\n${spoken}\n### assistant · 4\n后续新增的实现细节。`;return conceptAdmission({admission:{questionQuote:question,answerQuote:answer,userConfirmationQuote:spoken,conclusionQuote:conclusion,confirmationTarget:answer,confirmationMeaning:'answer-endorsement'}},{start:0,end:text.length,text},{source:{body:text}});}
test('explicit adoption recognizes only the adjacent template, not later implementation claims',()=>{assert.equal(check().accepted,true);assert.equal(check(ack,'后续新增的实现细节。').accepted,false);});
test('execution permission and rejection of template remain inadmissible',()=>{assert.equal(check('允许你继续执行。').accepted,false);assert.equal(check('不要就拿这个作为模板。').accepted,false);});
test('explicit agreement with a viewpoint is recognized without accepting rejection or subsequent expansion',()=>{assert.equal(check('认同你的观点，主体架构没有问题。').accepted,true);assert.equal(check('不认同你的观点。').accepted,false);assert.equal(check('认同你的观点。','后续新增的实现细节。').accepted,false);});
