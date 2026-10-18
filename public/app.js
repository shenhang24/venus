import { tr, initializeLanguage, uiLocale, uiError } from '/i18n.js';
await initializeLanguage();
import { marked } from "/vendor/marked.js";
import { Network, shortNodeLabel, createRelationVisibility, relationDisplayTypes } from "/graph.js";
const relationVisibility=createRelationVisibility(globalThis.localStorage);
import { knowledgeForSource, knowledgeInScope, knowledgeListPage, chooseKnowledgeSource, knowledgeStatus, taskPresentation, activityState, fileStageProgress, InlineDrafts, saveInlineDraft, linkedNeighbours } from "/knowledge-view.js";
let knowledgeSource=null,knowledgeQuery='',knowledgePage=0;
const inlineDrafts=new InlineDrafts();
let navigationContext=null;
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let state = {
    nodes: [],
    relations: [],
    types: [],
    jobs: [],
    positions: {},
    settings: {},
  },
  view = "vault",
  vaultId = null,
  chosen = null,
  graph = null,
  hidden = relationVisibility.hiddenFor([]),
  submitAction = null,
  selectedEdge = null,
  benchmark = false;
const labels = {
  vault: tr("Vault 原始资料"),
  knowledge: tr("AI 知识点"),
  skill: tr("AI 技能"),
  concept:tr('概念云'),
  "vault-network": tr("Vault 网络"),
  "knowledge-network": tr("AI 知识网络"),
  "skill-network": tr("AI 技能网络"),
  "concept-network":tr('概念网络'),
};
const contentPurposes={vault:tr('保存任意来源的原始 Markdown，保留原文。'),knowledge:tr('供 AI 检索、衔接上下文与回答；不覆盖当前指示。'),skill:tr('记录已认可方法、适用范围与限制；区分未确认建议，不代替当前授权。'),concept:tr('帮助人理解交流中真正获得的认识；未确认问题单独记录，可忽略。')};
const mainTagSelections={};
function mainTagsHTML(node){return (node.mainTags||[]).length?'<div class="main-tags"><strong>'+tr('主分类')+'</strong> '+node.mainTags.map(tag=>'<button class="category-chip" data-main-tag="'+esc(tag.name)+'" data-main-kind="'+node.kind+'" title="'+esc(tag.reason+'\n'+tag.quote)+'">'+esc(tag.name)+'</button>').join('')+'</div>':'';}
function bindMainTags(){
  document.querySelectorAll('[data-main-tag]').forEach(button=>button.onclick=()=>{
    const kind=button.dataset.mainKind||view.replace('-network','');
    mainTagSelections[kind]=button.dataset.mainTag||null;
    if(view!==kind+'-network')navigate(kind+'-network');
    updateGraph();if(mainTagSelections[kind])focusFilteredContent({mainTag:mainTagSelections[kind]});renderInspector();
  });
}
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").style.display = "none"), 3300);
}
function activityHTML() {
  const activity = activityState(state.analysis);
  return '<div class="task-activity ' + activity.mode + '"><span>' + esc(activity.label) + ' · ' + (state.analysis?.completed ?? '—') + '/' + (state.analysis?.total ?? '—') + '</span><div class="task-track"><i></i></div></div>';
}
function compactSlotsHTML() {
  const active=state.analysis?.activeFiles||[];
  return active.map(file=>{
    const p=state.analysis.fileProgress?.[file.sourceId],stage=fileStageProgress(state.analysis,file.sourceId);
    const description=file.title+' · '+stage.label+' · '+(p?.offset||0)+'/'+file.total;
    return '<button type="button" class="slot-summary" data-task-detail title="'+esc(description)+'"><span class="slot-title">'+file.slot+'. '+esc(file.title)+'</span><span class="slot-stage">'+esc(file.taskKind==='main-tags'?tr('主分类'):stage.label)+'</span><span class="slot-characters">'+(file.taskKind==='main-tags'?file.total+tr(' 项归纳中'):(p?.offset||0).toLocaleString(uiLocale())+' / '+file.total.toLocaleString(uiLocale()))+'</span>'+(file.taskKind==='main-tags'?'':stageProgressHTML(file.sourceId))+'</button>';
  }).join('') || '<span class="slot-idle">'+esc(activityState(state.analysis).label)+'</span>';
}
function bindTaskDetails() { document.querySelectorAll('[data-task-detail]').forEach(button=>button.onclick=jobsDialog); }
function taskSummaryText() {
  const a=state.analysis;
  return activityState(a).label+' · '+(a?.activeFiles?.length||0)+'/'+(a?.maxConcurrent||5)+' · '+(a?.completed??'—')+'/'+(a?.total??'—');
}
function stageProgressHTML(sourceId) {
  const stage=fileStageProgress(state.analysis,sourceId);
  const total=stage.total||0,percent=total?stage.completed/total*100:0;
  return '<div class="stage-progress"><small>'+esc(stage.label)+'</small><div class="segment-track" role="progressbar" aria-label="'+esc(tr('MD 分段进度'))+'" aria-valuemin="0" '+(total?'aria-valuemax="'+total+'" aria-valuenow="'+stage.completed+'"':'')+' aria-valuetext="'+esc(stage.label)+'"><i style="width:'+percent+'%"></i></div></div>';
}
function activeFilesHTML() {
  return (state.analysis?.activeFiles || []).map(file => {
    const progress=state.analysis.fileProgress?.[file.sourceId];
    return '<div class="job"><strong title="'+esc(file.title)+'">' + tr('槽位 ') + file.slot + ' · ' + esc(file.title) + '</strong><small>' +
      tr(file.taskKind==='concept-only'?'仅补历史概念，不重跑 AI 知识点或 AI 技能':state.features?.concepts?'分段联合分析：知识、关系、分类、技能与概念':'分段联合分析：知识、关系、分类与技能') + '<br>' +
      tr('本段字符范围：') + file.offset + '–' + file.end + '<br>' +
      (progress?.parts || 0) + tr(' 段已保存 · ') + (progress?.offset || 0) + ' / ' + file.total + tr(' 字符已落盘') + '</small>'+stageProgressHTML(file.sourceId)+'</div>';
  }).join('');
}
async function api(route, data) {
  const r = await fetch("/api/" + route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const j = await r.json();
  if (!r.ok) throw Error(uiError(j.error));
  await refresh();
  return j;
}
const bodyCache = new Map(), readingPages = new Map();
let renderGeneration = 0;
async function loadBody(node) {
  const cached = bodyCache.get(node.id);
  if (cached?.hash === node.hash) { node.body = cached.body; return; }
  const response = await fetch('/api/node?id=' + encodeURIComponent(node.id));
  if (!response.ok) throw new Error(tr('正文加载失败'));
  const detail = await response.json();
  Object.assign(node, detail);
  bodyCache.delete(node.id);
  bodyCache.set(node.id, {hash:node.hash, body:node.body});
  while (bodyCache.size > 3) bodyCache.delete(bodyCache.keys().next().value);
}
async function refresh() {
  const r = await fetch("/api/state?summary=1");
  if (!r.ok) throw Error(tr("无法读取本机资料"));
  const next = await r.json();
  if (next.revision === state.revision) return;
  state = next;
  hidden=relationVisibility.hiddenFor(state.types);
  if (selectedEdge)
    selectedEdge =
      state.relations.find((r) => r.id === selectedEdge.id) || null;
  if (!vaultId || !state.nodes.some((n) => n.id === vaultId))
    vaultId = state.nodes.find((n) => n.kind === "vault" && !n.mergedInto)?.id;
  const mergedSelection=state.nodes.find(n=>n.id===vaultId)?.mergedInto;
  if(mergedSelection)vaultId=mergedSelection;
  for (const k of ["vault", "knowledge", "skill", "concept"])
    $("#" + k + "-count").textContent = state.nodes.filter(
      (n) => n.kind === k && !n.mergedInto,
    ).length;
  const j =
    state.jobs.find((j) => j.status === "working") ||
    state.jobs.find((j) => j.status === "queued");
  const task = taskPresentation(state);
  $("#job-summary").textContent = [task.status, task.progress, task.problem].filter(Boolean).join('\n');
  $("#job-summary").title = task.stage;
  if ($('#sidebar-activity')) $('#sidebar-activity').innerHTML = activityHTML();
  else $('#job-summary').insertAdjacentHTML('afterend', '<div id="sidebar-activity">'+activityHTML()+'</div>');
  if ($('#graph-activity')) { $('#graph-activity').innerHTML = compactSlotsHTML(); bindTaskDetails(); }
  if ($('#graph-task-summary')) $('#graph-task-summary').textContent = taskSummaryText();
  if (graph && !benchmark) {
    updateGraph();
    renderInspector();
  } else if (!benchmark) render();
  if (
    $("#modal").open &&
    $("#modal-title").textContent === tr("自动处理进度")
  )
    jobsDialog();
  $("#footer-status").textContent =
    "Venus " + (state.version || '') + tr(" · 本机已保存 · 修订 ") +
    state.revision +
    " · " +
    new Date().toLocaleTimeString(uiLocale(), { timeZone: "Australia/Sydney" });
}
function safeMarkdown(body) {
  const renderer = new marked.Renderer();
  renderer.html = () => "";
  renderer.link = ({ href, text }) => {
    if (href?.startsWith("venus:"))
      return (
        '<a href="#" data-node="' +
        esc(href.slice(6)) +
        '">' +
        esc(text) +
        "</a>"
      );
    if (!/^(https?:|mailto:)/i.test(href || "")) return esc(text);
    return (
      '<a target="_blank" rel="noopener noreferrer" href="' +
      esc(href) +
      '">' +
      esc(text) +
      "</a>"
    );
  };
  renderer.image = () => tr('<span class="dim">[外部图片未自动加载]</span>');
  return marked.parse(body, { renderer, breaks: false });
}
function navigate(v, id) {
  if (v === 'knowledge' && !id) {
    knowledgeSource=null;knowledgeQuery='';knowledgePage=0;
  }
  if (id) {
    const n = state.nodes.find((n) => n.id === id);
    if (n?.kind === "vault") {vaultId = id;if(v==='knowledge')knowledgeSource=id;}
    if (n?.kind === "knowledge") {
      const source = n.sources.find(
        (s) => state.nodes.find((x) => x.id === s.id)?.kind === "vault",
      );
      if (source) vaultId = source.id;
    }
    chosen = id;
  } else chosen = null;
  view = v;
  selectedEdge = null;
  benchmark = false;
  if (graph) {
    graph.dispose();
    graph = null;
  }
  render();
}
function bindNodes(root = document) {
  root.querySelectorAll("[data-node]").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.preventDefault();
        const n = state.nodes.find((n) => n.id === b.dataset.node);
        if (n) navigate(n.kind, n.id);
      }),
  );
}
function relevant() {
  if (view === 'knowledge') return knowledgeInScope(state.nodes, knowledgeSource).filter(n => matchesCategories(n, view));
  const sourceIds=new Set([vaultId,...(state.nodes.find(n=>n.id===vaultId)?.mergedFrom||[])]);
  const nodes = state.nodes.filter(
    (n) =>
      n.kind === view && (!n.mergedInto || n.id===chosen) &&
      (view !== "knowledge" || n.sources.some((s) => sourceIds.has(s.id))),
  );
  return nodes.filter((n) => matchesCategories(n, view));
}
function current() {
  const ns = relevant();
  return (
    ns.find((n) => n.id === chosen) ||
    (view === "vault" ? ns.find((n) => n.id === vaultId) : undefined) ||
    ns[0]
  );
}
async function render({force=false}={}) {
  const liveEditor=document.querySelector('[data-inline-node]'),liveNode=current();
  if(!view.endsWith('-network')&&liveEditor?.dataset.inlineNode===liveNode?.id){
    const d=inlineDrafts.items.get(liveNode.id);
    if(!force&&(d?.dirty||d?.saving||liveEditor.contains(document.activeElement))){renderInspector();return;}
  }
  const generation = ++renderGeneration;
  document.body.dataset.view = view;
  for (const b of $$("[data-view]"))
    b.classList.toggle("active", b.dataset.view === view);
  if (view.endsWith("-network")) return renderNetwork();
  const nodes = relevant(),
    n = current();
  if (n) {
    try { await loadBody(n); } catch (error) { toast(error.message); return; }
    if (generation !== renderGeneration) return;
  }
  if (n) chosen = n.id;
  const panel =
    view === 'concept'?tr('概念云 · 内容目录'):view === "skill"
      ? tr("综合能力")
      : view === "knowledge"
        ? tr("知识浏览范围")
        : tr("Vault / 原始资料");
  const vaults = state.nodes.filter((n) => n.kind === "vault" && !n.mergedInto);
  $("#main").innerHTML =
    '<div class="file-panel"><div class="panel-heading">' +
    panel +
    '</div><p class="subtle">'+esc(contentPurposes[view]||'')+'</p>'+(view==='concept'?'<button type="button" id="concept-plan" class="wide">'+tr('查看提炼范围与模板')+'</button><button type="button" id="concept-new" class="wide"'+(!state.features?.conceptAdmission?' disabled':'')+'>'+tr('新建概念')+'</button>':'')+'<div class="subtle">' +
    (view === "knowledge"
      ? tr('已存知识总数：')+knowledgeInScope(state.nodes).length+' · '+tr('当前范围：')+nodes.length
      : nodes.length +
        tr(" 份 ") +
        (view === "skill" ? tr("能力分析") : tr("Markdown 资料"))) +
    "</div>" +
    (view === "knowledge"
      ? tr('<label class="field">选择原始 MD<select id="vault-select" aria-label="选择原始 MD">') +'<option value=""'+(!knowledgeSource?' selected':'')+'>'+tr('全部知识点')+'</option>'+
        vaults
          .map(
            (x) =>
              '<option value="' +
              esc(x.id) +
              '" ' +
              (x.id === knowledgeSource ? "selected" : "") +
              ">" +
              esc(x.path.split("/").at(-1) + ' · ' + knowledgeForSource(state.nodes, x.id).length + tr(' 个知识点')) +
              "</option>",
          )
          .join("") +
        "</select></label>"
      : "") +
    tr('<input id="list-search" class="search" placeholder="查找当前列表…" aria-label="查找当前列表"><div id="file-list">') +
    (view==='knowledge'?[]:nodes)
      .map(
        (x) =>
          '<button class="file-row ' +
          (n?.id === x.id ? "selected" : "") +
          '" data-file="' +
          esc(x.id) +
          '" title="' + esc(x.title+'\n'+x.path) + '" data-search="' + esc(x.title+' '+x.path) +
          '"><span class="file-icon">' +
          (view === "vault" ? "MD" : "◇") +
          "</span>" +
          esc(view === "vault" ? shortNodeLabel(x, 42) : x.title) +
          "<small>" +
          esc(
            view === "vault"
              ? x.path.split("/").slice(0, -1).join("/")
              : view === "skill"
                ? tr(x.level) + " · " + (x.domain || tr("待补充领域"))
                : x.decision || tr("已提取"),
          ) +
          "</small></button>",
      )
      .join("") +
    '</div></div><div class="article-scroll">' +
    (n ? article(n) : emptyView()) +
    "</div>";
  $("#files-host").replaceChildren();
  $("#list-search").insertAdjacentHTML("afterend", categoryFilterHTML(view));
  bindCategoryFilters();
  if(view==='knowledge'){
    $('#list-search').value=knowledgeQuery;
    const draw=()=>{
      const page=knowledgeListPage(nodes,{query:knowledgeQuery,page:knowledgePage});knowledgePage=page.page;
      $('#file-list').innerHTML='<p class="subtle">'+tr('匹配：')+page.total+' · '+(page.page+1)+' / '+page.pages+'</p>'+page.items.map(x=>'<button class="file-row '+(x.id===chosen?'selected':'')+'" data-file="'+esc(x.id)+'" title="'+esc(x.title)+'"><span class="file-icon">◇</span>'+esc(x.title)+'<small>'+esc(x.decision||tr('已提取'))+'</small></button>').join('')+'<div><button type="button" id="knowledge-prev"'+(page.page===0?' disabled':'')+'>'+tr('上一页')+'</button> <button type="button" id="knowledge-next"'+(page.page+1>=page.pages?' disabled':'')+'>'+tr('下一页')+'</button></div>';
      $('#knowledge-prev').onclick=()=>{knowledgePage--;draw();};$('#knowledge-next').onclick=()=>{knowledgePage++;draw();};
      $$('[data-file]').forEach(b=>b.onclick=()=>{chosen=b.dataset.file;document.body.classList.remove('files-open');render();});
    };
    $('#list-search').oninput=e=>{knowledgeQuery=e.target.value;knowledgePage=0;draw();};draw();
  }else $("#list-search").oninput = (e) =>
    $$("[data-file]").forEach(
      (b) =>
        (b.hidden = !(b.dataset.search || b.textContent)
          .toLowerCase()
          .includes(e.target.value.toLowerCase())),
    );
  $$("[data-file]").forEach(
    (b) =>
      (b.onclick = () => {
        chosen = b.dataset.file;
        if (view === "vault") vaultId = chosen;
        document.body.classList.remove('files-open');
        render();
      }),
  );
  if ($("#vault-select"))
    $("#vault-select").onchange = (e) => {
      knowledgeSource=e.target.value||null;if(knowledgeSource)vaultId=knowledgeSource;knowledgePage=0;knowledgeQuery='';
      chosen = null;
      render({force:true});
    };
  if(n)bindInlineEditor(n);
  if($('#concept-plan'))$('#concept-plan').onclick=conceptPlanDialog;
  if($('#concept-new'))$('#concept-new').onclick=conceptCreateDialog;
  if ($("#queue-button")) $("#queue-button").onclick = () => queue(n);
  document.querySelectorAll('[data-reading-page]').forEach(b => b.onclick = () => {
    readingPages.set(n.id, Number(b.dataset.readingPage)); render({force:true});
  });
  if ($("#empty-import")) $("#empty-import").onclick = importDialog;
  if ($("#empty-codex")) $("#empty-codex").onclick = jobsDialog;
  if (n) {
    $(".article .metadata").insertAdjacentHTML(
      "afterend",
      '<div class="article-classification">' + mainTagsHTML(n) + classificationHTML(n) + "</div>",
    );
    bindClassification();
  }
  bindNodes($("#main"));
  bindMainTags();
  renderInspector();
}
function emptyView() {
  if(view==='concept')return '<div class="empty"><div class="empty-symbol">◈</div><h2>'+tr('从对话中形成概念')+'</h2><p>'+tr('直接整理 Vault 中形成的认识、理由和技术线。')+'</p><p>'+tr('每篇包括：新标题、情境与目的的简短综述、解释认识及意义的正文，以及独立 Reference。操作日志、执行状态和排障碎片不作为概念。')+'</p><p class="subtle">'+tr(state.features?.concepts?'概念随后续分段与新增资料一并提炼；本批完成后自动补提历史缺失概念。':'概念云入口已就绪；增量提炼与历史补提接入待后端重新加载，本页不会自行启动新调用。')+'</p></div>';
  if (view === 'knowledge' && knowledgeSource && !selectedCategories(view).size) {
    const [title, detail] = knowledgeStatus(state.analysis, vaultId);
    return '<div class="empty"><h2>' + esc(title) + '</h2><p>' + esc(detail) + '</p></div>';
  }
  if (selectedCategories(view).size)
    return tr('<div class="empty"><h2>当前类别下暂无内容</h2><p>可以选择其他类别或显示全部。</p></div>');
  const copy =
    view === "vault"
      ? [
          tr("保存第一份原始资料"),
          tr("导入 Markdown，或主动保存一段文字。原文将独立保留，知识与能力分析逐步写入。"),
          tr("导入资料"),
        ]
      : view === "knowledge"
        ? [
            tr("等待这份资料的知识提取"),
            tr("选定一篇 MD 后，由 Codex 阅读原文、逐条保存知识与依据。这里始终是单篇分析。"),
            tr("查看 Codex 接入"),
          ]
        : [
            tr("能力从证据中形成"),
            tr("综合多个知识点，结合实践材料判断能力程度；提及一个概念不等于掌握。"),
            tr("查看 Codex 接入"),
          ];
  return (
    '<div class="empty"><div class="empty-symbol">◇</div><h2>' +
    copy[0] +
    "</h2><p>" +
    copy[1] +
    '</p><button class="primary" id="' +
    (view === "vault" ? "empty-import" : "empty-codex") +
    '">' +
    copy[2] +
    "</button></div>"
  );
}
async function conceptCreateDialog(){
  if(!state.features?.conceptAdmission)return;
  const r=await fetch('/api/concepts/template');if(!r.ok){toast(tr('概念模板读取失败'));return;}const {template}=await r.json();
  const vaults=state.nodes.filter(n=>n.kind==='vault'&&!n.mergedInto);
  const evidenceFields=[['questionQuote','提问原句'],['answerQuote','回答原句'],['userConfirmationQuote','用户认可原句'],['conclusionQuote','结论原句']];
  modal(tr('新建概念'),'<label class="field">'+tr('标题')+'<input name="title" required></label><label class="field">Vault<select name="sourceId">'+vaults.map(n=>'<option value="'+esc(n.id)+'">'+esc(n.title)+'</option>').join('')+'</select></label>'+evidenceFields.map(([name,label])=>'<label class="field">'+tr(label)+'<textarea name="'+name+'" required></textarea></label>').join('')+'<label class="field">'+tr('Markdown 正文')+'<textarea name="body" rows="16" required>'+esc(template)+'</textarea></label><p class="subtle">'+tr('手动保存，不调用模型；来源须是 Vault 原文。')+'</p>',async form=>{
    const source=state.nodes.find(n=>n.id===form.get('sourceId'));await loadBody(source);const admission=Object.fromEntries(evidenceFields.map(([name])=>[name,form.get(name)]));admission.confirmationMeaning='answer-endorsement';admission.confirmationTarget=admission.answerQuote;
    const at=source.body.indexOf(admission.conclusionQuote),ref={path:source.path,sourceId:source.id,sourceHash:source.hash,readRange:{start:0,end:source.body.length},admission,discussion:[],locator:{start:at,end:at+admission.conclusionQuote.length},formation:'手工整理用户已认可的讨论结论。',materials:[]};
    const title=form.get('title').trim(),body=form.get('body').replace(/^# [^\n]+/,'# '+title)+'\n\n'+source.path+'\n'+evidenceFields.map(([name,label])=>{const start=source.body.indexOf(admission[name]);return '- '+tr(label)+' · '+start+'–'+(start+admission[name].length);}).join('\n');
    const result=await api('upsert',{id:'c-'+crypto.randomUUID().replaceAll('-',''),kind:'concept',title,body,sources:[{id:source.id,sourceHash:source.hash,quote:admission.conclusionQuote}],conceptStance:'讨论假设',conceptReferences:[ref]});navigate('concept',result.id);
  });
}
async function conceptPlanDialog(){
  const fallback='# 概念名称\n\n## 综述\n情境、要求与目的。\n\n## 概念\n是什么、为何如此判断、形成的能力与认识、效果及边界；不是操作流水账。\n\n## 认识性质\n用户观点／讨论假设／助手建议／已确认结论。\n\n## Reference\n原 Vault 路径、讨论定位、原讨论参考资料与简短形成线索。';
  let template=fallback,plan=null;
  if(state.features?.concepts){try{const responses=await Promise.all([fetch('/api/concepts/template'),fetch('/api/concepts/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})]);if(responses.some(r=>!r.ok))throw Error(tr('概念范围读取失败'));const [t,p]=await Promise.all(responses.map(r=>r.json()));template=t.template;plan=p;}catch(error){toast(error.message);return;}}
  modal(tr('概念云 · 提炼范围与模板'),'<p>'+tr('只读取 Vault 原始对话，不经过 AI 知识点或 AI 技能；不外网验证、不改写原文。')+'</p>'+(plan?'<p>'+tr('待处理原文：')+plan.sourceCount+tr(' 篇；剩余字符：')+plan.remainingCharacters+tr('；预计分段调用：')+plan.estimatedModelCalls+'</p><p>'+tr('历史缺失概念预计分段调用：')+(plan.estimatedHistoryCalls||0)+tr('；本批完成后，五路中最多使用一路补提。')+'</p><p>'+tr('概念随现有后续分段一并提炼，不额外增加当次模型调用；本批完成后再仅补历史概念。查看范围不触发调用。')+'</p>':'<p>'+tr('当前后端尚未加载概念存储与增量接入；模板可查看，历史补提尚未启动。')+'</p>')+'<pre class="concept-template">'+esc(template)+'</pre>',async()=>{},tr('关闭'));
}
function article(n) {
  const draft=inlineDrafts.open(n),size = 24000, count = Math.max(1, Math.ceil(draft.body.length / size));
  const page = Math.min(count - 1, readingPages.get(n.id) || 0);
  readingPages.set(n.id,page);
  const pager = count > 1 ? tr('<div class="reading-pagination"><span>长对话分段显示 · ') + (page+1) + ' / ' + count + tr(' · MD 原文完整保留</span>') +
    '<button data-reading-page="' + Math.max(0,page-1) + '" ' + (!page?'disabled':'') + tr('>上一段</button>') +
    '<button data-reading-page="' + Math.min(count-1,page+1) + '" ' + (page===count-1?'disabled':'') + tr('>下一段</button></div>') : '';
  return (
    '<article class="article" data-inline-node="'+esc(n.id)+'"><div class="breadcrumb">' +
    esc(labels[view]) +
    " <span>/</span> " +
    esc(n.path) +
    '<span class="spacer"></span><span id="inline-save-status" role="status">'+esc(tr(draft.status))+'</span><button id="inline-save"'+(!draft.dirty?' disabled':'')+'>'+tr('保存')+'</button></div><input id="inline-title" class="inline-title" aria-label="'+esc(tr('标题'))+'" value="'+esc(draft.title)+'"><div class="metadata"><span class="tag">' +
    (n.kind === "vault"
      ? tr("原始 Markdown")
      : n.kind==='concept'?esc(n.conceptStance||tr('讨论假设')):n.kind === "skill"
        ? esc(tr(n.level)) + " · " + esc(n.domain || tr("能力分析"))
        : tr("单篇提取 · ") + esc(tr(n.decision) || tr("新增"))) +
    '</span><span class="subtle">' +
    (n.kind === "vault" ? tr("原文独立保存") : n.sources.length + tr(" 项可追溯依据")) +
    "</span>" +
    (n.kind === "vault"
      ? tr('<button class="text-button" id="queue-button">查看自动处理进度 →</button>')
      : "") +
    '</div>' + skillMethodHTML(n) + pager + '<textarea id="inline-body" class="inline-body" aria-label="'+esc(tr('Markdown 正文'))+'" spellcheck="false">' +
    esc(draft.body.slice(page*size,(page+1)*size)) +
    '</textarea>' + pager + '</article>'
  );
}
function skillMethodHTML(n){
  if(n.kind!=='skill')return '';const p=n.methodUse||{status:'legacy-unreviewed',usableAsMethod:false,notice:tr('旧记录保留，未标注用户认可；仅供参考，不覆盖当前指示。')};
  return '<section class="support"><h4>'+tr(p.usableAsMethod?'用户已认可的适用方法':'未确认或待复核的方法参考')+'</h4><p class="subtle">'+tr('来源角色：')+tr(p.originRole==='user'?'用户':p.originRole==='assistant'?'助手':'引用资料或角色未明')+'</p>'+(p.scope?'<p><strong>'+tr('适用范围')+'</strong> '+esc(p.scope)+'</p>':'')+(p.limitations?'<p><strong>'+tr('限制')+'</strong> '+esc(p.limitations)+'</p>':'')+'<p class="subtle">'+esc(p.notice)+'</p>'+(p.recognition?'<button class="wide" data-node="'+esc(p.recognition.sourceId)+'">'+tr('返回用户认可依据')+' ↗</button><blockquote>'+esc(p.recognition.quote)+'</blockquote>':'')+'</section>';
}
function bindInlineEditor(n){
  const draft=inlineDrafts.items.get(n.id),size=24000,page=readingPages.get(n.id)||0,start=page*size;
  let end=Math.min(draft.body.length,start+size);
  const status=()=>{if($('#inline-save-status'))$('#inline-save-status').textContent=tr(draft.status);if($('#inline-save'))$('#inline-save').disabled=draft.saving||!draft.dirty;};
  $('#inline-title').oninput=e=>{inlineDrafts.change(n.id,{title:e.target.value});status();};
  $('#inline-body').oninput=e=>{end=inlineDrafts.replaceRange(n.id,start,end,e.target.value);status();};
  $('#inline-save').onclick=async()=>{
    if(draft.saving)return;const version=draft.version;draft.saving=true;draft.status='保存中…';status();
    try{const saved=await saveInlineDraft(n,draft,api,state.features);inlineDrafts.accept(n.id,saved,version);bodyCache.set(n.id,{hash:saved.hash,body:saved.body});if(draft.version===version&&document.querySelector('[data-inline-node]')?.dataset.inlineNode===n.id){$('#inline-body').value=draft.body.slice(start,start+size);$('#inline-title').value=draft.title;end=Math.min(draft.body.length,start+size);}status();toast(tr('已保存，原版本保留；仅复核受影响资料'));}
    catch(error){draft.saving=false;draft.status='保存失败，草稿已保留';status();toast(error.message);}
  };
  document.querySelector('[data-inline-node]').onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('#inline-save').click();}};
}
function sourceHTML(s) {
  const n = state.nodes.find((n) => n.id === s.id);
  return (
    '<div class="support"><button data-node="' +
    esc(s.id) +
    '">' +
    esc(n?.title || s.id) +
    " ↗</button><p>" +
    esc(n?.path || tr("来源缺失")) +
    (s.quoteValid === false || (typeof n?.body === 'string' && !n.body.includes(s.quote)) ? tr(" · 原文已修改，请复核依据") : "") +
    (s.locator ? " · " + esc(typeof s.locator==='object'?s.locator.start+'–'+s.locator.end:s.locator) : "") +
    "</p><blockquote>「" +
    esc(s.quote) +
    "」</blockquote></div>"
  );
}
function renderInspector() {
  const n = view.endsWith("-network")
    ? state.nodes.find((n) => n.id === graph?.selected)
    : current();
  if (view.endsWith("-network")) {
    const kind = view.replace("-network", "");
    $("#inspector").innerHTML =
      tr("<h3>分类与关系</h3>") +
      '<h4>'+tr('主分类')+'</h4><div class="main-tags"><button class="category-chip" data-main-tag="">'+tr('全部显示')+'</button>'+[...new Set(state.nodes.filter(n=>n.kind===kind).flatMap(n=>(n.mainTags||[]).map(t=>t.name)))].sort().map(name=>'<button class="category-chip '+(mainTagSelections[kind]===name?'selected':'')+'" data-main-tag="'+esc(name)+'">'+esc(name)+'</button>').join('')+'</div>'+
      '<p class="metric">'+tr('大标签颜色按归属连接数变化；中心体积最多为普通基准节点的10倍，半径最多约2.154倍。自动自转关闭，局部公转保留。')+'</p>'+
      categoryFilterHTML(kind) +
      tr('<h4>关系类型 · 多选筛选</h4><button class="text-button" id="select-all">全部显示</button>') +
      relationDisplayTypes(state.types)
        .map(
          (t) =>
            '<label class="filter"><input type="checkbox" data-filter="' +
            esc(t.id) +
            '" ' +
            (!hidden.has(t.id) ? "checked" : "") +
            '><span>'+(!t.membershipLink?'<input type="color" class="type-color" data-type-color="'+esc(t.id)+'" value="'+esc(t.color)+'" aria-label="'+esc(tr('颜色')+' '+t.name)+'">':'') +
            esc(t.name) +
            "</span></label>",
        )
        .join("") +
      tr('<button class="text-button" id="type-open">＋ 定义关系类型</button><div class="metric">隐藏只改变视图，关系仍保存在 MD。<br>线粗表示强度；选中与连接数大小独立。</div><div class="rule"></div>') +
      (n
        ? tr('<h3>当前观察中心</h3><div class="support"><button data-node="') +
          esc(n.id) +
          '">' +
          esc(n.title) +
          " ↗</button><p>" +
          esc(n.path) +
          tr('</p></div><button id="relation-open" class="wide">＋ 建立有依据的关系</button>')
        : tr('<p class="subtle">点击任意节点将它设为观察中心。<br>双击节点进入内容。</p>')) +
      (n ? heatHTML(n) : '') +
      (selectedEdge ? edgeHTML(selectedEdge) : "") +
      (n
        ? state.relations
            .filter(
              (r) => (r.from === n.id || r.to === n.id) && !hidden.has(r.type),
            )
            .slice(0, 20)
            .map(
              (r) =>
                '<div class="edge-card">' +
                esc(state.types.find((t) => t.id === r.type)?.name) +
                " · " +
                esc(
                  state.nodes.find(
                    (x) => x.id === (r.from === n.id ? r.to : r.from),
                  )?.title,
                ) +
                '<br><button data-edge="' +
                esc(r.id) +
                tr('">查看理由、来源与强度 ↗</button></div>'),
            )
            .join("")
        : "") +
      tr('<div class="rule"></div><button id="relation-history-open" class="wide">关系版本与回退</button><button id="settings-open" class="wide">显示参数 · 可调初值</button><button id="benchmark-open" class="wide">临时性能试验</button>');
    $$("[data-filter]").forEach(
      (c) =>
        (c.onchange = () => {
          relationVisibility.set(c.dataset.filter,c.checked);
          hidden=relationVisibility.hiddenFor(state.types);
          if (!benchmark) updateGraph();
          else graph.update({ ...graphData, hidden });
          if(c.checked)focusFilteredContent({relationType:c.dataset.filter});else graph.setHighlight?.([]);
          renderInspector();
        }),
    );
    bindMainTags();
    $$('[data-type-color]').forEach(input=>{
      input.onclick=event=>event.stopPropagation();
      input.oninput=()=>{const type=state.types.find(t=>t.id===input.dataset.typeColor);type.color=input.value;if(graph)updateGraph();};
      input.onchange=async()=>{const type=state.types.find(t=>t.id===input.dataset.typeColor);try{await api('type',{...type,color:input.value,update:true});}catch(error){toast(error.message);}};
    });
    $("#select-all").onclick = () => {
      relationVisibility.selectAll(state.types);
      hidden=relationVisibility.hiddenFor(state.types);
      if (!benchmark) updateGraph();
      else graph.update({ ...graphData, hidden });
      renderInspector();
    };
    if (n) {
      $("#inspector").insertAdjacentHTML("beforeend", classificationHTML(n));
      bindClassification();
    }
    bindCategoryFilters();
    $("#type-open").onclick = typeDialog;
    $("#relation-history-open").onclick = () =>
      historyDialog({
        id: "@relations",
        title: tr("全部网络的关系"),
        hash: state.relationDocumentHash,
      });
    $("#settings-open").onclick = settingsDialog;
    $("#benchmark-open").onclick = benchmarkDialog;
    if ($("#relation-open"))
      $("#relation-open").onclick = () => relationDialog(null, n);
    $$("[data-edge]").forEach(
      (b) =>
        (b.onclick = () => {
          selectedEdge = state.relations.find((r) => r.id === b.dataset.edge);
          renderInspector();
        }),
    );
    if ($("#edge-edit"))
      $("#edge-edit").onclick = () => relationDialog(selectedEdge, n);
    bindNodes($("#inspector"));
    if(n){
      const neighbours=linkedNeighbours(state.nodes,state.relations,n.id,state.types);
      graph.setNavigation?.(neighbours,jumpToNeighbour);
      const context=navigationContext?.to===n.id?navigationContext:null;
      $('#inspector').insertAdjacentHTML('beforeend','<section class="neighbour-list"><h4>'+tr('沿真实连接前往')+'</h4><p class="subtle">'+tr('箭头表示导航去向，不改变关系方向。')+'</p>'+neighbours.map(entry=>'<button class="wide neighbour-jump" data-neighbour="'+esc(entry.id)+'">➜ '+esc(entry.node.title)+'<small>'+esc(entry.relations.map(r=>r.typeName).join(' · '))+'</small></button>').join('')+'</section>'+(context?'<section class="navigation-context"><h4>'+esc(tr('从 ')+context.fromTitle+tr(' 查看 ')+n.title)+'</h4>'+context.relations.map(r=>edgeHTML(r,false)).join('')+'</section>':'')+'<section class="neighbour-content"><h4>'+esc(n.title)+'</h4>'+(typeof n.body==='string'?'<div class="markdown">'+safeMarkdown(n.body.slice(0,24000))+'</div>':'<p>'+tr('正在读取正文…')+'</p>')+'<button class="wide" data-node="'+esc(n.id)+'">'+tr('打开完整内容与编辑器')+' ↗</button></section>');
      $('#inspector').querySelectorAll('[data-neighbour]').forEach(button=>button.onclick=()=>jumpToNeighbour(button.dataset.neighbour));bindNodes($('#inspector'));
      if(typeof n.body!=='string')loadBody(n).then(()=>{if(graph?.selected===n.id)renderInspector();}).catch(error=>toast(error.message));
    }else graph?.setNavigation?.([],jumpToNeighbour);
    return;
  }
  if (!n) {
    $("#inspector").innerHTML =
      tr('<h3>来源与依据</h3><p class="subtle">内容保存后，在这里沿依据返回原始资料。</p>');
    return;
  }
  if(n.kind==='concept'){
    $('#inspector').innerHTML='<h3>Reference</h3><p class="subtle">'+esc(n.conceptStance||tr('讨论假设'))+'</p>'+n.sources.map(sourceHTML).join('')+'<p class="subtle">'+tr('返回 Vault 原文查看讨论情境。概念不表示用户已掌握某项技能。')+'</p><button id="history-open" class="wide">'+tr('版本历史与回退')+'</button>';
    $('#history-open').onclick=()=>historyDialog(n);bindNodes($('#inspector'));return;
  }
  const knowledge = state.nodes
    .filter(
      (x) =>
        x.kind === "knowledge" &&
        x.sources.some((s) => [n.kind === "vault" ? n.id : vaultId,...(n.mergedFrom||[])].includes(s.id)) &&
        x.id !== n.id,
    )
    .slice(0, 5);
  $("#inspector").innerHTML =
    "<h3>" +
    (n.kind === "skill"
      ? tr("支撑知识与实践材料")
      : n.kind === "knowledge"
        ? tr("相关知识 · 当前单篇")
        : tr("文件信息")) +
    "</h3>" +
    heatHTML(n) +
    (n.kind === "vault" && n.mergedFrom?.length ? tr('<div class="support"><h4>连续资料已合并</h4><p>原始来源保留，可从下方逐份查看。</p>')+n.mergedFrom.map(id=>'<button class="wide" data-node="'+esc(id)+'">'+esc(state.nodes.find(x=>x.id===id)?.title||id)+' ↗</button>').join('')+tr('<button id="unmerge-open" class="wide">还原为独立文件</button></div>') : '') +
    (n.kind === "vault"
      ? '<div class="support"><p>' +
        esc(n.path) +
        tr("</p><p>原文 SHA-256<br>") +
        esc(n.hash.slice(0, 20)) +
        tr("…</p></div><h4>已提取知识</h4>")
      : "") +
    (n.kind === "skill"
      ? n.sources.map(sourceHTML).join("")
      : knowledge
          .map(
            (x, i) =>
              '<div class="support"><button data-node="' +
              esc(x.id) +
              '">' +
              String(i + 1).padStart(2, "0") +
              " " +
              esc(x.title) +
              " ↗</button><p>" +
              esc(
                state.nodes.find((z) => z.id === x.sources[0]?.id)?.path || "",
              ) +
              "</p></div>",
          )
          .join("")) +
    (n.kind === "knowledge"
      ? tr("<h4>本条知识的来源</h4>") + n.sources.map(sourceHTML).join("")
      : "") +
    (n.kind === "skill"
      ? tr('<h4>职业与领域</h4><p class="subtle">') +
        esc(n.occupations || tr("证据不足，待补充")) +
        tr('</p><h4>程度说明</h4><p class="subtle">涉及 → 实践 → 验证<br>升级判断需要相应材料支持。</p>')
      : "") +
    tr('<div class="rule"></div><button id="history-open" class="wide">版本历史与回退</button>');
  $("#history-open").onclick = () => historyDialog(n);
  if($('#unmerge-open'))$('#unmerge-open').onclick=async()=>{
    try{await api('unmerge',{targetId:n.id,expectedHash:n.hash});await refresh();await render();toast(tr('已还原独立文件，合并版本仍可追溯'));}catch(error){toast(error.message);}
  };
  bindNodes($("#inspector"));
}
function jumpToNeighbour(id){
  if(!graph?.selected)return;
  const from=state.nodes.find(n=>n.id===graph.selected),entry=linkedNeighbours(state.nodes,state.relations,graph.selected,state.types).find(e=>e.id===id);if(!from||!entry)return;
  navigationContext={from:from.id,fromTitle:from.title,to:id,relations:entry.relations};
  const kind=view.replace('-network','');selectedCategories(kind).clear();mainTagSelections[kind]=null;updateGraph();graph.select(id,{smooth:true});
}
function heatHTML(n){
  if(!n.heat)return '';
  return '<div class="support"><h4><i class="swatch" style="background:'+esc(n.heat.color)+'"></i> '+esc(n.heat.name+' · '+n.heat.label)+'</h4><p>'+esc(n.heat.reason)+tr('</p><p class="subtle">重要程度表示持续使用与推进，不表示技能掌握程度。</p></div>');
}
function edgeHTML(r,editable=true) {
  return (
    '<div class="support"><h4>'+tr('关系依据')+' · '+esc(state.types.find(t=>t.id===r.type)?.name||r.type)+'</h4><p>' +
    esc(r.reason) +
    tr("</p><p>强度 ") +
    r.strength +
    " · " +
    esc(
      Object.entries(r.dimensions||{})
        .map(([k, v]) => k + "：" + (v ? tr("是") : tr("否")))
        .join(" · "),
    ) +
    "</p>" +
    (r.sources||[]).map(sourceHTML).join("") +
    (editable?tr('<button id="edge-edit" class="text-button">纠正这条关系</button></div>'):'</div>')
  );
}
function modal(title, body, action, label = tr("保存")) {
  submitAction = action;
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = body;
  $("#form-error").textContent = "";
  $("#modal-submit").textContent = label;
  $("#modal-submit").hidden = !action;
  if (!$("#modal").open) $("#modal").showModal();
}
$("#modal-form").onsubmit = async (e) => {
  e.preventDefault();
  if (!submitAction) return;
  $("#modal-submit").disabled = true;
  try {
    await submitAction(new FormData(e.target));
    $("#modal").close();
  } catch (err) {
    $("#form-error").textContent = err.message;
  } finally {
    $("#modal-submit").disabled = false;
  }
};
$("#modal-close").onclick = () => $("#modal").close();
function importDialog() {
  modal(
    tr("保存原始资料"),
    tr('<p class="subtle">选择 MD 文件，或主动保存一段文字。只保存在本机。</p><label class="field">读取 Markdown 文件<input id="md-file" type="file" accept=".md,.markdown,.txt"></label><label class="field">文件名<input name="name" id="import-name" placeholder="例如：今日导入 第1.md" required></label><label class="field">原文<textarea name="body" id="import-body" placeholder="将资料粘贴到这里…" required></textarea></label>')+
    (state.features?.incrementalImportMetadata?'<details><summary>'+tr('来源与日期（可选）')+'</summary><label class="field">'+tr('资料原始日期')+'<input type="date" name="sourceDate"></label><label class="field">'+tr('来源标识')+'<input name="originId" maxlength="300"></label><label class="field">'+tr('来源版本')+'<input name="originVersion" maxlength="120"></label></details>':''),
    async (f) => {
      const r = await api("import", Object.fromEntries(f));
      navigate("vault", r.node.id);
      toast(
        r.duplicate
          ? tr("已存在相同原文，已打开原文件")
          : tr("原文已保存，已自动加入分析队列"),
      );
    },
  );
  $("#md-file").onchange = async (e) => {
    const f = e.target.files[0];
    if (f) {
      $("#import-name").value = f.name;
      $("#import-body").value = await f.text();
    }
  };
}
function edit(n) {
  modal(
    tr("编辑 · ") + n.title,
    tr('<p class="subtle">原版本会保留。保存时检查是否发生并发修改。</p><label class="field">正文<textarea name="body" style="min-height:360px">') +
      esc(n.body) +
      "</textarea></label>",
    async (f) => {
      await api("edit", {
        id: n.id,
        body: f.get("body"),
        expectedHash: n.hash,
      });
      toast(tr('已保存并安排受影响资料复核；人工正文受到保护，旧版本可回退'));
    },
  );
}
async function queue(n) {
  jobsDialog();
}
function jobsDialog() {
  const a=state.analysis||{};
  const task=taskPresentation(state);
  const counts=state.jobs.reduce((c,j)=>(c[j.status]=(c[j.status]||0)+1,c),{});
  modal(
    tr("自动处理进度"),
    activityHTML()+'<div role="status" aria-live="polite"><strong>'+esc(task.status)+'</strong><p>'+esc(task.current)+'</p><p>'+esc(task.progress)+'</p><p>'+esc(task.stage)+'</p>'+(task.problem?'<p>'+esc(task.problem)+'</p>':'')+'</div>'+activeFilesHTML()+
      tr('<p class="subtle">流程：导入原文 → 分段联合分析（知识提取 / 关系比较 / 主分类归纳 / 技能整合）→ 校验依据并落盘 → 下一段或下一篇。存量主分类随现有调用分批回填。最多五份文件并行，每份内部按段续接，无需逐篇启动。</p>')+
      '<div class="analysis-overview"><strong>'+(a.completed||0)+' / '+(a.total||0)+tr(' 篇已完成</strong><span>已读 ')+(a.segments||0)+tr(' 段 · 后续按顺序 ')+(counts.queued||0)+tr(' · 手动暂停 ')+(counts.paused||0)+tr(' · 重试 ')+(a.retrying||0)+tr(' · 实际失败 ')+(a.needsReview||0)+tr(' · 有核对说明 ')+(a.withNotes||0)+'</span></div>'+
      (a.mainTagProgress?'<p class="metric">'+tr('主分类覆盖 ')+a.mainTagProgress.covered+'/'+a.mainTagProgress.total+' · '+tr('待归纳 ')+(a.mainTagProgress.total-a.mainTagProgress.reviewed)+' · '+tr('依据不足 ')+a.mainTagProgress.unresolved+'</p>':'')+
      '<div class="analysis-controls"><button type="button" id="analysis-toggle">'+(a.enabled?tr('暂停全部自动处理'):tr('恢复自动处理'))+tr('</button><button type="button" id="analysis-retry">重试未通过的资料</button></div>')+
      (a.cooldownUntil>Date.now()?tr('<p class="metric">模型暂不可用，将在 ')+esc(new Date(a.cooldownUntil).toLocaleTimeString(uiLocale()))+tr(' 后自动重试。</p>'):'')+
      (a.lastError?tr('<details><summary>最近一次处理问题</summary><p class="metric">')+esc(uiError(a.lastError))+'</p></details>':'')+
      state.jobs
        .map(
          (j) =>
            '<div class="job"><strong>' +
            esc(
              state.nodes.find((n) => n.id === j.sourceId)?.title || j.sourceId,
            ) +
            "</strong><small>" +
            tr('状态：') + esc(a.fileProgress?.[j.sourceId]?.status==='review'?tr('失败'):a.fileProgress?.[j.sourceId]?.status==='retry'?tr('等待重试'):({queued:tr('排队'),working:tr('正在处理'),paused:tr('已暂停'),done:tr('整份分析已完成')})[j.status]||j.status) +
            " · " +
            esc(tr(j.stage)) +
            '</small>' + stageProgressHTML(j.sourceId) + (j.status === 'done' || a.fileProgress?.[j.sourceId]?.status === 'review' ? '' : '<button type="button" data-job-source="' +
            esc(j.sourceId) +
            '" data-status="' +
            (j.status === "paused" ? "queued" : "paused") +
            '">' +
            (j.status === "paused" ? tr("恢复此文件") : tr("暂停此文件")) +
            "</button>") + '</div>',
        )
        .join("") +
      (a.issues||[]).map(i=>'<details class="analysis-issue"><summary>'+esc(state.nodes.find(n=>n.id===i.sourceId)?.title||i.sourceId)+tr(' · 待核对说明</summary>')+i.messages.map(m=>'<p class="metric">'+esc(m)+'</p>').join('')+(i.error?'<p class="metric">'+esc(i.error)+'</p>':'')+'</details>').join('')+
      tr('<p class="metric">当前分析继续使用原有接入。其他模型可单独配置，保存不会切换在途请求。</p><button type="button" id="provider-open">模型与本地 AI 接入</button>')+' <button type="button" id="mcp-open">'+tr('MCP 连接')+'</button>',
    null,
  );
  $('#analysis-toggle').onclick=async()=>{try{await api('analysis',{enabled:!a.enabled});toast(a.enabled?tr('已暂停自动处理；已保存进度保留'):tr('自动处理已启动，将从已保存进度连续接续'));jobsDialog();}catch(e){toast(e.message);}};
  $('#analysis-retry').onclick=async()=>{try{await api('analysis',{retryFailed:true});jobsDialog();}catch(e){toast(e.message);}};
  $('#provider-open').onclick=providerDialog;
  $('#mcp-open').onclick=mcpDialog;
  $$("[data-job-source]").forEach(
    (b) =>
      (b.onclick = async () => {
        await api("job", {
          sourceId: b.dataset.jobSource,
          status: b.dataset.status,
          stage:
            b.dataset.status === "paused"
              ? tr("用户暂停，可续接")
              : tr("已恢复，后台将自动继续"),
        });
        jobsDialog();
      }),
  );
}
async function mcpDialog(){
  const control='/api/mcp-control',tunnelId='YOUR_TUNNEL_ID';let token='';
  modal(tr('MCP 连接'),'<label class="field">Tunnel ID<input id="tunnel-id" value="'+tunnelId+'" readonly></label><label class="field">'+tr('运行 API 密钥（仅本机，不保存）')+'<input id="tunnel-key" type="password" autocomplete="off" spellcheck="false" maxlength="4096"></label><p class="metric">'+tr('仅六个只读工具。密钥不进入网址、日志或浏览器存储。ChatGPT 添加 MCP 时认证选择 None。')+'</p><button type="button" id="tunnel-start">'+tr('启动 Tunnel')+'</button> <button type="button" id="tunnel-stop">'+tr('停止 Tunnel')+'</button> <button type="button" id="tunnel-refresh">'+tr('刷新连接状态')+'</button><p id="tunnel-status" role="status"></p><p class="metric">'+tr('ChatGPT 注册与实际工具调用：尚未验证；不等同于 Tunnel READY。')+'</p><p><a target="_blank" rel="noopener noreferrer" href="https://platform.openai.com/settings/organization/api-keys">'+tr('创建运行密钥：仅 Tunnels Read + Use')+'</a></p><p><a target="_blank" rel="noopener noreferrer" href="https://platform.openai.com/settings/organization/tunnels">'+tr('官方 Tunnel 设置')+'</a> · <a target="_blank" rel="noopener noreferrer" href="http://127.0.0.1:10003/">'+tr('本机独立连接页')+'</a></p>',null);
  const refresh=async()=>{try{const response=await fetch(control+'/status',{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error();const s=await response.json();token=s.token;const el=$('#tunnel-status');if(el)el.textContent='stdio MCP: '+(s.localMcpReady?'6 read-only tools READY':'not ready')+' · Tunnel: '+(s.ready?'READY':s.processRunning?tr('启动中'):tr('未启动'))+(s.error&&!s.ready?' · '+s.error:'');if($('#tunnel-stop'))$('#tunnel-stop').disabled=!s.processRunning;return s;}catch{if($('#tunnel-status'))$('#tunnel-status').textContent=tr('本机连接控制器未运行。请打开“连接Venus私人隧道.cmd”，再刷新状态。');return null;}};
  $('#tunnel-start').onclick=async()=>{const input=$('#tunnel-key');let key=input.value.trim();if(!key){toast(tr('请先输入运行 API 密钥'));return;}input.value='';try{if(!token&&!await refresh())return;const response=await fetch(control+'/start',{method:'POST',headers:{'Content-Type':'application/json','X-Venus-Token':token},body:JSON.stringify({key,tunnelId}),signal:AbortSignal.timeout(8000)});key='';const s=await response.json();if(!response.ok){$('#tunnel-status').textContent=s.error||tr('连接失败');return;}await refresh();}catch{if($('#tunnel-status'))$('#tunnel-status').textContent=tr('连接失败');}finally{key='';}};
  $('#tunnel-stop').onclick=async()=>{if(!token&&!await refresh())return;try{await fetch(control+'/stop',{method:'POST',headers:{'Content-Type':'application/json','X-Venus-Token':token},body:'{}',signal:AbortSignal.timeout(5000)});await refresh();}catch{toast(tr('连接失败'));}};
  $('#tunnel-refresh').onclick=refresh;await refresh();const poll=setInterval(()=>{if(!$('#tunnel-status'))clearInterval(poll);else refresh();},3000);
}
async function providerDialog(){
  let info;try{const response=await fetch('/api/analysis-provider');if(!response.ok)throw Error('当前后台尚未加载模型接入接口；现有分析未改动。接口会在下一次正常启动后可用。');info=await response.json();}catch(error){toast(error.message);return;}
  const c=info.saved;
  modal(tr('模型与本地 AI 接入'),'<p class="subtle">'+esc(tr('仅保存下次后台启动使用的配置，不切换或终止当前分析。本地模式只连接回环地址，不会自动发送到云端。'))+'</p><p>'+esc(tr('当前：')+info.active.provider+' · '+(info.active.model||tr('模型未显式指定'))+' · '+(info.active.reasoningEffort||tr('推理强度未显式指定')))+'</p><label class="field">'+tr('接入方式')+'<select name="provider" id="provider-kind">'+[['codex','Codex CLI'],['http','HTTP / OpenAI 兼容'],['gemini','Gemini Interactions'],['local','本地 AI / OpenAI 兼容']].map(([id,label])=>'<option value="'+id+'"'+(c.provider===id?' selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label>'+[['model','模型名',c.model],['endpoint','服务基础地址（本地只允许 localhost / 127.0.0.1 / ::1）',c.endpoint],['keyEnv','密钥环境变量名（不填写密钥本身）',c.keyEnv],['reasoningEffort','推理强度（留空使用模型默认）',c.reasoningEffort]].map(([name,label,value])=>'<label class="field">'+esc(tr(label))+'<input name="'+name+'" value="'+esc(value)+'" autocomplete="off"></label>').join('')+'<div class="two-col">'+[['chunkCharacters','每段原文字符',c.chunkCharacters,1000,40000],['maxInputCharacters','总输入字符预算',c.maxInputCharacters,8000,2000000],['maxOutputTokens','输出 token 上限',c.maxOutputTokens,512,64000],['candidateLimit','每轮关联候选上限',c.candidateLimit,0,44],['candidateExcerptCharacters','候选摘录字符上限',c.candidateExcerptCharacters,200,8000],['mainTagCandidateLimit','每轮分类补全候选上限',c.mainTagCandidateLimit,0,20]].map(([name,label,value,min,max])=>'<label class="field">'+esc(tr(label))+'<input type="number" name="'+name+'" min="'+min+'" max="'+max+'" value="'+value+'" required></label>').join('')+'</div><label class="field">'+tr('结构化输出')+'<select name="format"><option value="schema"'+(c.format==='schema'?' selected':'')+'>JSON Schema</option><option value="json"'+(c.format==='json'?' selected':'')+'>JSON（兼容模式）</option></select></label><p class="metric">'+esc(c.status)+tr('。这里不会测试连接或调用模型。原文会分段完整处理，不会静默截断。')+'</p>',async form=>{await api('analysis-provider',Object.fromEntries(form));toast(tr('配置已保存，仅下次后台启动生效；当前分析保持原接入'));});
  $('#provider-kind').onchange=e=>{if(e.target.value==='local'){const form=e.target.form;for(const [key,value]of Object.entries({chunkCharacters:6000,maxInputCharacters:48000,maxOutputTokens:4096,candidateLimit:6,candidateExcerptCharacters:1000,mainTagCandidateLimit:2}))form.elements[key].value=value;form.elements.endpoint.value='';form.elements.keyEnv.value='';}};
}
async function historyDialog(n) {
  const versions = await (
    await fetch("/api/history?id=" + encodeURIComponent(n.id))
  ).json();
  modal(
    tr("版本历史 · ") + n.title,
    (n.id === "@relations"
      ? tr('<p class="subtle">回退会恢复这份快照中的全部网络关系；回退前的当前关系也会保留为新版本。筛选设置不变，节点继续按已知联系柔性调整。</p>')
      : "") +
      (versions.length
        ? versions
            .map(
              (v) =>
                '<div class="job"><strong>' +
                esc(
                  new Date(v.time).toLocaleString(uiLocale(), {
                    timeZone: "Australia/Sydney",
                  }),
                ) +
                "</strong><small>" +
                esc(v.version) +
                '</small><button type="button" data-version="' +
                esc(v.version) +
                tr('">回退到此版本</button></div>'),
            )
            .join("")
        : tr('<p class="subtle">还没有修改记录。首次修改后会保留原版本。</p>')),
    null,
  );
  $$("[data-version]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await api("restore", {
            id: n.id,
            version: b.dataset.version,
            expectedHash: n.hash,
          });
          $("#modal").close();
          toast(tr("已回退；回退前的版本也已保留"));
        } catch (e) {
          toast(e.message);
        }
      }),
  );
}
function typeDialog() {
  modal(
    tr("定义新的关系类型"),
    tr('<label class="field">名称<input name="name" required placeholder="例如：互为前提"></label><label class="field">颜色<input name="color" type="color" value="#91b5bd"></label>'),
    async (f) => {
      await api("type", Object.fromEntries(f));
      toast(tr("已新增独立多选筛选项"));
    },
  );
}
function settingsDialog() {
  const s = state.settings;
  modal(
    tr("显示参数 · 可调初值"),
    '<p class="subtle">'+tr('连接增长保留；中心体积不超过普通基准节点10倍。三维轨道预留实体净空，自动自转为0，公转继续。')+'</p><div class="two-col">' +
      [
        ["baseRadius", tr("基础半径"), 0.2, 5, 0.1],
        ["growth", tr("每条连接增长比例"), 0, 0.1, 0.001],
        ["distance", tr("知识结构间距"), 5, 100, 1],
      ]
        .map(
          ([id, label, min, max, step]) =>
            '<label class="field">' +
            label +
            '<input name="' +
            id +
            '" type="number" min="' +
            min +
            '" max="' +
            max +
            '" step="' +
            step +
            '" value="' +
            s[id] +
            '"></label>',
        )
        .join("") +
      "</div>",
    async (f) => {
      await api(
        "settings",
        Object.fromEntries([...f].map(([k, v]) => [k, Number(v)])),
      );
      toast(tr("显示参数已保存"));
    },
  );
}
async function relationHash(r) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(r)),
  );
  return [...new Uint8Array(bytes)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
function relationDialog(r, n) {
  const from = r?.from || n?.id,
    kind = state.nodes.find((x) => x.id === from)?.kind,
    options = state.nodes.filter((x) => x.kind === kind && x.id !== from),
    s = r?.sources[0];
  modal(
    r ? tr("纠正关系") : tr("建立有依据的关系"),
    tr('<p class="subtle">同一网络内连接不同内容，必须说明理由，并引用已保存内容中的原句。</p><label class="field">目标<select name="to">') +
      options
        .map(
          (x) =>
            '<option value="' +
            esc(x.id) +
            '" ' +
            (r?.to === x.id ? "selected" : "") +
            ">" +
            esc(x.title) +
            "</option>",
        )
        .join("") +
      tr('</select></label><div class="two-col"><label class="field">关系类型<select name="type">') +
      state.types
        .map(
          (t) =>
            '<option value="' +
            esc(t.id) +
            '" ' +
            (r?.type === t.id ? "selected" : "") +
            ">" +
            esc(t.name) +
            "</option>",
        )
        .join("") +
      tr('</select></label><label class="field">强度 0–1<input type="number" min="0" max="1" step=".01" name="strength" value="') +
      (r?.strength ?? 0.6) +
      tr('"></label></div><label class="field">连接原因简述<input name="summary" maxlength="60" value="') +
      esc(r?.summary || r?.reason?.slice(0, 28) || "") +
      tr('" required></label><label class="field">完整理由<input name="reason" value="') +
      esc(r?.reason || "") +
      tr('" required></label><label class="field">依据内容<select name="sourceId">') +
      state.nodes
        .map(
          (x) =>
            '<option value="' +
            esc(x.id) +
            '" ' +
            ((s?.id || from) === x.id ? "selected" : "") +
            ">" +
            esc(x.title) +
            "</option>",
        )
        .join("") +
      tr('</select></label><label class="field">逐字引文<textarea name="quote" style="min-height:90px" required>') +
      esc(s?.quote || "") +
      '</textarea></label><div class="two-col">' +
      [
        ...new Set([
          tr("结构"),
          tr("主导"),
          tr("直接"),
          tr("互相关联"),
          ...Object.keys(r?.dimensions || {}),
        ]),
      ]
        .map(
          (key) =>
            '<label class="field">' +
            esc(key) +
            '<select name="dim:' +
            esc(key) +
            tr('"><option value="">未指定</option><option value="true" ') +
            (r?.dimensions?.[key] === true ? "selected" : "") +
            tr('>是</option><option value="false" ') +
            (r?.dimensions?.[key] === false ? "selected" : "") +
            tr(">否</option></select></label>"),
        )
        .join("") +
      "</div>",
    async (f) => {
      const x = Object.fromEntries(f);
      selectedEdge = await api("relation", {
        id: r?.id,
        from,
        to: x.to,
        type: x.type,
        strength: Number(x.strength),
        reason: x.reason,
        summary: x.summary,
        sources: [
          { id: x.sourceId, quote: x.quote },
          ...(r?.sources?.slice(1) || []),
        ],
        dimensions: Object.fromEntries(
          [...f]
            .filter(([k, v]) => k.startsWith("dim:") && v !== "")
            .map(([k, v]) => [k.slice(4), v === "true"]),
        ),
        expectedHash: r ? await relationHash(r) : undefined,
      });
      renderInspector();
      toast(tr("关系与依据已写入 MD"));
    },
  );
}
const categoryFilters = new Map();
function selectedCategories(kind) {
  if (!categoryFilters.has(kind)) categoryFilters.set(kind, new Set());
  return categoryFilters.get(kind);
}
function matchesCategories(n, kind = n.kind) {
  const selected = selectedCategories(kind);
  return (
    !selected.size ||
    (n.categories || []).some((t) => selected.has(t)) ||
    (!n.categories?.length && selected.has("@unclassified"))
  );
}
function categoryFilterHTML(kind) {
  const counts = new Map();
  for (const n of state.nodes.filter((n) => n.kind === kind)) {
    for (const t of n.categories || []) counts.set(t, (counts.get(t) || 0) + 1);
    if (!n.categories?.length)
      counts.set("@unclassified", (counts.get("@unclassified") || 0) + 1);
  }
  return (
    '<details class="category-filter-panel" ' +
    (selectedCategories(kind).size ? "open" : "") +
    tr("><summary>类别标签 · ") +
    counts.size +
    tr(' <span>多选</span></summary><button type="button" class="text-button" data-category-all="') +
    kind +
    tr('">全部类别</button>') +
    [...counts]
      .sort()
      .map(
        ([name, count]) =>
          '<label class="filter category-filter"><input type="checkbox" data-category-filter="' +
          esc(name) +
          '" data-kind="' +
          kind +
          '" ' +
          (selectedCategories(kind).has(name) ? "checked" : "") +
          "><span>" +
          esc(name === "@unclassified" ? tr("待归纳分类") : name) +
          " <small>" +
          count +
          "</small></span></label>",
      )
      .join("") +
    tr('<p class="metric">勾选类别取并集；不删除资料或关系。</p></details>')
  );
}
function bindCategoryFilters() {
  document.querySelectorAll("[data-category-filter]").forEach(
    (c) =>
      (c.onchange = () => {
        const set = selectedCategories(c.dataset.kind);
        if (c.checked) set.add(c.dataset.categoryFilter);
        else set.delete(c.dataset.categoryFilter);
        if (graph) {
          updateGraph();
          if(c.checked)focusFilteredContent({category:c.dataset.categoryFilter});else graph.setHighlight?.([]);
          renderInspector();
        } else {
          chosen = null;
          render();
        }
      }),
  );
  document.querySelectorAll("[data-category-all]").forEach(
    (b) =>
      (b.onclick = () => {
        selectedCategories(b.dataset.categoryAll).clear();
        if (graph) {
          updateGraph();
          renderInspector();
        } else {
          chosen = null;
          render();
        }
      }),
  );
}
function focusFilteredContent({relationType,category,mainTag}={}){
  if(!graph)return;const kind=view.replace('-network',''),nodes=state.nodes.filter(n=>n.kind===kind&&!n.mergedInto),ids=new Set();
  if(mainTag){if(!graph.focusMainTag?.(mainTag))toast(tr('当前筛选没有匹配节点或关系'));return;}
  if(relationType){const visible=new Set(graph.renderNodes.map(n=>n.id));for(const r of state.relations)if(r.type===relationType&&!hidden.has(r.type)&&visible.has(r.from)&&visible.has(r.to)){ids.add(r.from);ids.add(r.to);}}
  else for(const n of nodes)if((!category||(n.categories||[]).includes(category))&&(!mainTag||(n.mainTags||[]).some(t=>t.name===mainTag)))ids.add(n.id);
  if(!ids.size||!graph.focusNodes?.([...ids]))toast(tr('当前筛选没有匹配节点或关系'));
}
function classificationHTML(n) {
  return (
    tr('<section class="classification-section"><h4>归纳分类') +
    (n.classificationNeedsReview || n.analysisNeedsReview ? tr(" · 依据待复核") : "") +
    '</h4><p class="subtle">' +
    esc(
      n.classification?.summary ||
        tr("已进入后台自动处理队列，归纳完成后会显示分类与依据。"),
    ) +
    '</p><div class="category-chips">' +
    (n.categories || [])
      .map((t) => '<span class="category-chip"># ' + esc(t) + "</span>")
      .join("") +
    '</div><button class="text-button" data-classify="' +
    esc(n.id) +
    '">' +
    (n.categories?.length ? tr("查看依据 / 修正标签") : tr("归纳并添加标签")) +
    "</button></section>"
  );
}
function bindClassification() {
  document
    .querySelectorAll("[data-classify]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          classificationDialog(
            state.nodes.find((n) => n.id === b.dataset.classify),
          )),
    );
}
function classificationDialog(n) {
  const row = (tag = {}) =>
    tr('<fieldset class="tag-editor"><button type="button" class="remove-tag" title="移除此标签">×</button><label class="field">类别标签<input data-tag-name value="') +
    esc(tag.name || "") +
    tr('" required maxlength="40"></label><label class="field">分类理由<input data-tag-reason value="') +
    esc(tag.reason || "") +
    tr('" required></label><label class="field">正文中的依据原句<textarea data-tag-quote required>') +
    esc(tag.quote || "") +
    "</textarea></label></fieldset>";
  modal(
    tr("归纳分类 · ") + n.title,
    tr('<p class="subtle">这是') +
      esc(labels[n.kind]) +
      tr('的内容类别标签，与关系类型独立。每个标签都保留分类理由与原句依据。</p><label class="field">内容归纳<textarea name="summary" required style="min-height:80px">') +
      esc(n.classification?.summary || "") +
      '</textarea></label><div id="classification-rows">' +
      (n.classification?.tags?.length ? n.classification.tags : [{}])
        .map(row)
        .join("") +
      tr('</div><button type="button" class="text-button" id="add-tag-row">＋ 添加类别标签</button>'),
    async (f) => {
      const tags = [
        ...document.querySelectorAll("#classification-rows .tag-editor"),
      ].map((el) => ({
        name: el.querySelector("[data-tag-name]").value,
        reason: el.querySelector("[data-tag-reason]").value,
        quote: el.querySelector("[data-tag-quote]").value,
      }));
      if(!state.features?.classification)throw Error(tr("分类接口等待本机服务重新载入，当前归纳内容尚未保存。"));
      await api("classify", {
        id: n.id,
        summary: f.get("summary"),
        tags,
        expectedHash: n.classificationHash,
        sourceHash: n.hash,
        method: "manual",
      });
      toast(tr("归纳与类别标签已保存，原文保持完整"));
    },
  );
  const bindRows = () =>
    document
      .querySelectorAll(".remove-tag")
      .forEach((b) => (b.onclick = () => b.closest(".tag-editor").remove()));
  bindRows();
  $("#add-tag-row").onclick = () => {
    $("#classification-rows").insertAdjacentHTML("beforeend", row());
    bindRows();
  };
}
let graphData;
function updateGraph() {
  if (!graph) return;
  const kind = view.replace("-network", "");
  const nodes = state.nodes.filter((n) => n.kind === kind && !n.mergedInto),
    ids = new Set(nodes.map((n) => n.id));
  graphData = {
    nodes,
    edges: state.relations.map(r=>({...r,
      from:state.nodes.find(n=>n.id===r.from)?.mergedInto||r.from,
      to:state.nodes.find(n=>n.id===r.to)?.mergedInto||r.to,
    })).filter((r) => r.from!==r.to && ids.has(r.from) && ids.has(r.to)),
    positions: state.positions,
    layoutEpoch:state.layoutEpochs?.[kind]||0,
    types: state.types,
    settings: state.settings,
    hidden,
    visibleRelationTypes:relationVisibility.selected,
    mainTag:mainTagSelections[kind]||null,
    visibleIds: new Set(
      nodes.filter((n) => matchesCategories(n, kind)).map((n) => n.id),
    ),
  };
  graph.update(graphData);
  $("#node-locate").innerHTML =
    tr('<option value="">定位任意节点…</option>') +
    nodes
      .map(
        (n) =>
          '<option value="' +
          esc(n.id) +
          '" ' +
          (graph.selected === n.id ? "selected" : "") +
          ">" +
          esc(shortNodeLabel(n,42)) +
          "</option>",
      )
      .join("");
  $(".graph-empty").hidden = nodes.length > 0;
}
function renderNetwork() {
  $("#files-host").replaceChildren();
  const scope = {
    "vault-network": tr("跨 Markdown 文档关系"),
    "knowledge-network": tr("跨文档知识点关系"),
    "skill-network": tr("整合技能之间的关系"),
  };
  $("#main").innerHTML =
    '<div class="graph-shell"><div class="graph-toolbar"><div><h1>' +
    labels[view] +
    '</h1><div class="subtle">' +
    scope[view] +
    tr(' · 三维空间 · 依据联系紧密度浮动</div><div class="heat-legend" aria-label="重要程度由低到高">')+
    [['#eeeeee',tr('白'),tr('单次使用')],['#63cf8b',tr('绿'),tr('2 轮跟进')],['#61a7f5',tr('蓝'),tr('4 轮推进或 3 份对话复用')],['#b18af2',tr('紫'),tr('跨 2 天且 3 轮')],['#f5a451',tr('橙'),tr('跨 3 天且 8 轮')],['#f3ce60',tr('金'),tr('跨 5 天且 16 轮，或指定重点项目')]].map(([color,name,reason])=>'<span title="'+reason+'"><i style="background:'+color+'"></i>'+name+'</span>').join('')+
    tr('</div></div><div class="actions"><select id="node-locate" aria-label="定位任意节点"></select><button id="fit-graph">查看全图</button></div></div><div id="graph-area" class="graph-area" aria-label="可环绕缩放的三维网络"><div class="graph-stats" id="graph-stats"></div><div class="graph-camera" id="graph-camera"></div><div class="graph-empty"><h2>让关系逐步浮现</h2><p>资料与依据保存后，节点会自动出现。</p></div><div class="graph-hint">颜色：使用与持续推进热度　拖动：环绕　滚轮：缩放　点击：观察中心　双击：进入内容　文字随距离缩小、隐藏</div></div></div>');
  try {
    $('#graph-area').insertAdjacentHTML('beforeend', '<details class="graph-task-float"><summary id="graph-task-summary">'+esc(taskSummaryText())+'</summary><div id="graph-activity" aria-label="'+esc(tr('活动文件'))+'">'+compactSlotsHTML()+'</div></details>');
    bindTaskDetails();
    graph = new Network($("#graph-area"), {
      layoutKey: view,
      onCheckpoint: (positions) => {
        if (!benchmark && state.features?.dynamicLayout)
          fetch("/api/layout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: view.replace("-network", ""),
              positions,
              epoch:graph.layoutEpoch||0,
              protocol:2,
            }),
          }).catch(() => {});
      },
      onSelect: (n) => {
        if(navigationContext?.to!==n.id)navigationContext=null;
        selectedEdge = null;
        $("#node-locate").value = n.id;
        renderInspector();
      },
      onMainTag:(name)=>{const kind=view.replace('-network','');mainTagSelections[kind]=mainTagSelections[kind]===name?null:name;updateGraph();if(mainTagSelections[kind])focusFilteredContent({mainTag:mainTagSelections[kind]});renderInspector();},
      onOpen: (n) => {
        if (benchmark) toast(tr("合成试验节点没有内容页"));
        else navigate(n.kind, n.id);
      },
      onEdge: (e) => {
        selectedEdge = e;
        renderInspector();
      },
      onStats: (s) => {
        $("#graph-area").dataset.layoutSteps = String(s.layoutSteps);
        $("#graph-area").dataset.layoutSample = JSON.stringify(
          graph?.renderNodes
            ?.slice(0, 3)
            .map((n) => ({ id: n.id, position: graph.positions[n.id] })),
        );
        $("#graph-stats").textContent =
          (benchmark ? tr("临时合成数据 · 不保存　") : "") +
          s.nodes +
          tr(" 个节点 / ") +
          s.edges +
          tr(" 条显示关系　·　") +
          s.fps +
          tr(" FPS · 浮动布局");
        $("#graph-camera").textContent =
          tr("相机 ") +
          s.camera.map((v) => v.toFixed(1)).join(" / ") +
          tr("　中心 ") +
          s.target.map((v) => v.toFixed(1)).join(" / ");
      },
    });
    updateGraph();
    $("#fit-graph").onclick = () => graph.fit();
    $("#node-locate").onchange = (e) => {
      if (e.target.value) graph.select(e.target.value);
    };
  } catch (e) {
    $("#graph-area").innerHTML =
      tr('<div class="empty"><h2>三维视图暂不可用</h2><p>') +
      esc(e.message) +
      tr("</p><p>请使用支持 WebGL 2 的桌面浏览器。</p></div>");
    toast(tr("三维渲染失败，请检查浏览器图形支持"));
  }
  renderInspector();
}
function benchmarkDialog() {
  modal(
    tr("临时性能试验"),
    tr('<p class="subtle">仅在当前视图绘制合成节点与关系，不写入资料目录。结果只代表当前机器与当前布局。</p><label class="field">规模<select name="count"><option>100</option><option>1000</option><option>10000</option></select></label>'),
    (f) => {
      const count = Number(f.get("count")),
        nodes = [],
        edges = [],
        positions = {};
      for (let i = 0; i < count; i++) {
        const id = "bench-" + i;
        nodes.push({ id, title: tr("试验节点 ") + i });
        positions[id] = [
          Math.sin(i * 2.39) * Math.sqrt(i) * 3,
          Math.cos(i * 0.71) * Math.sqrt(i) * 3,
          Math.sin(i * 0.93) * Math.sqrt(i) * 3,
        ];
        if (i)
          edges.push({
            id: "be-" + i,
            from: id,
            to: "bench-" + Math.max(0, i - 1),
            type: state.types[i % state.types.length].id,
            strength: 0.5,
          });
      }
      benchmark = true;
      graph.selected = null;
      graphData = {
        nodes,
        edges,
        positions,
        types: state.types,
        settings: state.settings,
        hidden,
      };
      graph.update(graphData);
      graph.fit();
      $(".graph-empty").hidden = true;
      renderInspector();
      $("#node-locate").innerHTML =
        tr("<option>临时合成数据；切换视图退出</option>");
      toast(tr("试验数据不会保存，切换视图返回真实资料"));
    },
    tr("开始试验"),
  );
}
$$("[data-view]").forEach((b) => (b.onclick = () => {
  document.body.classList.remove('left-open', 'files-open');
  navigate(b.dataset.view);
}));
$("#import-open").onclick = importDialog;
$("#jobs-open").onclick = jobsDialog;
const events = new EventSource("/api/events");
let lifecycleBusy = false;
async function controlVenus(action) {
  if (lifecycleBusy) return;
  if ($("#modal").open) { toast(tr("请先保存或关闭正在编辑的内容")); return; }
  lifecycleBusy = true;
  const buttons = [$("#venus-restart"), $("#venus-shutdown")];
  buttons.forEach((b) => (b.disabled = true));
  try {
    if (graph?.layout && !benchmark) {
      await fetch('/api/layout', {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({kind:view.replace('-network',''), positions:graph.layout.checkpoint(),epoch:graph.layoutEpoch||0,protocol:2})});
    }
    const response = await fetch('/api/lifecycle', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action})});
    const result = await response.json();
    if (!response.ok) throw new Error(uiError(result.error));
    events.close();
    graph?.dispose(); graph = null;
    if (action === 'shutdown') {
      $('#connection').textContent = tr('Venus 已关闭');
      $('#main').innerHTML = tr('<div class="empty"><h2>Venus 已关闭</h2><p>后台已停止。重新使用时，请运行 Start-Venus.cmd。</p></div>');
      $('#inspector').replaceChildren();
      // The launcher reuses this window. Reconnect when the user starts Venus again.
      const reconnect = setInterval(async () => {
        try {
          const response=await fetch('/api/state?summary=1',{cache:'no-store',signal:AbortSignal.timeout(1500)});
          if(response.ok){clearInterval(reconnect);location.reload();}
        } catch {}
      },3000);
      return;
    }
    $('#connection').textContent = tr('正在重启 Venus…');
    // Wait past the old process response before checking the replacement.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const ready = await fetch('/api/state', {cache:'no-store', signal:AbortSignal.timeout(1500)});
        if (ready.ok) { location.reload(); return; }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(tr('未能确认重启成功，请运行 Start-Venus.cmd'));
  } catch (error) {
    toast(error.message);
    lifecycleBusy = false;
    buttons.forEach((b) => (b.disabled = false));
  }
}
$('#venus-restart').onclick = () => controlVenus('restart');
$('#venus-shutdown').onclick = () => controlVenus('shutdown');
events.onmessage = () => refresh().catch((e) => toast(e.message));
events.onopen = () => ($("#connection").textContent = tr("本机已连接"));
events.onerror = () => ($("#connection").textContent = tr("正在重新连接"));
refresh().catch((e) => {
  $("#connection").textContent = tr("连接失败");
  toast(e.message);
});

const uiIcons = {
  vault:
    '<path d="M3 7h7l2-3h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
  knowledge:
    '<path d="M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4V4ZM12 5v15"/>',
  skill: '<path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z"/>',
  concept:'<path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 4H9c0-2 0-3-1-4Z"/>',
  network:
    '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="11" cy="19" r="2"/><path d="m7 6 10-1M6 8l4 9m8-10-6 10"/>',
};
for (const b of document.querySelectorAll(".side-link")) {
  const span = b.querySelector("span");
  if (span)
    span.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      uiIcons[
        b.dataset.view.endsWith("-network") ? "network" : b.dataset.view
      ] +
      "</svg>";
}
$("#left-pane-toggle").onclick = () => {
  if (matchMedia('(max-width: 1000px)').matches) document.body.classList.toggle('left-open');
  else document.body.classList.toggle('left-collapsed');
};
$("#right-pane-toggle").onclick = () => {
  if (matchMedia('(max-width: 1200px)').matches) document.body.classList.toggle('right-open');
  else document.body.classList.toggle('right-collapsed');
};
$('#file-pane-toggle').onclick = () => document.body.classList.toggle('files-open');
$("#ribbon-search").onclick = () => {
  document.body.classList.remove("left-collapsed");
  if (view.endsWith("-network")) navigate("vault");
  if (matchMedia('(max-width: 680px)').matches) document.body.classList.add('files-open');
  $("#list-search")?.focus();
};
$("#ribbon-import").onclick = importDialog;
$("#ribbon-jobs").onclick = jobsDialog;


$('#mcp-connect-open').onclick=mcpDialog;
