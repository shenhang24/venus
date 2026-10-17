# Privacy and data flow

Venus is intended as a personal, private knowledge-base tool. You decide which material to provide, which AI service may process it, which tools may retrieve it, and whether to share anything. The author should not receive your private library. Do not send your data directory, exports, history or credentials to the author as part of installing or using the application.

## What enters the library

The checked import handler accepts a user-supplied name and text, plus optional origin identifier, source date and version. It saves source content, hashes and supplied provenance, and queues the source for processing. The store reads Markdown within its configured data-root folders for Vault, knowledge and skills, including newly placed files there. It is not restricted to only files imported through the interface, but these checked store paths do not perform a default whole-disk or whole-account collection.

Conversion utilities work from exports or local files you explicitly supply. Optional daily incremental workflows require your configuration, authorization and actual access to the selected source. They are not enabled by default and do not grant access to all ChatGPT history. Attachments may retain references without migrating the binary content.

## What is stored locally

Original Markdown, extracted knowledge, skill evidence, tags, relationships, citations and provenance are saved under the configured data root. Local metadata also includes indexes, task checkpoints, analysis results/runtime artifacts, display/layout state, provider settings and version/history records. History can retain earlier text and grow much larger than the current primary documents. Removing text from the current editor does not prove every old copy disappeared.

Reading and editing existing content need no model credential. The publication copy defaults background analysis to off. Storage is on local files; the checked code does not establish encryption at rest or multi-user access isolation. Other processes or people with access to the files, local service or a configured tool host may be able to read data. Loopback binding is not a complete security guarantee.

## Using more than one AI

One personal knowledge base across the AI tools you choose, so project context and decisions do not have to be rebuilt in every conversation. Each compatible tool can retrieve the same saved background, decisions and supporting sources only through access you authorize. Shared evidence can help reduce inconsistent assumptions, but models can still interpret it differently or make conflicting recommendations. This adds no multi-user sharing, public synchronization or automatic platform-wide access.

Authorization is specific to the recipient and purpose: material previously supplied to one platform is not permission to disclose it to all other platforms. Choose your cloud analysis provider and retrieval AI hosts separately. The selected analysis provider receives relevant source chunks and context; the calling AI host receives requested retrieval results and may process them through its own cloud provider. Check which provider/host you have selected before enabling either flow. A local analysis service is an alternative when appropriate, with the local-service limits described below. External services retain their own terms and data practices.

## Corrections, removal and retained versions

Text editing and tag correction are available without AI. The checked interface has no dedicated whole-document or individual-link deletion operation; display filters only hide records. Removing text from a current document can leave older text in version history. The store notices externally removed Markdown files, but cascading cleanup and permanent suppression from future analysis are not established. See the [Page Tour](PAGE-TOUR.md#manual-control-and-current-deletion-limits) for the exact supported controls.

## When data can leave the machine

| Your action or configuration | Relevant data flow |
| --- | --- |
| Browse or edit local pages | Checked UI routes read/write the local Venus service. Metadata summaries, requested bodies and evidence are returned to the browser. |
| Enable Codex analysis | The scheduler provides a document chunk, source information and selected existing knowledge/tag context to the installed Codex process. A cloud-backed Codex session processes that supplied context under its service terms and usage limits. |
| Select an external HTTP or Gemini analyzer | The adapter sends the configured analysis payload to that provider. It may include original text and selected contextual excerpts, not only an anonymous summary. API charges and the provider's own terms apply. |
| Select a local model endpoint | Local mode accepts loopback hosts only. Data is sent to that local service. Its own configuration, logs or upstream behavior were not audited; a loopback URL alone does not prove zero onward transmission. |
| Authorize MCP, CLI or HTTP retrieval by an AI host | Requested search hits, titles, node bodies, quotes, source fragments or other permitted records are returned to the caller. If the caller uses cloud AI, returned context may be sent to that service. Local retrieval needs no paid model API itself, but it is not a promise of zero data leaving the machine. |
| Choose to share a file, screenshot or retrieved answer | You decide what to disclose through your chosen external tools. Venus does not make that material public by default. External services' terms apply. |

A read-only connection prevents its normal read tools from changing library content; it does not prevent the caller from learning returned content. The six-tool MCP includes targeted body and source-fragment retrieval, which can expose more than the compact CLI's default short results. The separate writable bridge/MCP has broader permissions. Grant access only at the scope you intend.

## Sharing and the author

The checked default server binds to loopback, and the checked application routes provide local library operations. No public-sharing workflow was identified in these checked paths; no new sharing feature has been added. Do not expose the local service publicly based on this document. The optional remote route mentioned in deployment documentation is not bundled or verified end to end in the public copy.

Sharing remains your choice. The intended public contents are application code, English documentation, synthetic examples and only explicitly approved screenshots when materialized. Your actual database, old versions, exports, caches, credentials and private configuration do not belong in the public package. The author is not an intended destination for your private library in the checked import/analyzer/retrieval flow.

## Telemetry and hidden-upload claims: limited evidence

In the specific UI, server, import, analyzer and read-client paths reviewed for this document, the observed network flow is local application access plus configured analyzer requests. No separate author-directed telemetry/upload destination was identified in those reviewed flows. This is a limited implementation observation, not a whole-tree proof that no telemetry or hidden upload exists anywhere.

A complete dependency review, runtime traffic capture, external Agent/provider review and final whole-tree privacy scan have not been completed. The user manually removed the temporary dependency/cache directories. A separate read-only check of the manifest-selected files found no matches for the checked secret, private-path or project-identifier patterns, apart from the explicitly documented <YOUR_TUNNEL_ID> placeholder. This does not establish a complete audit of dependencies or runtime behavior. No absolute privacy or safety guarantee is made, and external services have their own data practices and terms.

## Code evidence for this limited review

Paths below refer to files in this publication copy, not private data:

- src/store.mjs: constructor and scan define the data root and local Markdown folders; import validates supplied text/name, saves optional provenance, writes the Vault source and queues it. archive stores prior versions.
- public/app.js: api helper and selected-node loading use local /api routes; refresh uses a metadata summary; import sends the supplied form; progress and model dialogs use local state/config endpoints.
- public/knowledge-view.js: knowledgeInScope and knowledgeListPage implement the full knowledge list, optional source filter and pagination.
- src/server.mjs: /api/import delegates to store.import, /api/read routes delegate to read queries, static responses use connect-src self, and the default listener binds 127.0.0.1. The publication entry enables analysis only when VENUS_ANALYSIS equals 1. Browser policy does not constrain outbound backend analyzer calls.
- src/analyzer.mjs: selected source text and candidate context are assembled into a payload and passed to runner; returned evidence is validated before persistence.
- src/analysis-model.mjs: the Codex subprocess receives instructions plus serialized payload over stdin; the configured run disables shell, multi-agent, plugins and web search. These flags are not an audit of Codex or its cloud service.
- src/analysis-providers.mjs: budgetPayload limits auxiliary context; configured HTTP/Gemini providers serialize the analysis request to their endpoint. Local endpoint validation and credential-by-environment configuration do not audit the external service.
- codex-plugin/readonly-client.mjs and src/readonly-query.mjs: loopback read requests and permitted search/node/source/neighbor/fragment/handoff operations. The optional auxiliary-write facility is distinct from the default read-only configuration.

No private source body was read for this documentation review. These code references do not certify the final distributable file set, Git tracking state or full security of the application.
