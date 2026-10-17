import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store, hash } from "../src/store.mjs";
import { createApp } from "../src/server.mjs";
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "venus-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return new Store(root);
}
const knowledge = (id, source, quote) => ({
  id,
  kind: "knowledge",
  title: "知识 " + id,
  body: "# 知识\n\n知识含义与边界。",
  sources: [{ id: source.id, quote }],
});

test('reset layout changes only positions and rejects pre-reset checkpoints',t=>{
  const s=fixture(t),source=s.import({name:'layout-reset',body:'保存原文，调整星图。'}).node;
  const k=s.upsert(knowledge('reset-k',source,'保存原文'));
  const before=s.nodes.map(n=>[n.id,n.hash]),jobs=JSON.stringify(s.state.jobs),old=[...s.state.positions[source.id]],other=[...s.state.positions[k.id]];
  s.resetLayout({kind:'vault'});
  assert.notDeepEqual(s.state.positions[source.id],old);assert.deepEqual(s.state.positions[k.id],other);
  assert.deepEqual(s.nodes.map(n=>[n.id,n.hash]),before);assert.equal(JSON.stringify(s.state.jobs),jobs);
  assert.throws(()=>s.checkpointLayout({kind:'vault',positions:{[source.id]:old}}),/布局已重置/);
  s.checkpointLayout({kind:'vault',epoch:1,positions:{[source.id]:[1,2,3]}});
  const restored=new Store(s.root);assert.equal(restored.snapshot().layoutEpochs.vault,1);
  s.resetLayout({kind:'all',mode:'center'});
  for(const n of s.nodes)assert.deepEqual(s.state.positions[n.id],[0,0,0]);
  assert.throws(()=>s.checkpointLayout({kind:'vault',epoch:2,positions:{[source.id]:old}}),/布局已重置/);
  s.checkpointLayout({kind:'vault',epoch:2,protocol:2,positions:{[source.id]:[0,0,0]}});
});
test("Vault UTF-8 原文逐字保存，重复导入与恶意文件名不会覆盖或越界", (t) => {
  const s = fixture(t),
    body = "# 原文\r\n\r\n观察：先提问，再收集证据。";
  const a = s.import({ name: "../原文", body });
  assert.equal(fs.readFileSync(path.join(s.root, a.node.path), "utf8"), body);
  const b = s.import({ name: "别名", body });
  assert.equal(b.node.id, a.node.id);
  assert.ok(b.duplicate);
  assert.ok(a.node.path.startsWith("Vault/"));
  assert.equal(s.nodes.length, 1);
});

test('quote-validation cache preserves exact checks and invalidates when a source is edited or removed',t=>{
  const s=fixture(t),source=s.import({name:'quote-cache',body:'旧的逐字证据。'}).node;
  const k=s.upsert(knowledge('cache-k',source,'旧的逐字证据'));
  assert.equal(s.snapshot({summary:true}).nodes.find(n=>n.id===k.id).sources[0].quoteValid,true);
  const oldCache=s.quoteValidationCache.size;s.snapshot({summary:true});assert.equal(s.quoteValidationCache.size,oldCache);
  s.edit({id:source.id,body:'新的逐字证据。',expectedHash:source.hash});
  const next=s.snapshot({summary:true}).nodes.find(n=>n.id===k.id);
  assert.equal(next.sources[0].quoteValid,false);assert.equal(next.analysisNeedsReview,true);
  fs.unlinkSync(path.join(s.root,source.path));s.scan();assert.equal(s.sourceQuoteValid({id:source.id,quote:'旧的逐字证据'}),false);
});

test('memory snapshots do not scan disk and reflect changes after the normal refresh scan',t=>{
  const s=fixture(t),source=s.import({name:'memory-state',body:'尚未变化的原文。'}).node;
  const originalScan=s.scan.bind(s);let scans=0;s.scan=()=>{scans++;return originalScan();};
  fs.writeFileSync(path.join(s.root,source.path),'已经变化的原文。','utf8');
  assert.equal(s.snapshot({summary:true,refresh:false}).nodes.find(n=>n.id===source.id).hash,source.hash);assert.equal(scans,0);
  s.scan();assert.notEqual(s.snapshot({summary:true,refresh:false}).nodes.find(n=>n.id===source.id).hash,source.hash);assert.equal(scans,1);
});

test('targeted input reads detect edits without rescanning unrelated source files',t=>{
  const s=fixture(t),a=s.import({name:'target-a',body:'第一份输入资料。'}).node,b=s.import({name:'target-b',body:'第二份输入资料。'}).node;
  fs.writeFileSync(path.join(s.root,a.path),'第一份输入资料，已有修改。','utf8');fs.writeFileSync(path.join(s.root,b.path),'第二份输入资料，已有修改。','utf8');
  const before={...s.readStats};assert.notEqual(s.find(a.id).hash,a.hash);
  assert.equal(s.readStats.fullScans,before.fullScans);assert.equal(s.nodeById.get(b.id).hash,b.hash);
  s.scan();assert.notEqual(s.nodeById.get(b.id).hash,b.hash);
});
test("派生来源必须真实，技能需要知识依据，不允许单独声明关键词即掌握", (t) => {
  const s = fixture(t),
    v = s.import({ name: "来源", body: "先提问，再收集证据。" }).node;
  assert.throws(() => s.upsert(knowledge("bad", v, "不存在的句子")), /引文/);
  const k = s.upsert(knowledge("k1", v, "先提问"));
  assert.throws(
    () =>
      s.upsert({
        id: "skill1",
        kind: "skill",
        title: "技能",
        body: "能做什么",
        sources: [{ id: v.id, quote: "先提问" }],
        level: "验证",
      }),
    /知识点依据/,
  );
  const skill = s.upsert({
    id: "skill1",
    kind: "skill",
    title: "学习评价",
    body: "只是涉及，暂无实践证明。",
    sources: [{ id: k.id, quote: "知识含义" }],
    level: "涉及",
  });
  assert.equal(skill.level, "涉及");
  assert.equal(s.nodes.filter((n) => n.kind === "skill").length, 1);
});
test("多种关系独立保存，依据可追溯，跨层连边被拒绝", (t) => {
  const s = fixture(t),
    v = s.import({ name: "来源", body: "提问，然后验证反馈。" }).node,
    k1 = s.upsert(knowledge("k1", v, "提问")),
    k2 = s.upsert(knowledge("k2", v, "验证反馈"));
  const r = {
    from: k1.id,
    to: k2.id,
    type: "logic",
    strength: 0.7,
    reason: "提问后收集证据用于反馈",
    sources: [{ id: v.id, quote: "提问，然后验证反馈" }],
  };
  s.relation(r);
  s.relation({ ...r, type: "step" });
  assert.equal(s.relations.length, 2);
  assert.match(
    fs.readFileSync(path.join(s.root, "知识点/_关系.md"), "utf8"),
    /提问后收集证据/,
  );
  assert.throws(() => s.relation({ ...r, to: v.id }), /同一网络/);
  const old = s.relations[0];
  assert.throws(() => s.relation({ ...old, reason: "修订" }), /已变化/);
  s.relation({
    ...old,
    reason: "修订",
    expectedHash: hash(JSON.stringify(old)),
  });
  assert.equal(s.relations.length, 2);
});
test("并发修改检查、版本回退、重启恢复与坐标稳定", (t) => {
  const s = fixture(t),
    v = s.import({ name: "原文", body: "原始内容" }).node;
  const originalPosition = [...s.state.positions[v.id]];
  const edited = s.edit({
    id: v.id,
    body: "修改后的内容",
    expectedHash: v.hash,
  });
  assert.throws(
    () => s.edit({ id: v.id, body: "过期更新", expectedHash: v.hash }),
    /已变化/,
  );
  const versions = s.history(v.id);
  assert.equal(versions.length, 1);
  const restored = s.restore({
    id: v.id,
    version: versions[0].version,
    expectedHash: edited.hash,
  });
  assert.equal(restored.body, "原始内容");
  const reopened = new Store(s.root);
  assert.equal(reopened.find(v.id).body, "原始内容");
  assert.deepEqual(reopened.state.positions[v.id], originalPosition);
  assert.equal(reopened.history(v.id).length, 2);
});
test("逐步任务、暂停/恢复、进度去重与外部 MD 自动发现", (t) => {
  const s = fixture(t),
    v = s.import({ name: "待分析", body: "待分析资料" }).node;
  s.job({
    sourceId: v.id,
    status: "working",
    stage: "阅读原文",
    operationId: "read-1",
  });
  s.job({
    sourceId: v.id,
    status: "working",
    stage: "重复不得覆盖",
    operationId: "read-1",
  });
  assert.equal(s.state.jobs[0].stage, "阅读原文");
  s.job({ sourceId: v.id, status: "paused", stage: "暂停" });
  const n = new Store(s.root);
  assert.equal(n.state.jobs[0].status, "paused");
  const positions = structuredClone(n.state.positions);
  fs.writeFileSync(path.join(n.root, "Vault/外部.md"), "# 外部原文");
  assert.equal(n.scan(), true);
  assert.equal(n.nodes.length, 2);
  for (const [id, p] of Object.entries(positions))
    assert.deepEqual(n.state.positions[id], p);
});
test("新增关系类型自动保存；显示设置校验，连接增长比例可调整", (t) => {
  const s = fixture(t);
  s.type({ name: "互为前提", color: "#aabbcc" });
  assert.equal(new Store(s.root).state.types.length, 6);
  s.configure({ growth: 0.002 });
  assert.equal(s.state.settings.growth, 0.002);
  assert.throws(() => s.configure({ baseRadius: 4, maxRadius: 2 }), /最大半径/);
});
test("HTTP import、事件刷新、跨站拒绝、UTF-8 分片与服务重启后持久化", async (t) => {
  const s = fixture(t);
  const { app } = createApp({ root: s.root, port: 10001 });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  t.after(() => app.close());
  const base = "http://127.0.0.1:" + app.address().port;
  const response = await fetch(base + "/api/events");
  const reader = response.body.getReader();
  const first = await reader.read();
  assert.match(new TextDecoder().decode(first.value), /data:/);
  const send = (route, data, headers = {}) =>
    fetch(base + "/api/" + route, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(data),
    });
  const rejected = await send(
    "import",
    { name: "攻击", body: "跨站" },
    { Origin: "http://attacker.invalid" },
  );
  assert.equal(rejected.status, 403);
  const r = await send("import", { name: "中文原文", body: "完整中文证据。" });
  assert.equal(r.status, 200);
  const imported = await r.json();
  assert.equal(imported.node.body, "完整中文证据。");
  const next = await reader.read();
  assert.match(new TextDecoder().decode(next.value), /data:/);
  await reader.cancel();
  const snapshot = await (await fetch(base + "/api/state")).json();
  assert.equal(snapshot.nodes.length, 1);
  assert.equal(new Store(s.root).nodes[0].body, "完整中文证据。");
  const bad = await send("upsert", knowledge("bad", imported.node, "伪造"));
  assert.equal(bad.status, 400);
});
test("有向步骤关系保留方向，不合并正向与反向含义", (t) => {
  const s = fixture(t),
    v = s.import({
      name: "依据",
      body: "步骤之间存在前后依赖，也可能需要回到先前步骤。",
    }).node,
    a = s.upsert(knowledge("a", v, "步骤")),
    b = s.upsert(knowledge("b", v, "步骤"));
  const r = {
    from: a.id,
    to: b.id,
    type: "step",
    strength: 0.6,
    reason: "前后依赖",
    sources: [{ id: v.id, quote: "前后依赖" }],
  };
  s.relation(r);
  s.relation({ ...r, from: b.id, to: a.id, reason: "回到先前步骤" });
  assert.equal(s.relations.length, 2);
});
test("Vault 中看似系统元数据的文字只作为原文，不会伪装关系或更改节点身份", (t) => {
  const s = fixture(t);
  const body = '<!-- venus:{"record":"relations","id":"fake"} -->\n# 原文';
  const n = s.import({ name: "元数据边界", body }).node;
  assert.equal(n.body, body);
  assert.notEqual(n.id, "fake");
  assert.equal(s.relations.length, 0);
});
test("保存新关系不瞬移坐标，由前端持续布局牵引", (t) => {
  const s = fixture(t),
    a = s.import({ name: "A", body: "共同证据" }).node,
    b = s.import({ name: "B", body: "共同证据，第二份" }).node,
    c = s.import({ name: "C", body: "另一份内容" }).node;
  s.state.positions[a.id] = [0, 0, 0];
  s.state.positions[b.id] = [100, 0, 0];
  const original = [...s.state.positions[c.id]];
  s.relation({
    from: a.id,
    to: b.id,
    type: "related",
    strength: 0.9,
    reason: "同一证据",
    sources: [{ id: a.id, quote: "共同证据" }],
  });
  assert.deepEqual(s.state.positions[b.id], [100, 0, 0]);
  assert.deepEqual(s.state.positions[c.id], original);
  assert.deepEqual(
    new Store(s.root).state.positions[b.id],
    s.state.positions[b.id],
  );
});
test("关系旧版本可回退，回退前版本同样保留且拒绝过期修订", (t) => {
  const s = fixture(t),
    a = s.import({ name: "a", body: "同一条证据" }).node,
    b = s.import({ name: "b", body: "另一份证据" }).node;
  const first = s.relation({
    from: a.id,
    to: b.id,
    type: "related",
    strength: 0.8,
    reason: "原理由",
    sources: [{ id: a.id, quote: "同一条证据" }],
  });
  s.relation({
    ...first,
    reason: "修正理由",
    expectedHash: hash(JSON.stringify(first)),
  });
  const versions = s.history("@relations");
  assert.equal(versions.length, 1);
  const current = s.snapshot().relationDocumentHash;
  assert.throws(
    () =>
      s.restore({
        id: "@relations",
        version: versions[0].version,
        expectedHash: "stale",
      }),
    /已变化/,
  );
  s.restore({
    id: "@relations",
    version: versions[0].version,
    expectedHash: current,
  });
  assert.equal(s.relations[0].reason, "原理由");
  assert.equal(s.history("@relations").length, 2);
});
test("Vault 分类保留原文、逐字校验标签依据，重启后仍可追溯", (t) => {
  const s = fixture(t),
    body = "# 教学观察\n\n教师收集学生作品，依据反馈修订教学。",
    n = s.import({ name: "资料", body }).node;
  assert.equal(s.state.jobs[0].stage, "原文已保存，等待 Codex 归纳分类");
  assert.throws(
    () =>
      s.classify({
        id: n.id,
        summary: "教学观察记录",
        tags: [{ name: "教育", reason: "教学内容", quote: "伪造" }],
        expectedHash: n.classificationHash,
        sourceHash: n.hash,
      }),
    /逐字/,
  );
  const c = s.classify({
    id: n.id,
    summary: "记录教师如何依据学生作品改进教学。",
    tags: [
      { name: "教育", reason: "讨论教师教学", quote: "教师收集学生作品" },
      { name: "学习评价", reason: "用作品支持反馈", quote: "依据反馈修订教学" },
    ],
    expectedHash: n.classificationHash,
    sourceHash: n.hash,
    method: "codex",
  });
  assert.deepEqual(c.categories, ["教育", "学习评价"]);
  assert.equal(fs.readFileSync(path.join(s.root, n.path), "utf8"), body);
  assert.deepEqual(new Store(s.root).find(n.id).categories, c.categories);
  assert.throws(
    () =>
      s.classify({
        id: n.id,
        summary: "过期写入",
        tags: c.classification.tags,
        expectedHash: n.classificationHash,
        sourceHash: n.hash,
      }),
    /已变化/,
  );
});
test("三类内容分类独立，修改正文后提示标签依据待复核", (t) => {
  const s = fixture(t),
    v = s.import({ name: "来源", body: "有依据的知识" }).node,
    k = s.upsert(knowledge("k", v, "知识"));
  let n = s.classify({
    id: k.id,
    summary: "知识说明",
    tags: [{ name: "方法知识", reason: "说明知识含义", quote: "知识含义" }],
    expectedHash: k.classificationHash,
    sourceHash: k.hash,
  });
  assert.equal(s.find(v.id).categories.length, 0);
  assert.equal(n.classificationNeedsReview, false);
  n = s.edit({
    id: n.id,
    body: "## 修改后的知识\n\n新知识含义。",
    expectedHash: n.hash,
  });
  assert.equal(n.classificationNeedsReview, true);
  assert.deepEqual(n.categories, ["方法知识"]);
});
test("浮动位置检查点可恢复，不修改内容修订、不跨层或接受无效坐标", (t) => {
  const s = fixture(t),
    n = s.import({ name: "资料", body: "原文" }).node,
    revision = s.snapshot().revision;
  s.checkpointLayout({ kind: "vault", positions: { [n.id]: [1, 2, 3] } });
  assert.equal(s.snapshot().revision, revision);
  assert.deepEqual(new Store(s.root).state.positions[n.id], [1, 2, 3]);
  assert.throws(
    () =>
      s.checkpointLayout({ kind: "skill", positions: { [n.id]: [1, 2, 3] } }),
    /无效/,
  );
  assert.throws(
    () =>
      s.checkpointLayout({
        kind: "vault",
        positions: { [n.id]: [Infinity, 2, 3] },
      }),
    /无效/,
  );
});
