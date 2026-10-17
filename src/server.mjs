import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "./store.mjs";
import { AutoAnalyzer } from './analyzer.mjs';
import {readWindowsDisplayLanguage} from './ui-language.mjs';
import {createAnalysisProvider,readProviderConfig,saveProviderConfig,describeProvider} from './analysis-providers.mjs';
import {createReadQuery} from './readonly-query.mjs';

export const project = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export function createApp({
  root = path.join(project, "data"),
  port = 10001,
  onLifecycle = null,
  enableAnalysis = false,

} = {}) {
  const store = new Store(root),
    clients = new Set();
  store.backgroundRefresh=true;
  const provider=createAnalysisProvider(store.meta);
  const readonlyQuery=createReadQuery(store);
  const analyzer=enableAnalysis?new AutoAnalyzer(store,{runner:provider.runner,chunkSize:provider.config.chunkCharacters,maxConcurrent:5,enableMainTagBackfill:true}):null;
  const systemDisplayLanguage=readWindowsDisplayLanguage();
  let revision = store.state.revision;
  const json = (res, data, status = 200) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(data));
  };
  const app = http.createServer(async (req, res) => {
    try {
      if (
        !["127.0.0.1", "localhost"].includes(
          (req.headers.host || "").split(":")[0],
        )
      )
        return json(res, { error: "本机访问限定" }, 403);
      const url = new URL(req.url, "http://127.0.0.1");
      if(req.method==='GET'&&url.pathname.startsWith('/api/read/'))return json(res,readonlyQuery(url.pathname.slice('/api/read/'.length),Object.fromEntries(url.searchParams)));
      if (req.method === 'GET' && url.pathname === '/api/ui-language')
        return json(res,{systemDisplayLanguage,supported:['zh','en'],fallback:'en'});
      if(req.method==='GET'&&url.pathname==='/api/analysis-provider')return json(res,{saved:describeProvider(readProviderConfig(store.meta)),active:provider.description,activation:'next-backend-start',connectionTested:false});
      if (req.method === "GET" && url.pathname === "/api/state")
        return json(res, store.snapshot({summary:url.searchParams.get('summary') === '1',refresh:false}));
      if (req.method === "GET" && url.pathname === "/api/node")
        return json(res, store.find(url.searchParams.get('id')));
      if (req.method === "GET" && url.pathname === "/api/history")
        return json(res, store.history(url.searchParams.get("id")));
      if (req.method === "GET" && url.pathname === "/api/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write("data: " + store.state.revision + "\n\n");
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }
      if (req.method === "POST" && url.pathname.startsWith("/api/")) {
        if (
          req.headers.origin &&
          !["http://127.0.0.1:" + port, "http://localhost:" + port].includes(
            req.headers.origin,
          )
        )
          return json(res, { error: "跨站写入被拒绝" }, 403);
        if (!req.headers["content-type"]?.startsWith("application/json"))
          return json(res, { error: "需要 JSON 请求" }, 415);
        let chunks = [],
          size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 32e6) {
            json(res, { error: "请求过大" }, 413);
            req.destroy();
            return;
          }
          chunks.push(chunk);
        }
        let data;
        try {
          data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          return json(res, { error: "JSON 格式无效" }, 400);
        }
        if (url.pathname === "/api/lifecycle") {
          if (!onLifecycle) return json(res, { error: "请通过新版启动入口运行 Venus" }, 503);
          if (!["restart", "shutdown"].includes(data.action)) return json(res, { error: "操作无效" }, 400);
          res.once("finish", () => setTimeout(() => onLifecycle(data.action), 100));
          return json(res, { accepted: true, action: data.action });
        }
        const routes = {
          '/api/handoff/checkpoint':()=>store.checkpoint(data),
          '/api/read/aux-tags':()=>readonlyQuery.setAuxiliary(data),
          '/api/analysis-provider':()=>({saved:describeProvider(saveProviderConfig(store.meta,data)),active:provider.description,requiresRestart:true,appliedToRunningAnalysis:false}),
          "/api/import": () => store.import(data),
          "/api/upsert": () => store.upsert(data),
          "/api/edit": () => store.edit(data),
          "/api/merge": () => store.mergeVault(data),
          "/api/unmerge": () => store.unmergeVault(data),
          "/api/relation": () => store.relation(data),
          "/api/type": () => store.type(data),
          "/api/job": () => store.job(data),
          "/api/restore": () => store.restore(data),
          "/api/settings": () => store.configure(data),
          "/api/layout": () => store.checkpointLayout(data),
          "/api/layout/reset": () => store.resetLayout(data),
          "/api/classify": () => store.classify(data),
          "/api/main-tags": () => store.setMainTags(data),
          "/api/analysis": () => {
            if(!analyzer)throw Object.assign(new Error('当前服务未启动自动执行器'),{status:503});
            return analyzer.configure(data);
          },
        };
        if (!routes[url.pathname])
          return json(res, { error: "接口不存在" }, 404);
        return json(res, routes[url.pathname]());
      }
      if (req.method !== "GET") return json(res, { error: "方法不支持" }, 405);
      const staticPaths = {
        "/": "public/index.html",
        "/app.js": "public/app.js",
        "/knowledge-view.js": "public/knowledge-view.js",
        "/i18n.js": "public/i18n.js",
        "/graph.js": "public/graph.js",
        "/layout.js": "public/layout.js",
        "/style.css": "public/style.css",
        "/vendor/three.module.js": "node_modules/three/build/three.module.js",
        "/vendor/three.core.js": "node_modules/three/build/three.core.js",
        "/vendor/OrbitControls.js":
          "node_modules/three/examples/jsm/controls/OrbitControls.js",
        "/vendor/marked.js": "node_modules/marked/lib/marked.esm.js",
      };
      const target = staticPaths[url.pathname];
      if (!target) return json(res, { error: "页面不存在" }, 404);
      const file = path.join(project, target);
      const ext = path.extname(file);
      res.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type":
          {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
          }[ext] || "text/plain",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      });
      fs.createReadStream(file).pipe(res);
    } catch (e) {
      json(res, { error: e.message }, e.status || 500);
    }
  });
  const timer = setInterval(() => {
    try {
      store.scan();
      if (revision !== store.state.revision) {
        revision = store.state.revision;
        for (const c of clients) c.write("data: " + revision + "\n\n");
      } else for (const c of clients) c.write(": keepalive\n\n");
    } catch (e) {
      console.error(e.message);
    }
  }, 1000);
  timer.unref();
  app.on("close", () => {
    analyzer?.stop();
    clearInterval(timer);
    for (const c of clients) c.end();
  });
  if(analyzer)app.once('listening',()=>analyzer.start());
  return { app, store };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.VENUS_PORT || 10001);
  const { app, store } = createApp({
    root: process.env.VENUS_DATA || path.join(project, "data"),
    port,
    enableAnalysis:process.env.VENUS_ANALYSIS === '1',
    onLifecycle: process.send ? (action) => {
      store.analyzer?.stop();
      if (process.send) process.send({ action });
      app.close();
      app.closeAllConnections();
      setTimeout(() => process.exit(0), 200);
    } : null,
  });
  app.on("error", (e) => {
    console.error("Venus 启动失败：" + e.message);
    process.exit(1);
  });
  app.listen(port, "127.0.0.1", () =>
    console.log("Venus / 启明星 http://127.0.0.1:" + app.address().port),
  );
}
