import http from "node:http";
import {createLibraryRefresh} from "./library-refresh.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "./store.mjs";
import { AutoAnalyzer } from './analyzer.mjs';
import {readWindowsDisplayLanguage} from './ui-language.mjs';
import {createAnalysisProvider,readProviderConfig,saveProviderConfig,describeProvider} from './analysis-providers.mjs';
import {createReadQuery} from './readonly-query.mjs';
import {proxyTunnelControl} from './tunnel-control-proxy.mjs';
import {ConceptExtractor,conceptTemplate} from './concepts.mjs';
import {LayerPipeline} from './layer-pipeline.mjs';
import {AIConnections} from './ai-connections.mjs';
import {ExecutionJournal,errorCode} from './execution-journal.mjs';
import {ReviewControl} from './review-control.mjs';
import {ConceptRecheck} from './concept-recheck.mjs';
import {TaskControl} from './task-control.mjs';
import {AnalysisTemplates} from './analysis-templates.mjs';
import {WorkspaceSync} from './workspace-sync.mjs';
import {DataMaintenance} from './data-maintenance.mjs';
import {assignProjects} from './project-membership.mjs';
import {attachBackupProjectLineage} from './project-organization.mjs';
import {readUsageSummary} from './usage-meter.mjs';
import {projectGroups,projectScopesFor,nodeTagHierarchy} from '../public/taxonomy.js';
export const project = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export function createApp({
  root = path.join(project, "data"),
  port = 10001,
  onLifecycle = null,
  analysisRunner = null,
  connectionOptions = {},
  workspaceOptions = {},
  displayLanguageOverride = null,
  reviewLauncher = null,
  enableAnalysis = false,
  tunnelControlTransport = proxyTunnelControl,
} = {}) {
  const store = new Store(root),
    clients = new Set();
  store.backgroundRefresh=true;
  const provider=createAnalysisProvider(store.meta);
  const templates=new AnalysisTemplates(store.meta);store.analysisTemplates=templates;
  const runner=templates.wrap(analysisRunner||provider.runner);
  const readonlyQuery=createReadQuery(store);
  const concepts=new ConceptExtractor(store);
  const analyzer=enableAnalysis?new AutoAnalyzer(store,{runner,chunkSize:provider.config.chunkCharacters,maxConcurrent:5,enableMainTagBackfill:true,conceptExtractor:concepts}):null;
  const connections=new AIConnections(store.meta,{active:provider.description,...connectionOptions});
  const journal=new ExecutionJournal(store.meta,path.resolve(store.root,'../work'));
  const layers=analyzer?new LayerPipeline(store,{analyzer,concepts,query:readonlyQuery,runner,connectionRunner:family=>templates.wrap(connections.runnerFor(family)),eventSink:event=>journal.append(event)}):null;
  const reviewControl=new ReviewControl({project:path.resolve(store.root,'..'),meta:store.meta,journal,analysis:()=>analyzer?.status(),launcher:reviewLauncher});
  const tasks=new TaskControl({analyzer,layers,reviewControl,provider:provider.description,journal});
  store.taskControl=tasks;
  const workspaceSync=new WorkspaceSync(store,{tasks,connections,port,project,...workspaceOptions});
  tasks.onPause=()=>workspaceSync.pause();
  const maintenance=new DataMaintenance(store,{projectNodes:nodes=>attachBackupProjectLineage(nodes,projectLedger()),busy:(ids,keys)=>(keys.includes('tasks')||ids.length>0)&&(workspaceSync.running||!!reviewControl.worker()||[...(analyzer?.active.keys()||[]),...(layers?.active.keys()||[])].some(key=>keys.includes('tasks')||ids.some(id=>key.includes(id))))});
  const recheck=new ConceptRecheck(store,{journal,workerRunning:()=>!!reviewControl.worker()});
  const systemDisplayLanguage=displayLanguageOverride||readWindowsDisplayLanguage();
  let revision = store.state.revision;
  let projectLedgerCache={stamp:null,value:{}};
  const projectLedger=()=>{try{const file=path.resolve(store.root,'../work/daily-backup/ledger.json'),stat=fs.statSync(file),stamp=stat.mtimeMs+':'+stat.size;if(projectLedgerCache.stamp!==stamp)projectLedgerCache={stamp,value:JSON.parse(fs.readFileSync(file,'utf8'))};return projectLedgerCache.value;}catch{return {};}};
  const json = (res, data, status = 200) => {
    if(res.venusAction){const a=res.venusAction;journal.append({kind:status>=400?'error':a.route.includes('control')?'recovery':'operation',action:a.route,status:status>=400?'failed':data.fastPassed||data.structuralPassed?'verified-skip':data.manualRequired?'not-started':data.skipped?'skipped':data.accepted||data.queued?'accepted':'saved',sourceId:a.sourceId,code:status>=400?errorCode(data.error):undefined,error:status>=400?{original:data.error,disposition:'request-failed'}:null});}
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
      if(req.method==='GET'&&url.pathname==='/api/ready')return json(res,{ready:true,root:store.root});
      if(req.method==='GET'&&url.pathname==='/api/mcp-control/status'){const result=await tunnelControlTransport('status');return json(res,result.data,result.status);}
      if(req.method==='GET'&&url.pathname.startsWith('/api/read/'))return json(res,readonlyQuery(url.pathname.slice('/api/read/'.length),Object.fromEntries(url.searchParams)));
      if (req.method === 'GET' && url.pathname === '/api/ui-language')
        return json(res,{systemDisplayLanguage,supported:['zh','en'],fallback:'en'});
      if(req.method==='GET'&&url.pathname==='/api/tasks/status')return json(res,tasks.status());
      if(req.method==='GET'&&url.pathname==='/api/workspace/templates')return json(res,templates.list());
      if(req.method==='GET'&&url.pathname==='/api/workspace/sync')return json(res,workspaceSync.status());
      if(req.method==='GET'&&url.pathname==='/api/workspace/data')return json(res,maintenance.inventory());
      if(req.method==='GET'&&url.pathname==='/api/analysis-provider')return json(res,{saved:describeProvider(readProviderConfig(store.meta)),active:provider.description,activation:'next-backend-start',connectionTested:false});
      if(req.method==='GET'&&url.pathname==='/api/layers/status'){if(!layers)return json(res,{error:'当前后台未加载独立处理器'},503);return json(res,layers.status(url.searchParams.get('sourceId')||undefined));}
      if(req.method==='GET'&&url.pathname==='/api/ai-connections')return json(res,connections.summary());
      if(req.method==='GET'&&url.pathname==='/api/token-usage')return json(res,readUsageSummary(store.meta,{profiles:[{provider:provider.config.provider,model:provider.config.model,family:({codex:'gpt',gemini:'gemini',local:'local'})[provider.config.provider]||provider.config.provider},...Object.entries(connections.saved()).map(([family,c])=>({family,provider:c.provider,model:c.model}))]}));
      if(req.method==='GET'&&url.pathname==='/api/journal'){journal.syncReview();return json(res,journal.read(url.searchParams.get('day')||undefined,{limit:url.searchParams.get('limit'),before:url.searchParams.get('before')}));}
      if(req.method==='GET'&&url.pathname==='/api/task-record')return json(res,{latest:journal.latestTask,lastFailure:journal.latestFailure||null,boundary:'Local record only; other tasks must read it. No cross-thread push is sent.'});
      if(req.method==='GET'&&url.pathname==='/api/concept-review/status')return json(res,reviewControl.status());
      if(req.method==='GET'&&url.pathname==='/api/concept-review/recheck'){const {plan}=recheck.inspect(url.searchParams.get('sourceId'));return json(res,{sourceId:plan.sourceId,ruleVersion:plan.ruleVersion,reasons:plan.reasons,fastPassed:plan.fastPassed,modelRequired:plan.modelRequired});}
      if(req.method==='GET'&&url.pathname==='/api/concepts/template')return json(res,{template:conceptTemplate,automatic:'existing-five-lane-analysis',startsModelCall:false,ruleVersion:2});
      if(req.method==='GET'&&url.pathname==='/api/concepts/questions')return json(res,{items:Object.values(concepts.state.ignoredQuestions||{}).filter(q=>q.status==='ignored'),ignorable:true,createsTasks:false});
      if (req.method === "GET" && url.pathname === "/api/state") {
        const snapshot=store.snapshot({summary:url.searchParams.get('summary') === '1',refresh:false});
        snapshot.nodes=attachBackupProjectLineage(snapshot.nodes,projectLedger());
        snapshot.projectGroups=projectGroups(snapshot.nodes,snapshot.jobs);const scopes=projectScopesFor(snapshot.nodes,snapshot.projectGroups);
        snapshot.nodes=snapshot.nodes.map(n=>{const node={...n,projectOrganization:true,projectScopes:scopes.get(n.id)||[]};return {...node,tagHierarchy:nodeTagHierarchy(node)};});
        snapshot.taskControl=tasks.status();
        snapshot.independentLayers=layers?.activity()||null;
        if(layers)snapshot.conceptContentReview=reviewControl.status();
        return json(res,snapshot);
      }
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
        if(['/api/import','/api/edit','/api/upsert','/api/relation','/api/main-tags','/api/analysis','/api/layers/start','/api/layers/control','/api/concept-review/control','/api/concept-review/recheck'].includes(url.pathname))res.venusAction={route:url.pathname,sourceId:data.sourceId||data.id};
        if(url.pathname==='/api/concept-review/recheck')return json(res,recheck.request(data));
        if(url.pathname==='/api/concept-review/control')return json(res,await reviewControl.control(data));
        if(url.pathname==='/api/layers/control')return json(res,layers.control(data));
        if(['/api/mcp-control/start','/api/mcp-control/stop'].includes(url.pathname)){
          const result=await tunnelControlTransport(url.pathname.split('/').at(-1),{method:'POST',data,token:String(req.headers['x-venus-token']||'')});
          delete data.key;for(const chunk of chunks)chunk.fill(0);
          return json(res,result.data,result.status);
        }
        if(url.pathname==='/api/concepts/plan')return json(res,concepts.plan(data));
        if(url.pathname==='/api/concepts/retry')return json(res,concepts.retryFailed(data));
        if(url.pathname==='/api/ai-connections/detect')return json(res,await connections.detect(data));
        if(url.pathname==='/api/ai-connections/configure')return json(res,connections.configure(data));
        if(url.pathname==='/api/tasks/control')return json(res,tasks.control(data));
        if(url.pathname==='/api/workspace/sync')return json(res,await workspaceSync.start());
        if(url.pathname==='/api/workspace/sources')return json(res,workspaceSync.configure(data));
        if(url.pathname==='/api/workspace/projects')return json(res,assignProjects(store,data));
        if(url.pathname==='/api/workspace/templates')return json(res,templates.save(data));
        if(url.pathname==='/api/workspace/reanalyze'){
          if(!layers)throw Object.assign(Error('现有执行器不可用'),{status:503});
          if(!Array.isArray(data.sourceIds)||!data.sourceIds.length||data.sourceIds.length>50)throw Object.assign(Error('请明确选择 1–50 份来源，不接受全库重跑'),{status:400});
          if(!templates.input()[data.layer])throw Object.assign(Error('请先确认这一层的模板'),{status:400});
          if(analyzer.state.tasksPaused)throw Object.assign(Error('任务已全局暂停，请使用开始／断点继续'),{status:409});
          const sources=[...new Set(data.sourceIds)];for(const id of sources){const source=layers.source(id);if(data.layer==='skill'&&!layers.knowledge(source).length)throw Object.assign(Error('所选来源缺少已保存的知识依据，未提交任何重分析任务'),{status:409});if(analyzer.active.has(id)||analyzer.active.has('concept-only:'+id)||[...layers.active.keys()].some(k=>k.startsWith(id+':')))throw Object.assign(Error('所选资料正在处理，保存当前段后再发起'),{status:409});}
          return json(res,{results:sources.map(sourceId=>layers.start({sourceId,layer:data.layer,reanalyze:true,templateHash:templates.input()[data.layer].hash})),scope:sources,fullLibraryStarted:false});
        }
        if(url.pathname==='/api/workspace/delete-preview')return json(res,maintenance.preview(data));
        if(url.pathname==='/api/workspace/delete')return json(res,maintenance.execute(data));
        if(url.pathname==='/api/layers/start'){if(!layers)return json(res,{error:'当前后台未加载独立处理器'},503);return json(res,layers.start(data));}
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
        "/animation-clock.js": "public/animation-clock.js",
        "/layer-controls.js": "public/layer-controls.js",
        "/taxonomy.js": "public/taxonomy.js",
        "/workspace-controls.js": "public/workspace-controls.js",
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
  const libraryRefresh=createLibraryRefresh(store);
  const timer = setInterval(() => {
    try {
      libraryRefresh.poll();
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
    layers?.stop();
    clearInterval(timer);
    libraryRefresh.close();
    for (const c of clients) c.end();
  });
  if(analyzer)app.once('listening',()=>analyzer.start());
  app.once('listening',()=>journal.append({kind:'service',action:'SERVICE_LOADED',status:'ready',code:'local-service-loaded'}));
  if(layers)app.once('listening',()=>layers.run());
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
    enableAnalysis:process.env.VENUS_ANALYSIS !== '0',
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
