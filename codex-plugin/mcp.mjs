import readline from "node:readline";
import { call } from "./bridge.mjs";
const obj = (properties, required = []) => ({
    type: "object",
    properties,
    required,
    additionalProperties: true,
  }),
  str = { type: "string" },
  source = {
    type: "array",
    items: obj({ id: str, quote: str, locator: str }, ["id", "quote"]),
  };
const tools = [
  {
    name: "venus_classify",
    description:
      "为原始资料、知识点或技能保存归纳与有依据的多类别标签。Vault 原文不被改写。",
    inputSchema: obj(
      {
        id: str,
        summary: str,
        tags: {
          type: "array",
          items: obj({ name: str, reason: str, quote: str }, [
            "name",
            "reason",
            "quote",
          ]),
        },
        expectedHash: str,
        sourceHash: str,
        method: { enum: ["codex", "manual"] },
      },
      ["id", "summary", "tags", "expectedHash", "sourceHash"],
    ),
  },
  {
    name: "venus_snapshot",
    description: "读取 Venus 本机原文、知识、技能、关系及可续接任务。",
    inputSchema: obj({}),
  },
  {
    name: "venus_import",
    description: "主动指定保存原始 MD；同文去重，绝不覆盖旧原文。",
    inputSchema: obj({ name: str, body: str }, ["name", "body"]),
  },
  {
    name: "venus_save_knowledge",
    description: "逐条保存知识或技能 MD，来源逐字校验，更新须 expectedHash。",
    inputSchema: obj(
      {
        id: str,
        kind: { enum: ["knowledge", "skill"] },
        title: str,
        body: str,
        sources: source,
        expectedHash: str,
        level: { enum: ["涉及", "实践", "验证"] },
        domain: str,
        occupations: str,
        decision: { enum: ["新增", "补充", "修订"] },
      },
      ["id", "kind", "title", "body", "sources"],
    ),
  },
  {
    name: "venus_save_relation",
    description:
      "保存同网络关系与独立依据强度。每种关系各自保存，修改需当前关系 JSON 的 SHA256。",
    inputSchema: obj(
      {
        id: str,
        from: str,
        to: str,
        type: str,
        strength: { type: "number", minimum: 0, maximum: 1 },
        reason: str,
        summary: str,
        sources: source,
        dimensions: { type: "object" },
        expectedHash: str,
      },
      ["from", "to", "type", "strength", "reason", "sources"],
    ),
  },
  {
    name: "venus_progress",
    description: "保存可续接任务进度。operationId 用于重试去重。",
    inputSchema: obj(
      {
        sourceId: str,
        status: { enum: ["queued", "working", "paused", "done"] },
        stage: str,
        operationId: str,
      },
      ["sourceId", "status", "stage"],
    ),
  },
  {
    name: "venus_add_relation_type",
    description: "新增用户定义关系类型，界面自动增加独立多选筛选。",
    inputSchema: obj({ name: str, color: str }, ["name", "color"]),
  },
];
const routes = {
  venus_save_checkpoint:'handoff/checkpoint',
  venus_snapshot: "state",
  venus_classify: "classify",
  venus_import: "import",
  venus_save_knowledge: "upsert",
  venus_save_relation: "relation",
  venus_progress: "job",
  venus_add_relation_type: "type",
};
tools.push({name:'venus_save_checkpoint',description:'由来源端主动提交已授权对话的原始 MD 增量或完整快照，保存检查点；不会自动监听聊天结束。',inputSchema:obj({originId:str,eventId:str,cursor:str,expectedCursor:{type:['string','null']},body:str,name:str,sourceDate:str,final:{type:'boolean'},mode:{enum:['delta','snapshot']}},['originId','eventId','cursor','body'])});
export async function invoke(name, args) {
  if (!routes[name]) throw Error("未知工具");
  return call(routes[name], name === "venus_snapshot" ? undefined : args);
}
const rl = readline.createInterface({ input: process.stdin });
for await (const line of rl) {
  let m;
  try {
    m = JSON.parse(line);
  } catch {
    continue;
  }
  if (m.id === undefined) continue;
  let reply;
  try {
    if (m.method === "initialize")
      reply = {
        protocolVersion: m.params?.protocolVersion || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "venus-private", version: "0.2.0" },
      };
    else if (m.method === "tools/list") reply = { tools };
    else if (m.method === "tools/call") {
      try {
        const data = await invoke(m.params.name, m.params.arguments || {});
        reply = {
          content: [{ type: "text", text: JSON.stringify(data) }],
          isError: false,
        };
      } catch (e) {
        reply = { content: [{ type: "text", text: e.message }], isError: true };
      }
    } else if (m.method === "ping") reply = {};
    else {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: m.id,
          error: { code: -32601, message: "Method not found" },
        }) + "\n",
      );
      continue;
    }
    process.stdout.write(
      JSON.stringify({ jsonrpc: "2.0", id: m.id, result: reply }) + "\n",
    );
  } catch (e) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: m.id,
        error: { code: -32603, message: e.message },
      }) + "\n",
    );
  }
}
