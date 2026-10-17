import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parsers} from 'prettier/plugins/acorn.mjs';
import {resolveLanguage,setLanguage,tr,uiError} from '../public/i18n.js';
import {selectUILanguage} from '../src/ui-language.mjs';
import {taskPresentation,knowledgeForSource} from '../public/knowledge-view.js';

test('Windows display language takes priority; browser fallback and unsupported languages are deterministic',()=>{
  for(const resolve of [resolveLanguage,selectUILanguage]){
    assert.equal(resolve('zh-CN',['en-US']),'zh');
    assert.equal(resolve('en-GB',['zh-CN']),'en');
    assert.equal(resolve(null,['zh-TW']),'zh');
    assert.equal(resolve(null,['en-AU']),'en');
    assert.equal(resolve('de-DE',['zh-CN']),'en');
    assert.equal(resolve(null,[]),'en');
  }
});
test('all developer-owned Chinese literals in content, controls and task states have English translations',()=>{
  setLanguage('en');
  try {
    for(const file of ['app.js','knowledge-view.js']){
      const source=fs.readFileSync(new URL('../public/'+file,import.meta.url),'utf8');
      const ast=parsers.acorn.parse(source,{});
      function visit(node){
        if(!node||typeof node!=='object')return;
        if(node.type==='CallExpression'&&node.callee?.name==='tr'&&node.arguments[0]?.type==='Literal')
          assert.doesNotMatch(tr(node.arguments[0].value),/[\u3400-\u9fff]/,node.arguments[0].value);
        for(const[key,value]of Object.entries(node))if(!['tokens','comments','loc'].includes(key)){
          if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
        }
      }
      visit(ast);
    }
    assert.equal(tr('暂停此文件'),'Pause this file');
    assert.equal(uiError('正文不能为空'),'Body cannot be empty');
    assert.match(taskPresentation({analysis:{enabled:true,running:true,total:4,completed:1}}).status,/Started/);
  } finally {setLanguage('zh');}
});
test('English UI preserves Chinese sources; Chinese UI preserves English conversations and extracted analysis',()=>{
  const nodes=[{id:'cn',kind:'vault',title:'中文私有资料.md',body:'原文 Knowledge 混合表达'},
    {id:'en',kind:'vault',title:'Original conversation.md',body:'Keep the original conversation.'},
    {id:'kcn',kind:'knowledge',title:'中文提取',body:'保留中文分析',sources:[{id:'cn',quote:'原文'}]},
    {id:'ken',kind:'knowledge',title:'English analysis',body:'Preserve English analysis.',sources:[{id:'en',quote:'original'}]}];
  const before=JSON.stringify(nodes);
  for(const language of ['en','zh']){
    setLanguage(language);
    assert.equal(knowledgeForSource(nodes,'cn')[0].body,'保留中文分析');
    assert.equal(knowledgeForSource(nodes,'en')[0].body,'Preserve English analysis.');
    assert.equal(JSON.stringify(nodes),before);
  }
});
