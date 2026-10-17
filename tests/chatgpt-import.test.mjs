import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {Store} from '../src/store.mjs';

test('ChatGPT 导出转换后导入真实存储，逐字读回且重复导入不新增', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'venus-chat-import-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const source = path.join(root,'conversations.json');
  const output = path.join(root,'converted');
  fs.writeFileSync(source,JSON.stringify([{id:'test-only',title:'导入验收测试',create_time:1790000000,current_node:'m',mapping:{m:{parent:null,message:{author:{role:'user'},create_time:1790000000,content:{parts:['独立测试资料，不写入用户 Vault。\r\n第二行保持。']}}}}}]));
  const python = process.env.VENUS_PYTHON || (process.platform === 'win32'
    ? execFileSync('powershell.exe',['-NoProfile','-Command','python -c "import sys; print(sys.executable)"'],{encoding:'utf8'}).trim()
    : 'python3');
  execFileSync(python,['scripts/import-chatgpt.py',source,'--output',output]);
  const files=fs.readdirSync(output).filter(f=>f.endsWith('.md'));
  assert.equal(files.length,1);
  const body=fs.readFileSync(path.join(output,files[0]),'utf8');
  const store=new Store(path.join(root,'isolated-data'));
  const first=store.import({name:files[0],body});
  assert.equal(first.node.body,body);
  assert.equal(fs.readFileSync(path.join(store.root,first.node.path),'utf8'),body);
  assert.equal(store.import({name:files[0],body}).duplicate,true);
  assert.equal(new Store(store.root).nodes.length,1);
  const lite=store.snapshot({summary:true});
  assert.equal(lite.nodes[0].body,undefined);
  assert.equal(lite.nodes[0].bodyLength,body.length);
  assert.equal(store.find(first.node.id).body,body);
  const longBody='# 长对话\n'+'完整原文。'.repeat(420000);
  const longRecord=store.import({name:'超过旧版容量的对话',body:longBody});
  assert.equal(store.find(longRecord.node.id).body,longBody);
});
