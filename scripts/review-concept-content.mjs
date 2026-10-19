import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
// User cancelled semantic reviews. This legacy entry cannot create a worker.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');let current=null;
try{current=JSON.parse(fs.readFileSync(path.join(root,'data/.venus/concept-content-review.json'))).current;}catch{}
console.log(JSON.stringify({status:'cancelled-semantic-review',modelCallsStarted:0,checkpoint:current,message:'重复内容语义复核已取消；仅允许现有覆盖缺口提取。'}));
