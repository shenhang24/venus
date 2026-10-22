# Venus 0.7.1 — 2026-10-22 (Australia/Sydney)

## 今天更新了什么 / Changes today

### 重复标签自动归纳项目 / Recurring tags become projects

- 同一精确标签出现在 3 份独立来源 Markdown 中，列为项目候选；达到 5 份，自动成为项目标签，在 Vault、AI 知识点、AI 技能、概念云四个网络中聚合展示。
- 来源计数沿引用链去重：同一原文的知识点、技能、概念与增量版本不重复增加次数。标签必须保留逐字存在于当前正文的引用和理由；过期分类与缺少依据的标签不参与。
- 保留原始正文、稳定节点身份、跨项目关系和人工明确设置的“待归属”。这是按已保存标签形成项目分组，不代表重新生成了一份 AI 项目综述，也不表示全库人工或模型核对已经完成。

An exact normalized tag becomes a candidate at three independent source Markdown documents and an automatic project at five. All four networks use the resulting project memberships. Source lineage deduplicates derived notes and incremental versions. Evidence must include a literal current-body quote and a reason; stale classifications are excluded. Original Markdown, node identities, cross-project relationships and explicit manual unassignment remain intact. Grouping uses saved tags and does not perform extra model inference or certify library-wide review completion.

### 弹窗关闭与右键返回 / Dialog dismissal and right-click back

- 点击弹窗外的空白区域关闭当前弹窗；从弹窗内部拖到外部不会误触关闭。
- 右键优先关闭当前弹窗，没有弹窗时返回上一页，并恢复所选内容及筛选状态。
- 编辑框、链接及选中文本保留原生右键菜单；页面已有的未保存草稿保持机制继续生效。
- 三维网络右键不再同时触发镜头平移，左键旋转和中键平移保持可用。

Backdrop clicks dismiss dialogs through their existing close controls. Right-click dismisses the top dialog or returns to the previous Venus view. Inputs, links and selected text retain native context menus. Navigation snapshots preserve selections and filters; existing inline draft retention remains active. Right-click no longer also pans the 3D camera.

## Validation / 验证

Targeted public-checkout test and build results are recorded in docs/RELEASE-REVIEW.md. Isolated synthetic browser checks verified candidate/promotion grouping in all four networks, backdrop dismissal, right-click return and retained unsaved inline edits. These bounded checks do not claim universal browser or large-library performance acceptance. Historical unrelated regression failures remain documented under 0.7.0.

## Privacy / 隐私

Only reviewed application code, synthetic tests and public documentation are included. No private Vault Markdown, conversations, classifications, ASTRA results, model prompts from private runs, progress ledgers, logs, backups, credentials or account-specific Tunnel defaults are published. Public Tunnel configuration remains user-supplied. No private backend restart or library reanalysis is required by this release.

---

# Venus 0.7.0 — 2026-10-21

## Projects and full nebula views

Vault, AI Knowledge, AI Skills and Concept Cloud all use explicitly evidenced projects as their primary stars and groups. Domains remain reference/filter dimensions. Cross-project membership retains one node identity; unknown membership remains Awaiting project assignment. Manual project assignment preserves original Markdown and evidence.

All four networks show the complete nebula by default, including planets and nested satellites. Selecting a node focuses it; Fit all frames the full visible nebula instead of collapsing branches. Explicit filters still apply. Short labels shrink or hide with distance; showing every node does not force every label or relationship line on. Main-planet row capacities double from four; existing bounded satellite orbits remain.

## Editable analysis structure

Knowledge, skill and concept templates use Markdown: # defines the theme and ## defines editable analysis items. Add, rename or remove items, save a draft, then confirm the template. Separate help text is excluded from model judgment input. Confirmation alone does not reprocess the library. Explicitly select sources and one analysis layer to reanalyze with preserved evidence, prior versions and manual-edit protection.

## Incremental sync and task controls

The existing ribbon start/resume control now integrates Update sync / resume, with Fully pause and saved progress. The source panel shows actual capabilities, checkpoints, current work and gaps. Configured local Markdown sources are read incrementally, deduplicated and read back before checkpoints advance. Existing conversation caches and accessible local task records use the established backup workflow; no duplicate model queue is created.

GPT/cloud and Dots account histories require an authorized host or signed-in browser reader. The backend cannot promise direct history access on every platform. Connection detection is separate from successful inference and saved results. Existing model configuration remains unchanged.

## Deletion and connection indicators

Every Vault, knowledge, skill and concept detail page has Delete beside Saved / Save. It opens the exact selected object preview, including real paths, related links and dependent-source effects. Permanent execution remains disabled until the user explicitly confirms the irreversible-deletion warning. History copies are a separate choice; external originals, backup caches and execution logs are not silently removed. Changed files, expired previews and active work block unsafe execution. Validation used synthetic temporary data only.

AI ribbon entries highlight green only after a fresh real connection check reports ready. Unavailable or unchecked entries remain dim; tooltips expose status and check time. Checks refresh every minute while the page is visible, expire after 90 seconds, do not invoke inference and do not switch the analysis model. Readiness is not a guarantee that the next inference will succeed.

## Validation and limits

The public build and 33 targeted template, sync, deletion, project, visibility, task-control, provider and locale checks passed. Isolated browser checks showed all nodes in every network (7/7, 11/11, 8/8 and 10/10), exact single-object deletion previews on all four detail pages, and actual GPT readiness with other unavailable entries unhighlighted. These are small synthetic workloads, not a new large-library performance claim. Existing historical regression failures are reported separately in the release review.

No private conversations, library Markdown, credentials, runtime configuration or local backup evidence are included. Earlier 0.6.0 screenshots remain historical captures and do not document the new full-nebula behavior. The implementation supersedes their selective-branch UI descriptions.
